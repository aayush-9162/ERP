const { User, Role } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/users
async function getUsers(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { status, role_id, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (role_id) where.role_id = role_id;

    // Simple search by name or email
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const result = await User.findAndCountAll({
      where,
      include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) {
    next(error);
  }
}

// GET /api/users/:id
async function getUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Role, as: 'role' }],
    });
    if (!user) throw ApiError.notFound('User not found');

    ApiResponse.success(res, { user });
  } catch (error) {
    next(error);
  }
}

// POST /api/users  (Admin creates a user)
async function createUser(req, res, next) {
  try {
    const { first_name, last_name, email, password, phone, role_id } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) throw ApiError.conflict('Email already in use');

    const role = await Role.findByPk(role_id);
    if (!role) throw ApiError.badRequest('Invalid role');

    const user = await User.create({ first_name, last_name, email, password, phone, role_id });
    const created = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }],
    });

    ApiResponse.created(res, { user: created }, 'User created');
  } catch (error) {
    next(error);
  }
}

// PUT /api/users/:id
async function updateUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw ApiError.notFound('User not found');

    const allowed = ['first_name', 'last_name', 'email', 'phone', 'role_id', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await user.update(updates);

    const updated = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }],
    });

    ApiResponse.success(res, { user: updated }, 'User updated');
  } catch (error) {
    next(error);
  }
}

// DELETE /api/users/:id  (soft-delete by deactivating)
async function deleteUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw ApiError.notFound('User not found');

    // Prevent self-deactivation
    if (user.id === req.user.id) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    await user.update({ status: 'inactive' });
    ApiResponse.success(res, null, 'User deactivated');
  } catch (error) {
    next(error);
  }
}

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
