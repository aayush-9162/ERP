const router = require('express').Router();
const ctrl = require('../controllers/tax.controller');

router.post('/calculate', ctrl.calculateTax);
router.get('/rules', ctrl.getTaxRules);

module.exports = router;
