const { Tenant, User, Company, UserCompany, Role, sequelize, Sale, Purchase, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const bcrypt = require('bcryptjs');

const COUNTRY_CURRENCY_MAP = {
  IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED',
};

const PLAN_LIMITS = {
  trial:        { max_users: 3,  max_companies: 1 },
  basic:        { max_users: 10, max_companies: 2 },
  professional: { max_users: 50, max_companies: 5 },
  enterprise:   { max_users: 500, max_companies: 50 },
};

// ==================== Dashboard ====================

async function getDashboardStats(req, res, next) {
  try {
    const [tenantStats] = await sequelize.query(`
      SELECT
        COUNT(*) AS total_tenants,
        SUM(status = 'active') AS active_tenants,
        SUM(status = 'trial') AS trial_tenants,
        SUM(status = 'suspended') AS suspended_tenants,
        SUM(status = 'cancelled') AS cancelled_tenants
      FROM tenants
    `, { type: sequelize.QueryTypes.SELECT });

    const [userStats] = await sequelize.query(`
      SELECT
        COUNT(*) AS total_users,
        SUM(status = 'active') AS active_users,
        SUM(is_super_admin = 1) AS super_admins
      FROM users
    `, { type: sequelize.QueryTypes.SELECT });

    const [companyCount] = await sequelize.query(`
      SELECT COUNT(*) AS total_companies FROM companies
    `, { type: sequelize.QueryTypes.SELECT });

    const [revenueStats] = await sequelize.query(`
      SELECT
        COALESCE(SUM(final_amount), 0) AS total_platform_revenue,
        COUNT(*) AS total_sales
      FROM sales
    `, { type: sequelize.QueryTypes.SELECT });

    const recentTenants = await Tenant.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    ApiResponse.success(res, {
      tenants: tenantStats,
      users: userStats,
      companies: companyCount,
      revenue: revenueStats,
      recentTenants,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Tenant CRUD ====================

async function listTenants(req, res, next) {
  try {
    const { page = 1, limit = 20, status, search, country } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;
    if (country) where.country = country;
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { business_name: { [Op.like]: `%${search}%` } },
        { owner_email: { [Op.like]: `%${search}%` } },
        { owner_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Tenant.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    ApiResponse.paginated(res, { rows, count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
}

async function getTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.params.id, {
      include: [
        { model: User, as: 'users', attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'createdAt'] },
        { model: Company, as: 'companies', attributes: ['id', 'name', 'city', 'state', 'country', 'currency'] },
      ],
    });
    if (!tenant) throw ApiError.notFound('Tenant not found');

    ApiResponse.success(res, tenant);
  } catch (error) {
    next(error);
  }
}

async function createTenant(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const {
      business_name, owner_name, owner_email, owner_phone,
      country = 'IN', plan = 'trial', address, gst_number, notes,
    } = req.body;

    if (!business_name || !owner_name || !owner_email) {
      throw ApiError.badRequest('business_name, owner_name, and owner_email are required');
    }

    // Generate slug
    const slug = business_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80)
      + '-' + Date.now().toString(36);

    const currency = COUNTRY_CURRENCY_MAP[country] || 'USD';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;

    // Create tenant
    const tenant = await Tenant.create({
      business_name, slug, owner_name, owner_email, owner_phone,
      country, currency, plan,
      max_users: limits.max_users,
      max_companies: limits.max_companies,
      status: plan === 'trial' ? 'trial' : 'active',
      trial_ends_at: plan === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
      address, gst_number, notes,
    }, { transaction: t });

    // Create owner user account (or find existing)
    let ownerUser = await User.findOne({ where: { email: owner_email } });
    const tempPassword = 'Welcome@123';

    const adminRole = await Role.findOne({ where: { name: 'admin' } });

    if (!ownerUser) {
      const nameParts = owner_name.split(' ');
      ownerUser = await User.create({
        first_name: nameParts[0] || 'Owner',
        last_name: nameParts.slice(1).join(' ') || '',
        email: owner_email,
        password: tempPassword,
        phone: owner_phone,
        role_id: adminRole.id,
        status: 'active',
        tenant_id: tenant.id,
      }, { transaction: t });
    } else {
      await ownerUser.update({ tenant_id: tenant.id }, { transaction: t });
    }

    // Create default company for this tenant
    const company = await Company.create({
      name: business_name,
      country: country === 'IN' ? 'India' : country === 'US' ? 'United States' : country === 'GB' ? 'United Kingdom' : country === 'AE' ? 'UAE' : country,
      currency,
      owner_id: ownerUser.id,
      tenant_id: tenant.id,
      gst_number: gst_number || null,
    }, { transaction: t });

    // Link owner to company as admin
    await UserCompany.create({
      user_id: ownerUser.id,
      company_id: company.id,
      role_id: adminRole.id,
      status: 'active',
    }, { transaction: t });

    await t.commit();

    ApiResponse.created(res, {
      tenant,
      owner: { id: ownerUser.id, email: ownerUser.email, temp_password: tempPassword },
      company: { id: company.id, name: company.name },
    }, 'Tenant created successfully');
  } catch (error) {
    await t.rollback();
    next(error);
  }
}

async function updateTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const {
      business_name, owner_name, owner_phone,
      country, plan, status, address, gst_number, notes,
      max_users, max_companies,
    } = req.body;

    const updates = {};
    if (business_name !== undefined) updates.business_name = business_name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (owner_phone !== undefined) updates.owner_phone = owner_phone;
    if (address !== undefined) updates.address = address;
    if (gst_number !== undefined) updates.gst_number = gst_number;
    if (notes !== undefined) updates.notes = notes;

    if (country !== undefined) {
      updates.country = country;
      updates.currency = COUNTRY_CURRENCY_MAP[country] || tenant.currency;
    }

    if (plan !== undefined) {
      updates.plan = plan;
      const limits = PLAN_LIMITS[plan];
      if (limits) {
        updates.max_users = max_users || limits.max_users;
        updates.max_companies = max_companies || limits.max_companies;
      }
    } else {
      if (max_users !== undefined) updates.max_users = max_users;
      if (max_companies !== undefined) updates.max_companies = max_companies;
    }

    if (status !== undefined) updates.status = status;

    await tenant.update(updates);

    ApiResponse.success(res, tenant, 'Tenant updated');
  } catch (error) {
    next(error);
  }
}

async function suspendTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    await tenant.update({ status: 'suspended' });

    // Deactivate all tenant users
    await User.update(
      { status: 'inactive' },
      { where: { tenant_id: tenant.id } }
    );

    ApiResponse.success(res, tenant, 'Tenant suspended');
  } catch (error) {
    next(error);
  }
}

