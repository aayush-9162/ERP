const router = require('express').Router();
const ctrl = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getInventory);
router.get('/summary', ctrl.getInventorySummary);
router.get('/low-stock', ctrl.getLowStock);
router.get('/warehouses', ctrl.getWarehouses);
router.get('/reconcile', authorize(ROLES.ADMIN), ctrl.reconcileStock);

module.exports = router;
