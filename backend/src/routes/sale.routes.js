const router = require('express').Router();
const ctrl = require('../controllers/sale.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createSaleValidation, paymentValidation } = require('../validators/sales.validator');
const { ROLES } = require('../config/constants');


router.get('/summary', ctrl.getSalesSummary);
router.get('/', ctrl.getSales);
router.get('/:id', ctrl.getSale);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), validate(createSaleValidation), ctrl.createSale);

// Payments sub-resource
router.get('/:id/payments', ctrl.getPayments);
router.post('/:id/payments', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(paymentValidation), ctrl.addPayment);

// E-Invoice
const einvoiceCtrl = require('../controllers/einvoice.controller');
router.post('/:id/e-invoice', authorize(ROLES.ADMIN, ROLES.MANAGER), einvoiceCtrl.generateEInvoice);

module.exports = router;