async function activateTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    await tenant.update({ status: 'active' });

    // Reactivate all tenant users
    await User.update(
      { status: 'active' },
      { where: { tenant_id: tenant.id } }
    );

    ApiResponse.success(res, tenant, 'Tenant activated');
  } catch (error) {
    next(error);
  }
}

async function deleteTenant(req, res, next) {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    // Soft delete: just cancel
    await tenant.update({ status: 'cancelled' });
    await User.update({ status: 'inactive' }, { where: { tenant_id: tenant.id } });

    ApiResponse.success(res, null, 'Tenant cancelled');
  } catch (error) {
    next(error);
  }
}

// ==================== Tenant Users ====================

async function listAllUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search, tenant_id, status } = req.query;
    const offset = (page - 1) * limit;
    const where = { is_super_admin: false };

    if (status) where.status = status;
    if (tenant_id) where.tenant_id = parseInt(tenant_id);
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'status', 'tenant_id', 'last_login', 'createdAt'],
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'business_name', 'country', 'plan'] },
        { model: Role, as: 'role', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    ApiResponse.paginated(res, { rows, count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
}

async function getTenantUsers(req, res, next) {
  try {
    const users = await User.findAll({
      where: { tenant_id: req.params.id, is_super_admin: false },
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'status', 'last_login', 'createdAt'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
      order: [['createdAt', 'ASC']],
    });

    ApiResponse.success(res, users);
  } catch (error) {
    next(error);
  }
}

async function toggleUserStatus(req, res, next) {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.is_super_admin) throw ApiError.forbidden('Cannot modify super admin');

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await user.update({ status: newStatus });

    ApiResponse.success(res, { id: user.id, status: newStatus }, `User ${newStatus}`);
  } catch (error) {
    next(error);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.is_super_admin) throw ApiError.forbidden('Cannot reset super admin password from here');

    const tempPassword = 'Welcome@123';
    await user.update({ password: tempPassword });

    ApiResponse.success(res, { email: user.email, temp_password: tempPassword }, 'Password reset');
  } catch (error) {
    next(error);
  }
}

