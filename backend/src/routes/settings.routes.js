const router = require('express').Router();
const ctrl = require('../controllers/tax.controller');

router.get('/countries', ctrl.listCountries);
router.get('/country/:code', ctrl.getCountryConfig);

module.exports = router;
