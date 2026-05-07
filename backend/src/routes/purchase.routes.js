const router = require('express').Router();
const ctrl = require('../controllers/purchase.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createPurchaseValidation, supplierPaymentValidation } = require('../validators/purchase.validator');
const { ROLES } = require('../config/constants');


router.get('/summary', ctrl.getPurchaseSummary);
router.get('/', ctrl.getPurchases);
router.get('/:id', ctrl.getPurchase);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), validate(createPurchaseValidation), ctrl.createPurchase);

router.get('/:id/payments', ctrl.getPayments);
router.post('/:id/payments', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(supplierPaymentValidation), ctrl.addPayment);

module.exports = router;
