const TaxService = require('../services/tax.service');
const CurrencyService = require('../services/currency.service');
const { TaxRule, Currency, ExchangeRate } = require('../models');
const countries = require('../config/countries');
const ApiResponse = require('../utils/ApiResponse');

// POST /api/tax/calculate
async function calculateTax(req, res, next) {
  try {
    const { seller, buyer, items } = req.body;
    const result = await TaxService.calculateInvoiceTax({ seller, buyer, items });
    ApiResponse.success(res, result);
  } catch (e) { next(e); }
}

// GET /api/tax/rules?country=IN
async function getTaxRules(req, res, next) {
  try {
    const where = { is_active: true };
    if (req.query.country) where.country = req.query.country.toUpperCase();
    if (req.query.state) where.state = req.query.state;
    const rules = await TaxRule.findAll({ where, order: [['country', 'ASC'], ['state', 'ASC'], ['tax_type', 'ASC']] });
    ApiResponse.success(res, { rules });
  } catch (e) { next(e); }
}

// GET /api/currency/list
async function getCurrencies(req, res, next) {
  try {
    const currencies = await CurrencyService.listCurrencies();
    ApiResponse.success(res, { currencies });
  } catch (e) { next(e); }
}

// GET /api/currency/rates
async function getExchangeRates(req, res, next) {
  try {
    const rates = await CurrencyService.listRates();
    ApiResponse.success(res, { rates });
  } catch (e) { next(e); }
}

// POST /api/currency/convert
async function convertCurrency(req, res, next) {
  try {
    const { amount, from, to } = req.body;
    const result = await CurrencyService.convert(parseFloat(amount), from, to);
    ApiResponse.success(res, result);
  } catch (e) { next(e); }
}

// GET /api/settings/country/:code
async function getCountryConfig(req, res, next) {
  try {
    const code = req.params.code?.toUpperCase();
    const config = countries[code];
    if (!config) return ApiResponse.success(res, { config: null, supported: Object.keys(countries) });
    ApiResponse.success(res, { config: { code, ...config } });
  } catch (e) { next(e); }
}

// GET /api/settings/countries
async function listCountries(req, res, next) {
  try {
    const list = Object.entries(countries).map(([code, c]) => ({
      code, name: c.name, currency: c.currency, taxSystem: c.taxSystem,
    }));
    ApiResponse.success(res, { countries: list });
  } catch (e) { next(e); }
}

module.exports = { calculateTax, getTaxRules, getCurrencies, getExchangeRates, convertCurrency, getCountryConfig, listCountries };
