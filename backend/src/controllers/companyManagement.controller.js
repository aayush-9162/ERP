const { Company, UserCompany, User, Role } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/companies — list user's companies
async function getMyCompanies(req, res, next) {
  try {
    const memberships = await UserCompany.findAll({
      where: { user_id: req.user.id, status: 'active' },
      include: [
        { association: 'company' },
        { association: 'role', attributes: ['id', 'name'] },
      ],
    });
    ApiResponse.success(res, {
      companies: memberships.map((m) => ({
        ...m.company.toJSON(),
        role: m.role,
        membership_id: m.id,
      })),
    });
  } catch (error) { next(error); }
}

// POST /api/companies — create a new company
async function createCompany(req, res, next) {
  try {
    const { name, gst_number, pan_number, address_line1, city, state, pincode, country, currency, phone, email } = req.body;

    const company = await Company.create({
      name, gst_number, pan_number, address_line1, city, state, pincode,
      country: country || 'India', currency: currency || 'INR',
      phone, email, owner_id: req.user.id,
    });

    // Add creator as Admin of this company
    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    await UserCompany.create({
      user_id: req.user.id,
      company_id: company.id,
      role_id: adminRole.id,
      status: 'active',
    });

    ApiResponse.created(res, { company }, 'Company created');
  } catch (error) { next(error); }
}

// PUT /api/companies/:id — update company profile
async function updateCompany(req, res, next) {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) throw ApiError.notFound('Company not found');

    // Verify user is admin of this company
    const membership = await UserCompany.findOne({
      where: { user_id: req.user.id, company_id: company.id, status: 'active' },
      include: [{ association: 'role' }],
    });
    if (!membership || membership.role.name !== 'admin') {
      throw ApiError.forbidden('Only company admin can update company profile');
    }

    const fields = ['name', 'gst_number', 'pan_number', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'country', 'currency', 'phone', 'email', 'website', 'logo_url'];
    const updates = {};
    for (const f of fields) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }

    await company.update(updates);
    ApiResponse.success(res, { company }, 'Company updated');
  } catch (error) { next(error); }
}

// GET /api/companies/:id/team — list company members
async function getTeam(req, res, next) {
  try {
    const members = await UserCompany.findAll({
      where: { company_id: req.params.id },
      include: [
        { association: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
        { association: 'role', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'ASC']],
    });
    ApiResponse.success(res, { members });
  } catch (error) { next(error); }
}

// POST /api/companies/:id/invite — add user to company
// If user exists: add them to the company
// If user doesn't exist: create account with a temp password, then add to company
async function inviteUser(req, res, next) {
  try {
    const { email, role_id, first_name, last_name, phone, password } = req.body;
    if (!email) throw ApiError.badRequest('Email is required');

    const company = await Company.findByPk(req.params.id);
    if (!company) throw ApiError.notFound('Company not found');

    const role = await Role.findByPk(role_id || 3); // default to staff
    if (!role) throw ApiError.badRequest('Invalid role');

    // Find existing user or create new one
    let user = await User.findOne({ where: { email } });
    let isNewUser = false;

    if (!user) {
      // Create new user account
      if (!first_name) throw ApiError.badRequest('First name is required for new users');

      const userPassword = password || 'Welcome@123'; // Default temp password
      user = await User.create({
        first_name,
        last_name: last_name || '',
        email,
        password: userPassword,
        phone: phone || null,
        role_id: role.id,
        status: 'active',
        must_change_password: true,
      });
      isNewUser = true;
    }

    // Check if already a member of this company
    const existing = await UserCompany.findOne({
      where: { user_id: user.id, company_id: company.id },
    });
    if (existing && existing.status === 'active') {
      throw ApiError.conflict('User is already a member of this company');
    }

    // Add to company (create or reactivate)
    if (existing) {
      await existing.update({ role_id: role.id, status: 'active' });
    } else {
      await UserCompany.create({
        user_id: user.id, company_id: company.id,
        role_id: role.id, status: 'active',
      });
    }

    ApiResponse.created(res, {
      user: { id: user.id, email: user.email, first_name: user.first_name },
      role,
      is_new_user: isNewUser,
      temp_password: isNewUser ? 'Welcome@123' : undefined,
    }, isNewUser ? 'New user created and added to company' : 'User added to company');
  } catch (error) { next(error); }
}

// DELETE /api/companies/:id/team/:userId — remove user from company
async function removeUser(req, res, next) {
  try {
    const membership = await UserCompany.findOne({
      where: { user_id: req.params.userId, company_id: req.params.id },
    });
    if (!membership) throw ApiError.notFound('User not in this company');
    if (parseInt(req.params.userId) === req.user.id) {
      throw ApiError.badRequest('Cannot remove yourself');
    }

    await membership.update({ status: 'removed' });
    ApiResponse.success(res, null, 'User removed from company');
  } catch (error) { next(error); }
}

// POST /api/companies/:id/team/:userId/reset-password — admin resets a member's password
async function resetMemberPassword(req, res, next) {
  try {
    const companyId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    const callerMembership = await UserCompany.findOne({
      where: { user_id: req.user.id, company_id: companyId, status: 'active' },
      include: [{ association: 'role' }],
    });
    if (!callerMembership || callerMembership.role.name !== 'admin') {
      throw ApiError.forbidden('Only company admin can reset passwords');
    }

    if (userId === req.user.id) {
      throw ApiError.badRequest('Use your profile to change your own password');
    }

    const targetMembership = await UserCompany.findOne({
      where: { user_id: userId, company_id: companyId },
    });
    if (!targetMembership) throw ApiError.notFound('User not in this company');

    const user = await User.findByPk(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.is_super_admin) throw ApiError.forbidden('Cannot reset super admin password');

    const tempPassword = 'Welcome@123';
    await user.update({ password: tempPassword, must_change_password: true });

    ApiResponse.success(res, { email: user.email, temp_password: tempPassword }, 'Password reset');
  } catch (error) { next(error); }
}

// POST /api/companies/switch — switch active company (returns updated token context)
async function switchCompany(req, res, next) {
  try {
    const { company_id } = req.body;
    const membership = await UserCompany.findOne({
      where: { user_id: req.user.id, company_id, status: 'active' },
      include: [{ association: 'company' }, { association: 'role' }],
    });
    if (!membership) throw ApiError.forbidden('You do not have access to this company');

    ApiResponse.success(res, {
      company: membership.company,
      role: membership.role,
      company_id: membership.company_id,
    }, 'Company switched');
  } catch (error) { next(error); }
}

module.exports = { getMyCompanies, createCompany, updateCompany, getTeam, inviteUser, removeUser, resetMemberPassword, switchCompany };
