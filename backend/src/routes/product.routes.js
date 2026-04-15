const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createProductValidation, updateProductValidation } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getProducts);
router.get('/scan/:barcode', ctrl.scanBarcode);
router.post('/:id/barcode', authorize(ROLES.ADMIN, ROLES.MANAGER), ctrl.generateBarcode);
router.get('/:id', ctrl.getProduct);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(createProductValidation), ctrl.createProduct);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(updateProductValidation), ctrl.updateProduct);
router.delete('/:id', authorize(ROLES.ADMIN), ctrl.deleteProduct);

module.exports = router;
