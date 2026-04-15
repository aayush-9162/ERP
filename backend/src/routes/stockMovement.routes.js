const router = require('express').Router();
const ctrl = require('../controllers/stockMovement.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { stockMovementValidation } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getMovements);
router.get('/:productId/history', ctrl.getProductHistory);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(stockMovementValidation), ctrl.createMovement);

module.exports = router;
