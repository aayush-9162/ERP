const { Op } = require('sequelize');
const { Quotation, QuotationItem, Customer, User } = require('../models');
const QuotationService = require('../services/quotation.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

async function createQuotation(req, res, next) {
  try {
    const quotation = await QuotationService.create(req.body, req.user.id);
    ApiResponse.created(res, { quotation }, 'Quotation created');
  } catch (e) { next(e); }
}

async function getQuotations(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = (page - 1) * limit;
    const { status, customer_id, search } = req.query;
    const where = { company_id: req.companyId };
    if (status) where.status = status;
    if (customer_id) where.customer_id = customer_id;
    if (search) where[Op.or] = [{ quotation_number: { [Op.like]: `%${search}%` } }];

    const result = await Quotation.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
      limit, offset, order: [['created_at', 'DESC']],
    });
    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (e) { next(e); }
}

async function getQuotation(req, res, next) {
  try {
    const quotation = await Quotation.findByPk(req.params.id, {
      include: [
        { model: QuotationItem, as: 'items' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });
    if (!quotation) throw ApiError.notFound('Quotation not found');
    ApiResponse.success(res, { quotation });
  } catch (e) { next(e); }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const quotation = await QuotationService.updateStatus(req.params.id, status);
    ApiResponse.success(res, { quotation }, 'Status updated');
  } catch (e) { next(e); }
}

async function convertToSale(req, res, next) {
  try {
    const { payment_method, paid_amount } = req.body;
    const result = await QuotationService.convertToSale(req.params.id, { payment_method, paid_amount }, req.user.id);
    ApiResponse.created(res, result, 'Quotation converted to sale');
  } catch (e) { next(e); }
}

module.exports = { createQuotation, getQuotations, getQuotation, updateStatus, convertToSale };
