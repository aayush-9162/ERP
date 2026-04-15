const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authorize(ROLES.ADMIN, ROLES.MANAGER));

router.get('/sales', ctrl.salesReport);
router.get('/sales/top-products', ctrl.topProducts);
router.get('/purchases', ctrl.purchaseReport);
router.get('/purchases/suppliers', ctrl.supplierReport);
router.get('/inventory', ctrl.inventoryValuation);
router.get('/profit-loss', ctrl.profitAndLoss);
router.get('/customers', ctrl.customerReport);
router.get('/customers/:id/ledger', ctrl.customerLedger);

module.exports = router;
