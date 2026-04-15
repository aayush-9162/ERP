const { sequelize } = require('../models');

/**
 * Reporting service — all aggregation queries live here.
 * Every query uses raw SQL for performance on large datasets.
 */
class ReportsService {
  // ──────── Sales Reports ────────

  static async salesReport({ from, to, group_by = 'day' } = {}) {
    const dateFormat = group_by === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const whereClause = ReportsService._dateWhere('s.created_at', from, to);

    const [rows] = await sequelize.query(`
      SELECT
        DATE_FORMAT(s.created_at, '${dateFormat}') AS period,
        COUNT(s.id) AS invoice_count,
        ROUND(SUM(s.total_amount), 2) AS subtotal,
        ROUND(SUM(s.tax_amount), 2) AS tax,
        ROUND(SUM(s.discount_amount), 2) AS discount,
        ROUND(SUM(s.final_amount), 2) AS revenue,
        ROUND(SUM(s.paid_amount), 2) AS collected
      FROM sales s
      WHERE s.company_id = :cid ${whereClause ? "AND " + whereClause.replace("WHERE ","") : ""}
      GROUP BY period
      ORDER BY period DESC
    `);
    return rows;
  }

  static async topSellingProducts({ from, to, limit = 10 } = {}) {
    // When no date filter: aggregate directly from sale_items (avoids JOIN with sales).
    // With date filter: use the covering index on sale_items(sale_id, product_id, quantity, total).
    if (!from && !to) {
      const [rows] = await sequelize.query(`
        SELECT
          si.product_id, si.product_name, si.product_sku,
          SUM(si.quantity) AS total_qty,
          ROUND(SUM(si.total), 2) AS total_revenue
        FROM sale_items si
        GROUP BY si.product_id, si.product_name, si.product_sku
        ORDER BY total_qty DESC
        LIMIT ${parseInt(limit, 10)}
      `);
      return rows;
    }

    const whereClause = ReportsService._dateWhere('s.created_at', from, to);
    const [rows] = await sequelize.query(`
      SELECT
        si.product_id, si.product_name, si.product_sku,
        SUM(si.quantity) AS total_qty,
        ROUND(SUM(si.total), 2) AS total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      ${whereClause}
      GROUP BY si.product_id, si.product_name, si.product_sku
      ORDER BY total_qty DESC
      LIMIT ${parseInt(limit, 10)}
    `);
    return rows;
  }

  // ──────── Purchase Reports ────────

  static async purchaseReport({ from, to, group_by = 'day' } = {}) {
    const dateFormat = group_by === 'month' ? '%Y-%m' : '%Y-%m-%d';
    const whereClause = ReportsService._dateWhere('p.created_at', from, to);

    const [rows] = await sequelize.query(`
      SELECT
        DATE_FORMAT(p.created_at, '${dateFormat}') AS period,
        COUNT(p.id) AS order_count,
        ROUND(SUM(p.total_amount), 2) AS subtotal,
        ROUND(SUM(p.tax_amount), 2) AS tax,
        ROUND(SUM(p.final_amount), 2) AS spent,
        ROUND(SUM(p.paid_amount), 2) AS paid
      FROM purchases p
      ${whereClause}
      GROUP BY period
      ORDER BY period DESC
    `);
    return rows;
  }

  static async supplierWiseReport({ from, to } = {}) {
    const whereClause = ReportsService._dateWhere('p.created_at', from, to);

    const [rows] = await sequelize.query(`
      SELECT
        sup.id AS supplier_id, sup.name AS supplier_name,
        COUNT(p.id) AS order_count,
        ROUND(SUM(p.final_amount), 2) AS total_spent,
        ROUND(SUM(p.final_amount - p.paid_amount), 2) AS outstanding
      FROM purchases p
      JOIN suppliers sup ON sup.id = p.supplier_id
      ${whereClause}
      GROUP BY sup.id, sup.name
      ORDER BY total_spent DESC
    `);
    return rows;
  }

  // ──────── Inventory Reports ────────

  static async inventoryValuation() {
    const [rows] = await sequelize.query(`
      SELECT
        p.id, p.name, p.sku, p.purchase_price, p.selling_price,
        c.name AS category,
        COALESCE(SUM(i.stock_quantity), 0) AS stock,
        ROUND(p.purchase_price * COALESCE(SUM(i.stock_quantity), 0), 2) AS cost_value,
        ROUND(p.selling_price * COALESCE(SUM(i.stock_quantity), 0), 2) AS retail_value
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active'
      GROUP BY p.id, p.name, p.sku, p.purchase_price, p.selling_price, c.name
      ORDER BY cost_value DESC
    `);

    const totalCost = rows.reduce((s, r) => s + parseFloat(r.cost_value), 0);
    const totalRetail = rows.reduce((s, r) => s + parseFloat(r.retail_value), 0);
    return { items: rows, total_cost_value: Math.round(totalCost * 100) / 100, total_retail_value: Math.round(totalRetail * 100) / 100 };
  }

