const { UserCompany } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Company context middleware.
 *
 * 1. Reads x-company-id header or falls back to user's first company
 * 2. Verifies user membership
 * 3. Sets req.companyId — EVERY controller/service must use this
 * 4. Sets req.body.company_id so create operations auto-include it
 * 5. Sets req.companyWhere = { company_id: N } for convenient WHERE injection
 */
async function companyScope(req, res, next) {
  try {
    const companyId = parseInt(req.headers['x-company-id'], 10);

    let resolvedCompanyId;
    if (!companyId || isNaN(companyId)) {
      const uc = await UserCompany.findOne({
        where: { user_id: req.user.id, status: 'active' },
        order: [['id', 'ASC']],
      });
      if (!uc) throw ApiError.badRequest('No company associated with this user');
      resolvedCompanyId = uc.company_id;
      req.companyRole = uc.role_id;
    } else {
      const membership = await UserCompany.findOne({
        where: { user_id: req.user.id, company_id: companyId, status: 'active' },
      });
      if (!membership) throw ApiError.forbidden('You do not have access to this company');
      resolvedCompanyId = companyId;
      req.companyRole = membership.role_id;
    }

    req.companyId = resolvedCompanyId;
    req.companyWhere = { company_id: resolvedCompanyId };

    // Auto-inject company_id into request body for create operations
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body.company_id = resolvedCompanyId;
    }

    next();
  } catch (error) {
    next(error instanceof ApiError ? error : ApiError.internal('Company context error'));
  }
}

module.exports = { companyScope };
