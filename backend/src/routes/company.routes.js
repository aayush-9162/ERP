const router = require('express').Router();
const { getCompany, updateCompany } = require('../controllers/company.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { companyValidation } = require('../validators/company.validator');
const { ROLES } = require('../config/constants');


router.get('/', getCompany);
router.put('/', authorize(ROLES.ADMIN), validate(companyValidation), updateCompany);

module.exports = router;
