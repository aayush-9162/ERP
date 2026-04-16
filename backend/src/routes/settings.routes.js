const router = require('express').Router();
const ctrl = require('../controllers/tax.controller');
const countries = require('../config/countries');
const ApiResponse = require('../utils/ApiResponse');

router.get('/countries', ctrl.listCountries);
router.get('/country/:code', ctrl.getCountryConfig);

// GET /api/settings/tenant-config — returns country config based on tenant
router.get('/tenant-config', (req, res) => {
  const code = req.tenantCountry || 'IN';
  const config = countries[code];
  ApiResponse.success(res, {
    country: code,
    currency: req.tenantCurrency || 'INR',
    plan: req.tenantPlan || 'trial',
    config: config ? { code, ...config } : null,
  });
});

module.exports = router;
