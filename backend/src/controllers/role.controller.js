const { Role, Permission } = require('../models');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/roles
async function getRoles(req, res, next) {
  try {
    const roles = await Role.findAll({
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });
    ApiResponse.success(res, { roles });
  } catch (error) {
    next(error);
  }
}

module.exports = { getRoles };
