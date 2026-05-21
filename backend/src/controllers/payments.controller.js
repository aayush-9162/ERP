const { sequelize } = require('../models');
const ApiResponse = require('../utils/ApiResponse');

/**
 * GET /api/payments
 *
 * Unified list of money-in (customer payments against sales) and money-out
 * (supplier payments against purchases). Filtered by direction, method, date,
 * and free-text search across party + document number.
 */
async function listPayments(req, res, next) {
  try {
    const page   = parseInt(req.query.page,  10) || 1;
    const limit  = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { direction, method, from, to, search } = req.query;

    const baseReplacements = { cid: req.companyId };
    if (search) baseReplacements.q = `%${search.trim()}%`;
    if (method) baseReplacements.method = method;
    if (from)   baseReplacements.from = new Date(from);
    if (to) {
      // Make `to` inclusive of the entire day so a date-only input like "today"
      // still captures payments made later in the day.
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      baseReplacements.to = end;
    }
    baseReplacements.limit = limit;
    baseReplacements.offset = offset;

    const inFilter = `
      s.company_id = :cid
      ${method ? 'AND p.method = :method' : ''}
      ${from   ? 'AND p.created_at >= :from' : ''}
      ${to     ? 'AND p.created_at <= :to'   : ''}
      ${search ? 'AND (s.invoice_number LIKE :q OR c.name LIKE :q OR c.phone LIKE :q)' : ''}
    `;
    const outFilter = `
      pur.company_id = :cid
      ${method ? 'AND sp.method = :method' : ''}
      ${from   ? 'AND sp.created_at >= :from' : ''}
      ${to     ? 'AND sp.created_at <= :to'   : ''}
      ${search ? 'AND (pur.purchase_number LIKE :q OR sup.name LIKE :q OR sup.phone LIKE :q)' : ''}
    `;

    const inSelect = `
      SELECT p.id, 'IN' AS direction, p.amount, p.method, p.reference,
             p.created_at, p.sale_id AS related_id,
             s.invoice_number AS doc_number,
             c.id AS party_id, c.name AS party_name
      FROM payments p
      JOIN sales s ON s.id = p.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE ${inFilter}
    `;
    const outSelect = `
      SELECT sp.id, 'OUT' AS direction, sp.amount, sp.method, sp.reference,
             sp.created_at, sp.purchase_id AS related_id,
             pur.purchase_number AS doc_number,
             sup.id AS party_id, sup.name AS party_name
      FROM supplier_payments sp
      JOIN purchases pur ON pur.id = sp.purchase_id
      LEFT JOIN suppliers sup ON sup.id = pur.supplier_id
      WHERE ${outFilter}
    `;

    let union;
    if (direction === 'IN')       union = inSelect;
    else if (direction === 'OUT') union = outSelect;
    else                          union = `${inSelect} UNION ALL ${outSelect}`;

    const dataSql = `
      SELECT * FROM (${union}) AS t
      ORDER BY t.created_at DESC
      LIMIT :limit OFFSET :offset
    `;
    const countSql = `SELECT COUNT(*) AS total FROM (${union}) AS t`;

    const [rows] = await sequelize.query(dataSql, { replacements: baseReplacements });
    const [[{ total }]] = await sequelize.query(countSql, { replacements: baseReplacements });

    ApiResponse.paginated(res, {
      rows,
      count: parseInt(total, 10),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/payments/summary
 * Aggregate money-in, money-out, net, and breakdowns by method.
 * Honors the same filters as listPayments so the cards match the table.
 */
async function summary(req, res, next) {
  try {
    const cid = req.companyId;
    const { direction, method, from, to, search } = req.query;

    const replacements = { cid };
    if (search) replacements.q = `%${search.trim()}%`;
    if (method) replacements.method = method;
    if (from)   replacements.from = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      replacements.to = end;
    }

    const inFilter = `
      s.company_id = :cid
      ${method ? 'AND p.method = :method' : ''}
      ${from   ? 'AND p.created_at >= :from' : ''}
      ${to     ? 'AND p.created_at <= :to'   : ''}
      ${search ? 'AND (s.invoice_number LIKE :q OR c.name LIKE :q OR c.phone LIKE :q)' : ''}
    `;
    const outFilter = `
      pur.company_id = :cid
      ${method ? 'AND sp.method = :method' : ''}
      ${from   ? 'AND sp.created_at >= :from' : ''}
      ${to     ? 'AND sp.created_at <= :to'   : ''}
      ${search ? 'AND (pur.purchase_number LIKE :q OR sup.name LIKE :q OR sup.phone LIKE :q)' : ''}
    `;

    let totalIn = 0;
    let totalOut = 0;
    let inMethodRows = [];
    let outMethodRows = [];

    if (direction !== 'OUT') {
      const [[row]] = await sequelize.query(`
        SELECT COALESCE(SUM(p.amount), 0) AS total_in
        FROM payments p
        JOIN sales s ON s.id = p.sale_id
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE ${inFilter}
      `, { replacements });
      totalIn = parseFloat(row.total_in);

      const [methodRows] = await sequelize.query(`
        SELECT p.method, COALESCE(SUM(p.amount), 0) AS amount
        FROM payments p
        JOIN sales s ON s.id = p.sale_id
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE ${inFilter}
        GROUP BY p.method
      `, { replacements });
      inMethodRows = methodRows;
    }

    if (direction !== 'IN') {
      const [[row]] = await sequelize.query(`
        SELECT COALESCE(SUM(sp.amount), 0) AS total_out
        FROM supplier_payments sp
        JOIN purchases pur ON pur.id = sp.purchase_id
        LEFT JOIN suppliers sup ON sup.id = pur.supplier_id
        WHERE ${outFilter}
      `, { replacements });
      totalOut = parseFloat(row.total_out);

      const [methodRows] = await sequelize.query(`
        SELECT sp.method, COALESCE(SUM(sp.amount), 0) AS amount
        FROM supplier_payments sp
        JOIN purchases pur ON pur.id = sp.purchase_id
        LEFT JOIN suppliers sup ON sup.id = pur.supplier_id
        WHERE ${outFilter}
        GROUP BY sp.method
      `, { replacements });
      outMethodRows = methodRows;
    }

    const byMethod = [
      ...inMethodRows.map((r) => ({ method: r.method, direction: 'IN',  amount: parseFloat(r.amount) })),
      ...outMethodRows.map((r) => ({ method: r.method, direction: 'OUT', amount: parseFloat(r.amount) })),
    ];

    ApiResponse.success(res, {
      summary: {
        total_in:  totalIn,
        total_out: totalOut,
        net: Math.round((totalIn - totalOut) * 100) / 100,
        by_method: byMethod,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listPayments, summary };
