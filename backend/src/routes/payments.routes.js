const router = require('express').Router();
const ctrl = require('../controllers/payments.controller');
const { authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Financial reporting — admin/manager only
router.use(authorize(ROLES.ADMIN, ROLES.MANAGER));

router.get('/',        ctrl.listPayments);
router.get('/summary', ctrl.summary);

module.exports = router;
