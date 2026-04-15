const { Op } = require('sequelize');
const { Product, Category, Brand, Inventory, Warehouse } = require('../models');
const StockService = require('../services/stock.service');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/inventory — list all product stock levels
async function getInventory(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const result = await Product.findAndCountAll({
      where: { status: 'active', company_id: req.companyId },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Inventory, as: 'inventory', attributes: ['stock_quantity', 'warehouse_id'] },
      ],
      distinct: true, // Prevent over-counting from one-to-many JOIN
      limit,
      offset,
      order: [['name', 'ASC']],
    });

    const rows = result.rows.map((p) => {
      const json = p.toJSON();
      json.total_stock = json.inventory.reduce((sum, inv) => sum + inv.stock_quantity, 0);
      return json;
    });

    ApiResponse.paginated(res, { rows, count: result.count, page, limit });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/low-stock
async function getLowStock(req, res, next) {
  try {
    const products = await StockService.getLowStockProducts();
    ApiResponse.success(res, { products, count: products.length });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/summary
async function getInventorySummary(req, res, next) {
  try {
    const { sequelize } = require('../models');

    // Run all counts and aggregations in parallel, using SQL for heavy ones
    const [
      totalProducts,
      totalCategories,
      totalBrands,
      lowStockProducts,
      [stockValueRows],
    ] = await Promise.all([
      Product.count({ where: { status: 'active' } }),
      Category.count({ where: { status: 'active' } }),
      Brand.count({ where: { status: 'active' } }),
      StockService.getLowStockProducts(),
      // Stock value computed in SQL — no need to load all products into JS
      sequelize.query(`
        SELECT COALESCE(SUM(p.purchase_price * COALESCE(i.total_qty, 0)), 0) AS stock_value
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(stock_quantity) AS total_qty
          FROM inventory GROUP BY product_id
        ) i ON i.product_id = p.id
        WHERE p.status = 'active'
      `),
    ]);

    const outOfStock = lowStockProducts.filter((p) => p.total_stock === 0);

    ApiResponse.success(res, {
      summary: {
        total_products: totalProducts,
        total_categories: totalCategories,
        total_brands: totalBrands,
        low_stock_count: lowStockProducts.length,
        out_of_stock_count: outOfStock.length,
        total_stock_value: Math.round(parseFloat(stockValueRows[0]?.stock_value || 0) * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/warehouses
async function getWarehouses(req, res, next) {
  try {
    const warehouses = await Warehouse.findAll({ order: [['name', 'ASC']] });
    ApiResponse.success(res, { warehouses });
  } catch (error) {
    next(error);
  }
}

// GET /api/inventory/reconcile — compare inventory vs stock_movements
async function reconcileStock(req, res, next) {
  try {
    const mismatches = await StockService.reconcile();
    ApiResponse.success(res, {
      consistent: mismatches.length === 0,
      mismatches,
    }, mismatches.length === 0 ? 'Stock is consistent' : `${mismatches.length} mismatches found`);
  } catch (error) {
    next(error);
  }
}

module.exports = { getInventory, getLowStock, getInventorySummary, getWarehouses, reconcileStock };
