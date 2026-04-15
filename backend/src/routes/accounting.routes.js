const router = require('express').Router();
const ctrl = require('../controllers/accounting.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authorize(ROLES.ADMIN, ROLES.MANAGER));

router.get('/accounts', ctrl.getAccounts);
router.get('/accounts/:id/transactions', ctrl.getAccountTransactions);

module.exports = router;
