const router = require('express').Router();
const ctrl = require('../controllers/brand.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { brandValidation } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getBrands);
router.get('/:id', ctrl.getBrand);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(brandValidation), ctrl.createBrand);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(brandValidation), ctrl.updateBrand);
router.delete('/:id', authorize(ROLES.ADMIN), ctrl.deleteBrand);

module.exports = router;
