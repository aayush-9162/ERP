/**
 * Localization utilities for multi-country support.
 * Reads country config from the active company context.
 */

const COUNTRY_CONFIG = {
  IN: { symbol: '₹', locale: 'en-IN', dateFormat: 'DD/MM/YYYY', taxLabel: 'GST' },
  US: { symbol: '$', locale: 'en-US', dateFormat: 'MM/DD/YYYY', taxLabel: 'Sales Tax' },
  GB: { symbol: '£', locale: 'en-GB', dateFormat: 'DD/MM/YYYY', taxLabel: 'VAT' },
  AE: { symbol: 'AED ', locale: 'en-AE', dateFormat: 'DD/MM/YYYY', taxLabel: 'VAT' },
};

/**
 * Format currency amount based on country.
 */
export function formatCurrency(amount, countryCode = 'IN', currencyCode = 'INR') {
  const config = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.IN;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${config.symbol}${Number(amount).toLocaleString(config.locale, { minimumFractionDigits: 2 })}`;
  }
}

/**
 * Format date based on country.
 */
export function formatDate(dateStr, countryCode = 'IN') {
  const config = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.IN;
  const date = new Date(dateStr);
  return date.toLocaleDateString(config.locale, { dateStyle: 'medium' });
}

/**
 * Get tax display label for a country.
 */
export function getTaxLabel(countryCode = 'IN') {
  return COUNTRY_CONFIG[countryCode]?.taxLabel || 'Tax';
}

/**
 * Get currency symbol.
 */
export function getCurrencySymbol(countryCode = 'IN') {
  return COUNTRY_CONFIG[countryCode]?.symbol || '₹';
}

export default COUNTRY_CONFIG;
