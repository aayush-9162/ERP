const { UserCompany, Company, Tenant } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Company context middleware.
 *
 * 1. Reads x-company-id header or falls back to user's first company
 * 2. Verifies user membership
 * 3. Checks tenant is active (SaaS gate)
 * 4. Sets req.companyId — EVERY controller/service must use this
 * 5. Sets req.body.company_id so create operations auto-include it
 * 6. Sets req.companyWhere = { company_id: N } for convenient WHERE injection
 * 7. Sets req.tenantCountry for tax/localization logic
 */
async function companyScope(req, res, next) {
  try {
    // Super admins bypass company scope
    if (req.user.is_super_admin) return next();

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

    // Check tenant status (SaaS gate)
    const company = await Company.findByPk(resolvedCompanyId, {
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'status', 'country', 'currency', 'plan', 'trial_ends_at'] }],
    });

    if (company?.tenant) {
      const tenant = company.tenant;
      if (tenant.status === 'suspended') {
        throw ApiError.forbidden('Your account has been suspended. Please contact support.');
      }
      if (tenant.status === 'cancelled') {
        throw ApiError.forbidden('Your account has been cancelled.');
      }
      if (tenant.status === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
        throw ApiError.forbidden('Your trial has expired. Please upgrade your plan.');
      }
      req.tenantCountry = tenant.country;
      req.tenantCurrency = tenant.currency;
      req.tenantPlan = tenant.plan;
      req.tenantId = tenant.id;
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
