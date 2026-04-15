const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const ApiError = require('../utils/ApiError');

// Verify JWT token and attach user to request
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token required');
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role, as: 'role' }],
    });

    if (!user || user.status !== 'active') {
      throw ApiError.unauthorized('User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : ApiError.unauthorized('Invalid token'));
  }
}

// Restrict access to specific roles
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role.name)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