// ==================== Tenant Stats (per-tenant detail) ====================

async function getTenantStats(req, res, next) {
  try {
    const tenantId = req.params.id;
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const userCount = await User.count({ where: { tenant_id: tenantId } });
    const companyCount = await Company.count({ where: { tenant_id: tenantId } });

    // Get company IDs for this tenant
    const companies = await Company.findAll({
      where: { tenant_id: tenantId },
      attributes: ['id'],
      raw: true,
    });
    const companyIds = companies.map(c => c.id);

    let salesTotal = 0, salesCount = 0, purchaseTotal = 0, productCount = 0;

    if (companyIds.length > 0) {
      const [salesStats] = await sequelize.query(`
        SELECT COALESCE(SUM(final_amount), 0) AS total, COUNT(*) AS cnt
        FROM sales WHERE company_id IN (:ids)
      `, { replacements: { ids: companyIds }, type: sequelize.QueryTypes.SELECT });
      salesTotal = salesStats.total;
      salesCount = salesStats.cnt;

      const [purchaseStats] = await sequelize.query(`
        SELECT COALESCE(SUM(final_amount), 0) AS total FROM purchases WHERE company_id IN (:ids)
      `, { replacements: { ids: companyIds }, type: sequelize.QueryTypes.SELECT });
      purchaseTotal = purchaseStats.total;

      productCount = await Product.count({ where: { company_id: companyIds } });
    }

    ApiResponse.success(res, {
      tenant,
      usage: {
        users: userCount,
        max_users: tenant.max_users,
        companies: companyCount,
        max_companies: tenant.max_companies,
        products: productCount,
        sales: { count: salesCount, total: salesTotal },
        purchases: { total: purchaseTotal },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Super Admin Auth ====================

async function superAdminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const jwt = require('jsonwebtoken');

    const user = await User.findOne({
      where: { email, is_super_admin: true },
      include: [{ model: Role, as: 'role' }],
    });

    if (!user || !(await user.validatePassword(password))) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden('Account deactivated');
    }

    await user.update({ last_login: new Date() });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role?.name, is_super_admin: true },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    ApiResponse.success(res, { user, token }, 'Super admin login successful');
  } catch (error) {
    next(error);
  }
}

// ==================== Platform Settings (country list) ====================

async function getCountryOptions(req, res, next) {
  try {
    ApiResponse.success(res, {
      countries: [
        { code: 'IN', name: 'India', currency: 'INR', taxSystem: 'GST (CGST+SGST/IGST)' },
        { code: 'US', name: 'United States', currency: 'USD', taxSystem: 'State Sales Tax' },
        { code: 'GB', name: 'United Kingdom', currency: 'GBP', taxSystem: 'VAT' },
        { code: 'AE', name: 'UAE', currency: 'AED', taxSystem: 'VAT 5%' },
      ],
      plans: [
        { value: 'trial', label: 'Trial (14 days)', users: 3, companies: 1 },
        { value: 'basic', label: 'Basic', users: 10, companies: 2 },
        { value: 'professional', label: 'Professional', users: 50, companies: 5 },
        { value: 'enterprise', label: 'Enterprise', users: 500, companies: 50 },
      ],
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardStats, listTenants, getTenant, createTenant, updateTenant,
  suspendTenant, activateTenant, deleteTenant,
  listAllUsers, getTenantUsers, toggleUserStatus, resetUserPassword,
  getTenantStats, superAdminLogin, getCountryOptions,
};
