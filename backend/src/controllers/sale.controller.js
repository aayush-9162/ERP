const { Op } = require('sequelize');
const { Sale, SaleItem, Customer, User, Payment } = require('../models');
const SalesService = require('../services/sales.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// POST /api/sales
async function createSale(req, res, next) {
  try {
    const sale = await SalesService.createSale(req.body, req.user.id);
    ApiResponse.created(res, { sale }, 'Sale created successfully');
  } catch (error) {
    next(error);
  }
}

// GET /api/sales
async function getSales(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = (page - 1) * limit;
    const { payment_status, customer_id, from, to, search } = req.query;

    const where = { company_id: req.companyId };
    if (payment_status) where.payment_status = payment_status;
    if (customer_id) where.customer_id = customer_id;
    if (search) {
      where[Op.or] = [
        { invoice_number: { [Op.like]: `%${search}%` } },
      ];
    }
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const result = await Sale.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) {
    next(error);
  }
}

// GET /api/sales/:id
async function getSale(req, res, next) {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [
        { model: SaleItem, as: 'items' },
        { model: Customer, as: 'customer' },
        { model: Payment, as: 'payments' },
        { model: User, as: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });
    if (!sale) throw ApiError.notFound('Sale not found');
    ApiResponse.success(res, { sale });
  } catch (error) {
    next(error);
  }
}

// GET /api/sales/summary
async function getSalesSummary(req, res, next) {
  try {
    const summary = await SalesService.getSalesSummary();
    ApiResponse.success(res, { summary });
  } catch (error) {
    next(error);
  }
}

// POST /api/sales/:id/payments
async function addPayment(req, res, next) {
  try {
    const { amount, method, reference } = req.body;
    const result = await SalesService.addPayment(req.params.id, { amount, method, reference });
    ApiResponse.created(res, result, 'Payment recorded');
  } catch (error) {
    next(error);
  }
}

// GET /api/sales/:id/payments
async function getPayments(req, res, next) {
  try {
    const payments = await Payment.findAll({
      where: { sale_id: req.params.id },
      order: [['created_at', 'ASC']],
    });
    ApiResponse.success(res, { payments });
  } catch (error) {
    next(error);
  }
}

module.exports = { createSale, getSales, getSale, getSalesSummary, addPayment, getPayments };
