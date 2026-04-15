const router = require('express').Router();
const ctrl = require('../controllers/tax.controller');

router.get('/list', ctrl.getCurrencies);
router.get('/rates', ctrl.getExchangeRates);
router.post('/convert', ctrl.convertCurrency);

module.exports = router;
