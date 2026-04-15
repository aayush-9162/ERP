const { sequelize, Inventory, StockMovement, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const { STOCK_MOVEMENT_TYPES } = require('../config/constants');

/**
 * Central service for all stock changes.
 * Every stock mutation (purchase, sale, manual adjustment) MUST go through this service
 * to maintain audit trail and prevent inconsistencies.
 *
 * Optimization strategy (v2):
 * - Uses atomic SQL UPDATE with WHERE clause instead of SELECT FOR UPDATE + app-side check.
 * - Reduces round-trips from 5 (findOrCreate → re-lock → check → UPDATE → INSERT) to 2 (UPDATE → INSERT).
 * - The WHERE clause `stock_quantity + ? >= 0` acts as both lock and guard in one statement.
 * - InnoDB's row-level X-lock on UPDATE serializes concurrent mutations to the same row.
 */
class StockService {
  /**
   * Add stock to a product (IN movement).
   */
  static async addStock({ product_id, quantity, reference, notes, warehouse_id = null, user_id }) {
    return StockService._processMovement({
      product_id,
      warehouse_id,
      type: STOCK_MOVEMENT_TYPES.IN,
      quantity: Math.abs(quantity),
      reference,
      notes,
      user_id,
    });
  }

  /**
   * Remove stock from a product (OUT movement).
   * Prevents negative stock.
   */
  static async removeStock({ product_id, quantity, reference, notes, warehouse_id = null, user_id }) {
    return StockService._processMovement({
      product_id,
      warehouse_id,
      type: STOCK_MOVEMENT_TYPES.OUT,
      quantity: -Math.abs(quantity),
      reference,
      notes,
      user_id,
    });
  }

  /**
   * Adjust stock (set delta). Positive = add, negative = subtract.
   */
  static async adjustStock({ product_id, quantity, reference = 'manual', notes, warehouse_id = null, user_id }) {
    return StockService._processMovement({
      product_id,
      warehouse_id,
      type: STOCK_MOVEMENT_TYPES.ADJUSTMENT,
      quantity,
      reference,
      notes,
      user_id,
    });
  }

  /**
   * Core movement processor — optimized for high concurrency.
   *
   * How it works:
   * 1. Atomic conditional UPDATE:
   *    UPDATE inventory SET stock_quantity = stock_quantity + :delta
   *    WHERE product_id = :pid AND warehouse_id <=> :wid AND stock_quantity + :delta >= 0
   *
   *    - If affectedRows === 1 → success, stock was sufficient.
   *    - If affectedRows === 0 → either row doesn't exist or stock insufficient.
   *    - InnoDB acquires an X-lock on the matched row during UPDATE, which serializes
   *      concurrent updates to the same (product_id, warehouse_id) pair.
   *
   * 2. If the row didn't exist (new product), fall back to findOrCreate + retry.
   *    This is the cold path — only happens once per product-warehouse pair.
   *
   * 3. INSERT the stock_movement audit record.
   *
   * Round-trips: 2 in the hot path (UPDATE + INSERT), vs 5 in the v1 ORM approach.
   */
  static async _processMovement({ product_id, warehouse_id, type, quantity, reference, notes, user_id }) {
    const transaction = await sequelize.transaction();

    try {
      // ---- Atomic conditional UPDATE (hot path) ----
      // The <=> operator is NULL-safe equality: NULL <=> NULL → true
      const [result] = await sequelize.query(`
        UPDATE inventory
        SET stock_quantity = stock_quantity + :delta, updated_at = NOW()
        WHERE product_id = :pid AND warehouse_id <=> :wid
          AND stock_quantity + :delta >= 0
      `, {
        replacements: { delta: quantity, pid: product_id, wid: warehouse_id },
        transaction,
      });

      if (result.affectedRows === 0) {
        // Either the row doesn't exist (cold path) or stock is insufficient.
        // Check which case we're in.
        const [rows] = await sequelize.query(`
          SELECT stock_quantity FROM inventory
          WHERE product_id = :pid AND warehouse_id <=> :wid
          FOR UPDATE
        `, {
          replacements: { pid: product_id, wid: warehouse_id },
          transaction,
        });

        if (rows.length === 0) {
          // Row doesn't exist — create it and retry the update.
          // Verify product exists first.
          const product = await Product.findByPk(product_id, { transaction });
          if (!product) {
            throw ApiError.notFound('Product not found');
          }

          const initialQty = Math.max(quantity, 0); // Can't start negative
          if (quantity < 0) {
            throw ApiError.badRequest(
              `Insufficient stock for product ID ${product_id}. Current: 0, requested: ${Math.abs(quantity)}`
            );
          }

          await Inventory.create({
            product_id, warehouse_id, stock_quantity: initialQty,
          }, { transaction });
        } else {
          // Row exists but stock is insufficient
          const currentStock = rows[0].stock_quantity;
          const product = await Product.findByPk(product_id, { transaction, attributes: ['name'] });
          throw ApiError.badRequest(
            `Insufficient stock for "${product?.name || product_id}". Current: ${currentStock}, requested: ${Math.abs(quantity)}`
          );
        }
      }

      // ---- Audit trail ----
      const movement = await StockMovement.create({
        product_id,
        warehouse_id,
        type,
        quantity,
        reference,
        notes,
        created_by: user_id,
      }, { transaction });

      await transaction.commit();

      // Return the new stock level (read after commit for accuracy)
      const [stockRows] = await sequelize.query(
        'SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id <=> :wid',
        { replacements: { pid: product_id, wid: warehouse_id } }
      );

      return {
        inventory: { stock_quantity: stockRows[0]?.stock_quantity ?? 0 },
        movement,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Optimized stock deduction for use inside an existing transaction (e.g., SalesService).
   *
   * @param {number}      product_id
   * @param {number|null} warehouse_id
   * @param {number}      quantity      - negative for deduction
   * @param {Transaction} transaction
   * @returns {{ newStock: number }}
   */
  static async deductStockInTransaction(product_id, warehouse_id, quantity, transaction) {
    const [result] = await sequelize.query(`
      UPDATE inventory
      SET stock_quantity = stock_quantity + :delta, updated_at = NOW()
      WHERE product_id = :pid AND warehouse_id <=> :wid
        AND stock_quantity + :delta >= 0
    `, {
      replacements: { delta: quantity, pid: product_id, wid: warehouse_id },
      transaction,
    });

    if (result.affectedRows === 0) {
      // Check if row exists to give a good error message
      const [rows] = await sequelize.query(
        'SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id <=> :wid FOR UPDATE',
        { replacements: { pid: product_id, wid: warehouse_id }, transaction }
      );

      if (rows.length === 0) {
        throw ApiError.badRequest(`No inventory record for product ID ${product_id}`);
      }

      const current = rows[0].stock_quantity;
      throw ApiError.badRequest(
        `Insufficient stock. Available: ${current}, requested: ${Math.abs(quantity)}`
      );
    }

    // Read back the new value within the transaction
    const [newRows] = await sequelize.query(
      'SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id <=> :wid',
      { replacements: { pid: product_id, wid: warehouse_id }, transaction }
    );

    return { newStock: newRows[0]?.stock_quantity ?? 0 };
  }

  /**
   * Acquire a FOR UPDATE lock on an inventory row within an existing transaction.
   * Legacy method — still used where ORM-style access is needed.
   */
  static async lockInventoryRow(product_id, warehouse_id, transaction) {
    const [inv] = await Inventory.findOrCreate({
      where: { product_id, warehouse_id },
      defaults: { stock_quantity: 0 },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    return Inventory.findOne({
      where: { id: inv.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  /**
   * Get current stock for a product across all warehouses.
   */
  static async getProductStock(product_id) {
    const rows = await Inventory.findAll({
      where: { product_id },
      include: [{ association: 'warehouse', attributes: ['id', 'name'] }],
    });
    const total = rows.reduce((sum, r) => sum + r.stock_quantity, 0);
    return { total, breakdown: rows };
  }

  /**
   * Get products where total stock is below their min_stock_alert threshold.
   * Uses SQL aggregation instead of loading all products into JS memory.
   */
  static async getLowStockProducts() {
    const [rows] = await sequelize.query(`
      SELECT
        p.id, p.name, p.sku, p.min_stock_alert, p.selling_price, p.purchase_price, p.status,
        c.id AS category_id, c.name AS category_name,
        b.id AS brand_id, b.name AS brand_name,
        COALESCE(SUM(i.stock_quantity), 0) AS total_stock
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.status = 'active'
      GROUP BY p.id, p.name, p.sku, p.min_stock_alert, p.selling_price, p.purchase_price,
               p.status, c.id, c.name, b.id, b.name
      HAVING total_stock < p.min_stock_alert
      ORDER BY (p.min_stock_alert - total_stock) DESC
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      min_stock_alert: r.min_stock_alert,
      selling_price: r.selling_price,
      purchase_price: r.purchase_price,
      total_stock: parseInt(r.total_stock, 10),
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
      brand: r.brand_id ? { id: r.brand_id, name: r.brand_name } : null,
    }));
  }

  /**
   * Reconcile inventory.stock_quantity against SUM(stock_movements.quantity).
   * Returns mismatches — if empty, data is consistent.
   */
  static async reconcile() {
    const [results] = await sequelize.query(`
      SELECT
        i.id AS inventory_id,
        i.product_id,
        i.warehouse_id,
        i.stock_quantity AS current_stock,
        COALESCE(SUM(sm.quantity), 0) AS movements_sum,
        i.stock_quantity - COALESCE(SUM(sm.quantity), 0) AS drift
      FROM inventory i
      LEFT JOIN stock_movements sm
        ON sm.product_id = i.product_id
        AND (sm.warehouse_id = i.warehouse_id OR (sm.warehouse_id IS NULL AND i.warehouse_id IS NULL))
      GROUP BY i.id, i.product_id, i.warehouse_id, i.stock_quantity
      HAVING drift != 0
    `);
    return results;
  }
}

module.exports = StockService;
