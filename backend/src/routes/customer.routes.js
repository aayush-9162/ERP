const router = require('express').Router();
const ctrl = require('../controllers/customer.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { customerValidation } = require('../validators/sales.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getCustomers);
router.get('/search', ctrl.searchCustomers);
router.get('/:id', ctrl.getCustomer);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), validate(customerValidation), ctrl.createCustomer);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(customerValidation), ctrl.updateCustomer);

module.exports = router;
