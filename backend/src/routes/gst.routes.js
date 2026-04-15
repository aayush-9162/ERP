const router = require('express').Router();
const ctrl = require('../controllers/gst.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authorize(ROLES.ADMIN, ROLES.MANAGER));

router.get('/gstr1', ctrl.getGSTR1);
router.get('/gstr1/csv', ctrl.exportGSTR1CSV);
router.get('/gstr3b', ctrl.getGSTR3B);

module.exports = router;
