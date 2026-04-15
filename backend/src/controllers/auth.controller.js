const jwt = require('jsonwebtoken');
const { User, Role, UserCompany, Company } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

async function getUserCompanies(userId) {
  const memberships = await UserCompany.findAll({
    where: { user_id: userId, status: 'active' },
    include: [{ association: 'company', attributes: ['id', 'name', 'currency'] }, { association: 'role', attributes: ['id', 'name'] }],
  });
  return memberships.map((m) => ({ id: m.company.id, name: m.company.name, currency: m.company.currency, role: m.role.name }));
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role?.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    // Default new registrations to "staff" role
    const staffRole = await Role.findOne({ where: { name: 'staff' } });
    if (!staffRole) {
      throw ApiError.internal('Default role not found — run the seeder first');
    }

    const user = await User.create({
      first_name,
      last_name,
      email,
      password,
      phone,
      role_id: staffRole.id,
    });

    const userWithRole = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }],
    });

    const token = generateToken(userWithRole);

    ApiResponse.created(res, { user: userWithRole, token }, 'Registration successful');
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }],
    });

    if (!user || !(await user.validatePassword(password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden('Account is deactivated — contact admin');
    }

    await user.update({ last_login: new Date() });

    const token = generateToken(user);
    const companies = await getUserCompanies(user.id);

    ApiResponse.success(res, { user, token, companies }, 'Login successful');
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/me
async function getProfile(req, res, next) {
  try {
    const companies = await getUserCompanies(req.user.id);
    ApiResponse.success(res, { user: req.user, companies });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, getProfile };
