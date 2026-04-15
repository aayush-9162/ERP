const { Company } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/company
async function getCompany(req, res, next) {
  try {
    // Single-tenant: always return the first (only) company record
    let company = await Company.findOne();
    if (!company) {
      throw ApiError.notFound('Company profile not set up yet');
    }
    ApiResponse.success(res, { company });
  } catch (error) {
    next(error);
  }
}

// PUT /api/company  (Admin only)
async function updateCompany(req, res, next) {
  try {
    let company = await Company.findOne();

    const fields = [
      'name', 'gst_number', 'pan_number',
      'address_line1', 'address_line2', 'city', 'state', 'pincode', 'country',
      'phone', 'email', 'website', 'logo_url',
    ];

    const updates = {};
    for (const key of fields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (company) {
      await company.update(updates);
    } else {
      // First-time setup
      if (!updates.name) {
        throw ApiError.badRequest('Company name is required for initial setup');
      }
      company = await Company.create(updates);
    }

    ApiResponse.success(res, { company }, 'Company profile updated');
  } catch (error) {
    next(error);
  }
}

module.exports = { getCompany, updateCompany };
