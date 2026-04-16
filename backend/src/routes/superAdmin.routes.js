const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/superAdmin');
const ctrl = require('../controllers/superAdmin.controller');

// Public: Super admin login (separate from tenant user login)
router.post('/login', ctrl.superAdminLogin);

// All routes below require super admin authentication
router.use(authenticate, requireSuperAdmin);

// Dashboard
router.get('/dashboard', ctrl.getDashboardStats);

// Country & plan options (for dropdowns)
router.get('/options', ctrl.getCountryOptions);

// Tenants CRUD
router.get('/tenants', ctrl.listTenants);
router.get('/tenants/:id', ctrl.getTenant);
router.post('/tenants', ctrl.createTenant);
router.put('/tenants/:id', ctrl.updateTenant);
router.post('/tenants/:id/suspend', ctrl.suspendTenant);
router.post('/tenants/:id/activate', ctrl.activateTenant);
router.delete('/tenants/:id', ctrl.deleteTenant);

// Tenant stats
router.get('/tenants/:id/stats', ctrl.getTenantStats);

// Tenant users
router.get('/tenants/:id/users', ctrl.getTenantUsers);

// All users (platform-wide)
router.get('/users', ctrl.listAllUsers);
router.post('/users/:userId/toggle-status', ctrl.toggleUserStatus);
router.post('/users/:userId/reset-password', ctrl.resetUserPassword);

module.exports = router;