  // ──────── Profit & Loss ────────

  static async profitAndLoss({ from, to } = {}) {
    const whereS = ReportsService._dateWhere('s.created_at', from, to);
    const whereP = ReportsService._dateWhere('p.created_at', from, to);

    const [[salesRow]] = await sequelize.query(`
      SELECT
        COALESCE(SUM(s.total_amount), 0) AS sales_revenue,
        COALESCE(SUM(s.tax_amount), 0) AS sales_tax,
        COALESCE(SUM(s.discount_amount), 0) AS sales_discount,
        COALESCE(SUM(s.final_amount), 0) AS sales_total
      FROM sales s ${whereS}
    `);

    const [[purchaseRow]] = await sequelize.query(`
      SELECT
        COALESCE(SUM(p.total_amount), 0) AS purchase_cost,
        COALESCE(SUM(p.tax_amount), 0) AS purchase_tax,
        COALESCE(SUM(p.final_amount), 0) AS purchase_total
      FROM purchases p ${whereP}
    `);

    const grossProfit = parseFloat(salesRow.sales_revenue) - parseFloat(purchaseRow.purchase_cost);
    const netProfit = parseFloat(salesRow.sales_total) - parseFloat(purchaseRow.purchase_total);

    return {
      sales: {
        revenue: parseFloat(salesRow.sales_revenue),
        tax: parseFloat(salesRow.sales_tax),
        discount: parseFloat(salesRow.sales_discount),
        total: parseFloat(salesRow.sales_total),
      },
      purchases: {
        cost: parseFloat(purchaseRow.purchase_cost),
        tax: parseFloat(purchaseRow.purchase_tax),
        total: parseFloat(purchaseRow.purchase_total),
      },
      gross_profit: Math.round(grossProfit * 100) / 100,
      net_profit: Math.round(netProfit * 100) / 100,
      gross_margin: salesRow.sales_revenue > 0 ? Math.round((grossProfit / parseFloat(salesRow.sales_revenue)) * 10000) / 100 : 0,
    };
  }

  // ──────── Customer Reports / CRM ────────

  static async customerReport({ from, to } = {}) {
    const whereClause = ReportsService._dateWhere('s.created_at', from, to);

    const [rows] = await sequelize.query(`
      SELECT
        c.id, c.name, c.phone, c.credit_limit,
        COUNT(s.id) AS total_orders,
        ROUND(COALESCE(SUM(s.final_amount), 0), 2) AS total_spent,
        ROUND(COALESCE(SUM(s.final_amount - s.paid_amount), 0), 2) AS outstanding,
        MAX(s.created_at) AS last_purchase_date
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
      WHERE c.status = 'active'
      GROUP BY c.id, c.name, c.phone, c.credit_limit
      ORDER BY total_spent DESC
    `);
    return rows;
  }

  static async customerLedger(customerId) {
    const [rows] = await sequelize.query(`
      SELECT
        s.id, s.invoice_number AS reference, 'sale' AS type,
        s.final_amount AS amount,
        s.paid_amount,
        (s.final_amount - s.paid_amount) AS balance,
        s.payment_status AS status,
        s.created_at
      FROM sales s
      WHERE s.customer_id = :cid
      ORDER BY s.created_at DESC
    `, { replacements: { cid: customerId } });

    const totalSales = rows.reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalPaid = rows.reduce((s, r) => s + parseFloat(r.paid_amount), 0);

    return {
      entries: rows,
      summary: {
        total_sales: Math.round(totalSales * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        outstanding: Math.round((totalSales - totalPaid) * 100) / 100,
      },
    };
  }

  // ──────── Helper ────────

  static _dateWhere(column, from, to) {
    const conditions = [];
    // Sanitize dates — only allow YYYY-MM-DD format to prevent SQL injection
    if (from) {
      const d = new Date(from);
      if (!isNaN(d)) conditions.push(`${column} >= '${d.toISOString().slice(0, 10)} 00:00:00'`);
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d)) conditions.push(`${column} <= '${d.toISOString().slice(0, 10)} 23:59:59'`);
    }
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }
}

module.exports = ReportsService;
