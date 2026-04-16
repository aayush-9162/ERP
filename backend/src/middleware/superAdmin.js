const ApiError = require('../utils/ApiError');

/**
 * Super Admin guard middleware.
 * Must be used AFTER authenticate middleware.
 * Checks that req.user.is_super_admin === true.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    return next(ApiError.forbidden('Super admin access required'));
  }
  next();
}

module.exports = { requireSuperAdmin };
