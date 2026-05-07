const router = require('express').Router();
const ctrl = require('../controllers/supplier.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { supplierValidation } = require('../validators/purchase.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getSuppliers);
router.get('/search', ctrl.searchSuppliers);
router.get('/:id', ctrl.getSupplier);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), validate(supplierValidation), ctrl.createSupplier);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(supplierValidation), ctrl.updateSupplier);

module.exports = router;
