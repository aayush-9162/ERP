const { Op } = require('sequelize');
const { Supplier } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

async function getSuppliers(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { search, status } = req.query;

    const where = { company_id: req.companyId };
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const result = await Supplier.findAndCountAll({ where, limit, offset, order: [['name', 'ASC']] });
    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) { next(error); }
}

async function searchSuppliers(req, res, next) {
  try {
    const q = req.query.q || '';
    const where = {
      company_id: req.companyId,
      status: 'active',
    };
    if (q.trim()) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { address: { [Op.like]: `%${q}%` } },
      ];
    }
    const suppliers = await Supplier.findAll({
      where,
      limit: 10,
      order: [['name', 'ASC']],
    });
    ApiResponse.success(res, { suppliers });
  } catch (error) { next(error); }
}

async function getSupplier(req, res, next) {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) throw ApiError.notFound('Supplier not found');
    ApiResponse.success(res, { supplier });
  } catch (error) { next(error); }
}

async function createSupplier(req, res, next) {
  try {
    const { name, phone, email, address, gst_number } = req.body;
    const supplier = await Supplier.create({
      name, phone, email, address, gst_number,
      company_id: req.companyId,
    });
    ApiResponse.created(res, { supplier });
  } catch (error) { next(error); }
}

async function updateSupplier(req, res, next) {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) throw ApiError.notFound('Supplier not found');

    const allowed = ['name', 'phone', 'email', 'address', 'gst_number', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await supplier.update(updates);
    ApiResponse.success(res, { supplier }, 'Supplier updated');
  } catch (error) { next(error); }
}

module.exports = { getSuppliers, searchSuppliers, getSupplier, createSupplier, updateSupplier };
