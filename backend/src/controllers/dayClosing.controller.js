const { sequelize, DayClosing, User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Aggregate sales + payment activity for a given business date in the given company.
 * Returns counts, amounts, and a method breakdown (received/paid).
 */
async function computeDaySummary(companyId, date) {
  // Use date boundaries so partial-day timestamps are caught
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);
  const repl  = { cid: companyId, start, end };

  const [[salesRow]] = await sequelize.query(`
    SELECT COUNT(*) AS count, COALESCE(SUM(final_amount), 0) AS amount
    FROM sales
    WHERE company_id = :cid AND created_at BETWEEN :start AND :end
  `, { replacements: repl });

  const [[purchasesRow]] = await sequelize.query(`
    SELECT COUNT(*) AS count, COALESCE(SUM(final_amount), 0) AS amount
    FROM purchases
    WHERE company_id = :cid AND created_at BETWEEN :start AND :end
  `, { replacements: repl });

  const [inMethods] = await sequelize.query(`
    SELECT p.method, COALESCE(SUM(p.amount), 0) AS amount
    FROM payments p
    JOIN sales s ON s.id = p.sale_id
    WHERE s.company_id = :cid AND p.created_at BETWEEN :start AND :end
    GROUP BY p.method
  `, { replacements: repl });

  const [outMethods] = await sequelize.query(`
    SELECT sp.method, COALESCE(SUM(sp.amount), 0) AS amount
    FROM supplier_payments sp
    JOIN purchases pur ON pur.id = sp.purchase_id
    WHERE pur.company_id = :cid AND sp.created_at BETWEEN :start AND :end
    GROUP BY sp.method
  `, { replacements: repl });

  const byMethod = [
    ...inMethods.map((r)  => ({ method: r.method, direction: 'IN',  amount: parseFloat(r.amount) })),
    ...outMethods.map((r) => ({ method: r.method, direction: 'OUT', amount: parseFloat(r.amount) })),
  ];
  const totalReceived = inMethods.reduce((s, r)  => s + parseFloat(r.amount), 0);
  const totalPaid     = outMethods.reduce((s, r) => s + parseFloat(r.amount), 0);
  const cashIn  = inMethods.find((r)  => r.method === 'CASH')?.amount || 0;
  const cashOut = outMethods.find((r) => r.method === 'CASH')?.amount || 0;

  return {
    business_date: date,
    total_sales_count:    parseInt(salesRow.count, 10),
    total_sales_amount:   parseFloat(salesRow.amount),
    total_purchases_count:  parseInt(purchasesRow.count, 10),
    total_purchases_amount: parseFloat(purchasesRow.amount),
    total_received: Math.round(totalReceived * 100) / 100,
    total_paid:     Math.round(totalPaid * 100) / 100,
    cash_in:  parseFloat(cashIn),
    cash_out: parseFloat(cashOut),
    by_method: byMethod,
  };
}

// GET /api/day-closing/summary?date=YYYY-MM-DD
async function getSummary(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const summary = await computeDaySummary(req.companyId, date);

    // Also return the existing closing (if any) so the UI can switch into read-only mode
    const existing = await DayClosing.findOne({
      where: { company_id: req.companyId, business_date: date },
      include: [{ association: 'closedBy', attributes: ['id', 'first_name', 'last_name'] }],
    });

    ApiResponse.success(res, { summary, existing });
  } catch (error) { next(error); }
}

// POST /api/day-closing
async function createClosing(req, res, next) {
  try {
    const { business_date, opening_cash = 0, counted_cash = 0, notes } = req.body;
    if (!business_date) throw ApiError.badRequest('business_date required (YYYY-MM-DD)');

    const existing = await DayClosing.findOne({
      where: { company_id: req.companyId, business_date },
    });
    if (existing) throw ApiError.conflict('This day has already been closed');

    const summary = await computeDaySummary(req.companyId, business_date);
    const expected = Math.round((parseFloat(opening_cash) + summary.cash_in - summary.cash_out) * 100) / 100;
    const variance = Math.round((parseFloat(counted_cash) - expected) * 100) / 100;

    const closing = await DayClosing.create({
      company_id: req.companyId,
      business_date,
      opening_cash,
      expected_cash: expected,
      counted_cash,
      variance,
      total_sales_count:    summary.total_sales_count,
      total_sales_amount:   summary.total_sales_amount,
      total_purchases_count:  summary.total_purchases_count,
      total_purchases_amount: summary.total_purchases_amount,
      total_received: summary.total_received,
      total_paid:     summary.total_paid,
      by_method:      summary.by_method,
      notes,
      closed_by: req.user.id,
    });

    ApiResponse.created(res, { closing }, 'Day closed');
  } catch (error) { next(error); }
}

// GET /api/day-closing
async function listClosings(req, res, next) {
  try {
    const page   = parseInt(req.query.page,  10) || 1;
    const limit  = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const result = await DayClosing.findAndCountAll({
      where: { company_id: req.companyId },
      include: [{ association: 'closedBy', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['business_date', 'DESC']],
      limit, offset,
    });

    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) { next(error); }
}

module.exports = { getSummary, createClosing, listClosings };
