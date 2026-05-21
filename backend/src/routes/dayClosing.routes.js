const router = require('express').Router();
const ctrl = require('../controllers/dayClosing.controller');
const { authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authorize(ROLES.ADMIN, ROLES.MANAGER));

router.get('/summary', ctrl.getSummary);
router.get('/',        ctrl.listClosings);
router.post('/',       ctrl.createClosing);

module.exports = router;
