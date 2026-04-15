const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { categoryValidation } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getCategories);
router.get('/:id', ctrl.getCategory);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(categoryValidation), ctrl.createCategory);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(categoryValidation), ctrl.updateCategory);
router.delete('/:id', authorize(ROLES.ADMIN), ctrl.deleteCategory);

module.exports = router;
