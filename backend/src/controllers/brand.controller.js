const { Brand } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/brands
async function getBrands(req, res, next) {
  try {
    const { status } = req.query;
    const where = { company_id: req.companyId };
    if (status) where.status = status;

    const brands = await Brand.findAll({ where, order: [['name', 'ASC']] });
    ApiResponse.success(res, { brands });
  } catch (error) {
    next(error);
  }
}

// GET /api/brands/:id
async function getBrand(req, res, next) {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) throw ApiError.notFound('Brand not found');
    ApiResponse.success(res, { brand });
  } catch (error) {
    next(error);
  }
}

// POST /api/brands
async function createBrand(req, res, next) {
  try {
    const { name } = req.body;
    const existing = await Brand.findOne({ where: { name } });
    if (existing) throw ApiError.conflict('Brand name already exists');

    const brand = await Brand.create({ name });
    ApiResponse.created(res, { brand });
  } catch (error) {
    next(error);
  }
}

// PUT /api/brands/:id
async function updateBrand(req, res, next) {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) throw ApiError.notFound('Brand not found');

    const { name, status } = req.body;
    if (name && name !== brand.name) {
      const dup = await Brand.findOne({ where: { name } });
      if (dup) throw ApiError.conflict('Brand name already exists');
    }

    await brand.update({ name: name ?? brand.name, status });
    ApiResponse.success(res, { brand }, 'Brand updated');
  } catch (error) {
    next(error);
  }
}

// DELETE /api/brands/:id
async function deleteBrand(req, res, next) {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) throw ApiError.notFound('Brand not found');
    await brand.update({ status: 'inactive' });
    ApiResponse.success(res, null, 'Brand deactivated');
  } catch (error) {
    next(error);
  }
}

module.exports = { getBrands, getBrand, createBrand, updateBrand, deleteBrand };
