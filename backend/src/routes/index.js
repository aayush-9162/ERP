const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');

// --- No company scope needed ---
router.use('/auth', require('./auth.routes'));
router.use('/companies', require('./companyManagement.routes'));

// --- Super Admin (SaaS platform management) ---
router.use('/super-admin', require('./superAdmin.routes'));

// --- Company-scoped routes (all business data) ---
// companyScope reads x-company-id header and attaches req.companyId
router.use(authenticate, companyScope);

router.use('/users', require('./user.routes'));
router.use('/company', require('./company.routes'));
router.use('/roles', require('./role.routes'));
router.use('/categories', require('./category.routes'));
router.use('/brands', require('./brand.routes'));
router.use('/products', require('./product.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/stock-movements', require('./stockMovement.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/suppliers', require('./supplier.routes'));
router.use('/purchases', require('./purchase.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/payments', require('./payments.routes'));
router.use('/day-closing', require('./dayClosing.routes'));
router.use('/accounting', require('./accounting.routes'));
router.use('/quotations', require('./quotation.routes'));
router.use('/gst', require('./gst.routes'));
router.use('/tax', require('./tax.routes'));
router.use('/currency', require('./currency.routes'));
router.use('/settings', require('./settings.routes'));

module.exports = router;
