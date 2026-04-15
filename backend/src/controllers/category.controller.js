const { Category } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/categories
async function getCategories(req, res, next) {
  try {
    const { status } = req.query;
    const where = { company_id: req.companyId };
    if (status) where.status = status;

    const categories = await Category.findAll({ where, order: [['name', 'ASC']] });
    ApiResponse.success(res, { categories });
  } catch (error) {
    next(error);
  }
}

// GET /api/categories/:id
async function getCategory(req, res, next) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) throw ApiError.notFound('Category not found');
    ApiResponse.success(res, { category });
  } catch (error) {
    next(error);
  }
}

// POST /api/categories
async function createCategory(req, res, next) {
  try {
    const { name, description } = req.body;
    const existing = await Category.findOne({ where: { name } });
    if (existing) throw ApiError.conflict('Category name already exists');

    const category = await Category.create({ name, description });
    ApiResponse.created(res, { category });
  } catch (error) {
    next(error);
  }
}

// PUT /api/categories/:id
async function updateCategory(req, res, next) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) throw ApiError.notFound('Category not found');

    const { name, description, status } = req.body;
    if (name && name !== category.name) {
      const dup = await Category.findOne({ where: { name } });
      if (dup) throw ApiError.conflict('Category name already exists');
    }

    await category.update({ name: name ?? category.name, description, status });
    ApiResponse.success(res, { category }, 'Category updated');
  } catch (error) {
    next(error);
  }
}

// DELETE /api/categories/:id
async function deleteCategory(req, res, next) {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) throw ApiError.notFound('Category not found');
    await category.update({ status: 'inactive' });
    ApiResponse.success(res, null, 'Category deactivated');
  } catch (error) {
    next(error);
  }
}

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
