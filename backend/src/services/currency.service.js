const { Currency, ExchangeRate } = require('../models');

/**
 * Currency conversion and formatting service.
 */
class CurrencyService {
  static _cache = {};

  /**
   * Convert amount from one currency to another.
   */
  static async convert(amount, fromCode, toCode) {
    if (fromCode === toCode) return { amount, rate: 1 };

    const rate = await CurrencyService.getRate(fromCode, toCode);
    const converted = Math.round(amount * rate * 100) / 100;
    return { amount: converted, rate };
  }

  /**
   * Get exchange rate between two currencies.
   */
  static async getRate(fromCode, toCode) {
    const key = `${fromCode}_${toCode}`;
    if (this._cache[key]) return this._cache[key];

    // Try direct rate
    let er = await ExchangeRate.findOne({ where: { from_currency: fromCode, to_currency: toCode } });
    if (er) {
      this._cache[key] = parseFloat(er.rate);
      return parseFloat(er.rate);
    }

    // Try inverse
    er = await ExchangeRate.findOne({ where: { from_currency: toCode, to_currency: fromCode } });
    if (er) {
      const inverseRate = Math.round((1 / parseFloat(er.rate)) * 1000000) / 1000000;
      this._cache[key] = inverseRate;
      return inverseRate;
    }

    throw new Error(`No exchange rate found for ${fromCode} → ${toCode}`);
  }

  /**
   * Get currency details (symbol, name, decimal places).
   */
  static async getCurrency(code) {
    return Currency.findByPk(code);
  }

  /**
   * Format amount with currency symbol.
   */
  static async formatAmount(amount, currencyCode) {
    const currency = await CurrencyService.getCurrency(currencyCode);
    if (!currency) return `${amount}`;

    const formatted = Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: currency.decimal_places,
      maximumFractionDigits: currency.decimal_places,
    });

    return `${currency.symbol}${formatted}`;
  }

  /**
   * List all currencies.
   */
  static async listCurrencies() {
    return Currency.findAll({ order: [['code', 'ASC']] });
  }

  /**
   * List all exchange rates.
   */
  static async listRates() {
    return ExchangeRate.findAll({ order: [['from_currency', 'ASC']] });
  }
}

module.exports = CurrencyService;
