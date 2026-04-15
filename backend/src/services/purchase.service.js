const { Op } = require('sequelize');
const { sequelize, Purchase, PurchaseItem, SupplierPayment, Product, Supplier, StockMovement, Inventory } = require('../models');
const StockService = require('./stock.service');
const ApiError = require('../utils/ApiError');
const { PAYMENT_STATUS, STOCK_REFERENCES } = require('../config/constants');

class PurchaseService {
  /**
   * Generate next purchase number: PUR-YYYYMM-NNNN
   */
  static async _generatePurchaseNumber(transaction) {
    const prefix = 'PUR';
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const last = await Purchase.findOne({
      where: { purchase_number: { [Op.like]: `${prefix}-${ym}-%` } },
      order: [['id', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let seq = 1;
    if (last) {
      const parts = last.purchase_number.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
  }

  /**
   * Core purchase creation — runs entirely in a transaction.
   *
   * @param {Object} data
   * @param {number} data.supplier_id
   * @param {Array}  data.items       - [{ product_id, quantity, unit_price, tax_rate? }]
   * @param {number} data.discount_amount
   * @param {number} data.paid_amount
   * @param {string} data.payment_method - CASH, UPI, BANK
   * @param {Array}  data.payments    - [{ amount, method, reference }]
   * @param {string} data.notes
   * @param {number} user_id
   */
  static async createPurchase(data, user_id) {
    const transaction = await sequelize.transaction();

    try {
      const { supplier_id, items, discount_amount = 0, paid_amount = 0, payment_method, payments: paymentSplits, notes } = data;

      if (!items || items.length === 0) {
        throw ApiError.badRequest('At least one item is required');
      }

      // Validate supplier
      const supplier = await Supplier.findByPk(supplier_id, { transaction });
      if (!supplier || supplier.status !== 'active') {
        throw ApiError.badRequest('Supplier not found or inactive');
      }

      // Merge duplicate product_ids
      const mergedMap = new Map();
      for (const item of items) {
        const key = item.product_id;
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key);
          existing.quantity += item.quantity;
          if (item.unit_price != null) existing.unit_price = item.unit_price;
        } else {
          mergedMap.set(key, { ...item });
        }
      }
      const mergedItems = Array.from(mergedMap.values());

      // ---- Validate products and compute line items ----
      const purchaseItems = [];
      let subtotal = 0;
      let totalTax = 0;

      for (const item of mergedItems) {
        const product = await Product.findByPk(item.product_id, { transaction });
        if (!product || product.status !== 'active') {
          throw ApiError.badRequest(`Product ID ${item.product_id} not found or inactive`);
        }

        const unitPrice = item.unit_price != null ? parseFloat(item.unit_price) : parseFloat(product.purchase_price);
        const taxRate = item.tax_rate != null ? parseFloat(item.tax_rate) : parseFloat(product.tax_rate);
        const lineSubtotal = unitPrice * item.quantity;
        const lineTax = Math.round(lineSubtotal * taxRate) / 100;
        const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;

        purchaseItems.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: item.quantity,
          unit_price: unitPrice,
          tax_rate: taxRate,
          tax_amount: lineTax,
          total: lineTotal,
        });

        subtotal += lineSubtotal;
        totalTax += lineTax;
      }

      subtotal = Math.round(subtotal * 100) / 100;
      totalTax = Math.round(totalTax * 100) / 100;
      const effectiveDiscount = Math.min(parseFloat(discount_amount) || 0, subtotal + totalTax);
      const finalAmount = Math.round((subtotal + totalTax - effectiveDiscount) * 100) / 100;

      // ---- Payment status ----
      const effectivePaid = Math.min(parseFloat(paid_amount) || 0, finalAmount);
      let paymentStatus;
      if (effectivePaid >= finalAmount) paymentStatus = PAYMENT_STATUS.PAID;
      else if (effectivePaid > 0) paymentStatus = PAYMENT_STATUS.PARTIAL;
      else paymentStatus = PAYMENT_STATUS.UNPAID;

      // ---- Create purchase record ----
      const purchaseNumber = await PurchaseService._generatePurchaseNumber(transaction);

      const purchase = await Purchase.create({
        purchase_number: purchaseNumber,
        supplier_id,
        total_amount: subtotal,
        tax_amount: totalTax,
        discount_amount: effectiveDiscount,
        final_amount: finalAmount,
        paid_amount: effectivePaid,
        payment_status: paymentStatus,
        notes,
        created_by: user_id,
      }, { transaction });

      // ---- Create purchase items ----
      const itemRecords = purchaseItems.map((pi) => ({ ...pi, purchase_id: purchase.id }));
      await PurchaseItem.bulkCreate(itemRecords, { transaction });

      // ---- Increase stock using atomic UPDATE with row-lock ----
      // Uses the same >= 0 guard as sales for consistency (even though stock IN
      // can't go negative, the guard protects against corruption from other bugs).
      for (const pi of purchaseItems) {
        const [result] = await sequelize.query(`
          UPDATE inventory
          SET stock_quantity = stock_quantity + :delta, updated_at = NOW()
          WHERE product_id = :pid AND warehouse_id <=> :wid
            AND stock_quantity + :delta >= 0
        `, {
          replacements: { delta: pi.quantity, pid: pi.product_id, wid: null },
          transaction,
        });

        if (result.affectedRows === 0) {
          // Inventory row doesn't exist — lock-check then create.
          // Use SELECT FOR UPDATE to prevent two concurrent purchases from
          // both creating a row for the same product.
          const [existing] = await sequelize.query(
            'SELECT id FROM inventory WHERE product_id = :pid AND warehouse_id <=> :wid FOR UPDATE',
            { replacements: { pid: pi.product_id, wid: null }, transaction }
          );

          if (existing.length > 0) {
            // Row exists but UPDATE returned 0 — shouldn't happen for IN (qty > 0).
            // Retry the UPDATE now that we hold the lock.
            await sequelize.query(`
              UPDATE inventory
              SET stock_quantity = stock_quantity + :delta, updated_at = NOW()
              WHERE product_id = :pid AND warehouse_id <=> :wid
            `, { replacements: { delta: pi.quantity, pid: pi.product_id, wid: null }, transaction });
          } else {
            await Inventory.create({
              product_id: pi.product_id, warehouse_id: null, stock_quantity: pi.quantity,
            }, { transaction });
          }
        }

        // Audit trail
        await StockMovement.create({
          product_id: pi.product_id,
          warehouse_id: null,
          type: 'IN',
          quantity: pi.quantity,
          reference: STOCK_REFERENCES.PURCHASE,
          notes: `Purchase ${purchaseNumber}`,
          created_by: user_id,
        }, { transaction });
      }

      // ---- Record payments ----
      if (paymentSplits && paymentSplits.length > 0) {
        await SupplierPayment.bulkCreate(
          paymentSplits.map((p) => ({
            purchase_id: purchase.id,
            amount: p.amount,
            method: p.method,
            reference: p.reference || null,
          })),
          { transaction }
        );
      } else if (effectivePaid > 0) {
        await SupplierPayment.create({
          purchase_id: purchase.id,
          amount: effectivePaid,
          method: payment_method || 'CASH',
          reference: null,
        }, { transaction });
      }

      await transaction.commit();

      return Purchase.findByPk(purchase.id, {
        include: [
          { association: 'items' },
          { association: 'supplier' },
          { association: 'payments' },
          { association: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Record an additional payment to a supplier.
   */
  static async addPayment(purchase_id, { amount, method, reference }) {
    const transaction = await sequelize.transaction();

    try {
      const purchase = await Purchase.findByPk(purchase_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!purchase) throw ApiError.notFound('Purchase not found');

      if (purchase.payment_status === PAYMENT_STATUS.PAID) {
        throw ApiError.badRequest('Purchase is already fully paid');
      }

      const remaining = parseFloat(purchase.final_amount) - parseFloat(purchase.paid_amount);
      if (remaining <= 0) throw ApiError.badRequest('No balance remaining');

      const payAmount = Math.min(parseFloat(amount), remaining);

      const payment = await SupplierPayment.create({
        purchase_id,
        amount: payAmount,
        method,
        reference: reference || null,
      }, { transaction });

      const newPaid = Math.round((parseFloat(purchase.paid_amount) + payAmount) * 100) / 100;
      const newStatus = newPaid >= parseFloat(purchase.final_amount) ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIAL;

      await purchase.update({ paid_amount: newPaid, payment_status: newStatus }, { transaction });

      await transaction.commit();
      return { payment, purchase: await Purchase.findByPk(purchase_id) };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Purchase summary for dashboard.
   * Single query with conditional aggregation — 1 table scan instead of 3.
   */
  static async getPurchaseSummary() {
    const [[row]] = await sequelize.query(`
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(final_amount), 0) AS total_spent,
        SUM(CASE WHEN created_at >= CURDATE() THEN 1 ELSE 0 END) AS today_count,
        COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN final_amount ELSE 0 END), 0) AS today_spent,
        SUM(CASE WHEN payment_status != 'PAID' THEN 1 ELSE 0 END) AS unpaid_count,
        COALESCE(SUM(CASE WHEN payment_status != 'PAID' THEN final_amount ELSE 0 END), 0) AS unpaid_amount
      FROM purchases
    `);

    return {
      total_purchases: parseInt(row.total_count) || 0,
      total_spent: parseFloat(row.total_spent) || 0,
      today_purchases: parseInt(row.today_count) || 0,
      today_spent: parseFloat(row.today_spent) || 0,
      unpaid_purchases: parseInt(row.unpaid_count) || 0,
      unpaid_amount: parseFloat(row.unpaid_amount) || 0,
    };
  }
}

module.exports = PurchaseService;
