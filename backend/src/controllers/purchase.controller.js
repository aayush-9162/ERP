const { Op } = require('sequelize');
const { Purchase, PurchaseItem, Supplier, User, SupplierPayment } = require('../models');
const PurchaseService = require('../services/purchase.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

async function createPurchase(req, res, next) {
  try {
    const purchase = await PurchaseService.createPurchase(req.body, req.user.id);
    ApiResponse.created(res, { purchase }, 'Purchase created successfully');
  } catch (error) { next(error); }
}

async function getPurchases(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = (page - 1) * limit;
    const { payment_status, supplier_id, from, to, search } = req.query;

    const where = { company_id: req.companyId };
    if (payment_status) where.payment_status = payment_status;
    if (supplier_id) where.supplier_id = supplier_id;
    if (search) where[Op.or] = [{ purchase_number: { [Op.like]: `%${search}%` } }];
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const result = await Purchase.findAndCountAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
      limit, offset,
      order: [['created_at', 'DESC']],
    });

    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) { next(error); }
}

async function getPurchase(req, res, next) {
  try {
    const purchase = await Purchase.findByPk(req.params.id, {
      include: [
        { model: PurchaseItem, as: 'items' },
        { model: Supplier, as: 'supplier' },
        { model: SupplierPayment, as: 'payments' },
        { model: User, as: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });
    if (!purchase) throw ApiError.notFound('Purchase not found');
    ApiResponse.success(res, { purchase });
  } catch (error) { next(error); }
}

async function getPurchaseSummary(req, res, next) {
  try {
    const summary = await PurchaseService.getPurchaseSummary(req.companyId);
    ApiResponse.success(res, { summary });
  } catch (error) { next(error); }
}

async function addPayment(req, res, next) {
  try {
    const { amount, method, reference } = req.body;
    const result = await PurchaseService.addPayment(req.params.id, { amount, method, reference });
    ApiResponse.created(res, result, 'Payment recorded');
  } catch (error) { next(error); }
}

async function getPayments(req, res, next) {
  try {
    const payments = await SupplierPayment.findAll({
      where: { purchase_id: req.params.id },
      order: [['created_at', 'ASC']],
    });
    ApiResponse.success(res, { payments });
  } catch (error) { next(error); }
}

module.exports = { createPurchase, getPurchases, getPurchase, getPurchaseSummary, addPayment, getPayments };
