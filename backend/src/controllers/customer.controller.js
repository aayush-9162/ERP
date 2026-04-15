const { Op } = require('sequelize');
const { Customer } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/customers
async function getCustomers(req, res, next) {
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

    const result = await Customer.findAndCountAll({
      where,
      limit,
      offset,
      order: [['name', 'ASC']],
    });

    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) {
    next(error);
  }
}

// GET /api/customers/search?q=  (quick search for POS dropdown)
async function searchCustomers(req, res, next) {
  try {
    const q = req.query.q || '';
    const customers = await Customer.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { phone: { [Op.like]: `%${q}%` } },
        ],
      },
      limit: 10,
      order: [['name', 'ASC']],
    });
    ApiResponse.success(res, { customers });
  } catch (error) {
    next(error);
  }
}

// GET /api/customers/:id
async function getCustomer(req, res, next) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');
    ApiResponse.success(res, { customer });
  } catch (error) {
    next(error);
  }
}

// POST /api/customers
async function createCustomer(req, res, next) {
  try {
    const { name, phone, email, address, gst_number } = req.body;
    const customer = await Customer.create({ name, phone, email, address, gst_number });
    ApiResponse.created(res, { customer });
  } catch (error) {
    next(error);
  }
}

// PUT /api/customers/:id
async function updateCustomer(req, res, next) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) throw ApiError.notFound('Customer not found');

    const allowed = ['name', 'phone', 'email', 'address', 'gst_number', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await customer.update(updates);
    ApiResponse.success(res, { customer }, 'Customer updated');
  } catch (error) {
    next(error);
  }
}

module.exports = { getCustomers, searchCustomers, getCustomer, createCustomer, updateCustomer };
