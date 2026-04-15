const router = require('express').Router();
const ctrl = require('../controllers/quotation.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createQuotationValidation, updateStatusValidation, convertValidation } = require('../validators/quotation.validator');
const { ROLES } = require('../config/constants');


router.get('/', ctrl.getQuotations);
router.get('/:id', ctrl.getQuotation);
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), validate(createQuotationValidation), ctrl.createQuotation);
router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(updateStatusValidation), ctrl.updateStatus);
router.post('/:id/convert', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(convertValidation), ctrl.convertToSale);

module.exports = router;
