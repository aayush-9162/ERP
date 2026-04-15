/**
 * Country-specific configuration — drives localization across the ERP.
 *
 * To add a new country:
 * 1. Add an entry here with formatting rules
 * 2. Seed tax_rules for the country
 * 3. Add the currency to currencies table
 *
 * No code changes needed beyond this config + DB seeding.
 */
module.exports = {
  IN: {
    name: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    locale: 'en-IN',
    taxSystem: 'GST',
    taxDisplay: 'split', // show CGST+SGST or IGST separately
    taxIdLabel: 'GSTIN',
    taxIdFormat: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i,
    stateCodeSource: 'gstin', // extract state from first 2 chars of GSTIN
    invoiceTerms: 'E&OE — Errors and Omissions Excepted',
    states: {
      '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
      '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
      '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
      '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
      '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
      '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala',
      '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
    },
  },

  US: {
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    dateFormat: 'MM/DD/YYYY',
    locale: 'en-US',
    taxSystem: 'SALES_TAX',
    taxDisplay: 'single', // one "Sales Tax" line
    taxIdLabel: 'EIN',
    taxIdFormat: /^\d{2}-?\d{7}$/,
    stateCodeSource: 'address',
    invoiceTerms: 'Net 30 — Payment due within 30 days',
    states: {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
      CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
      FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
      IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
      KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
      MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
      MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
      NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
      NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
      OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
      SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
      VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
      WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
    },
  },

  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    dateFormat: 'DD/MM/YYYY',
    locale: 'en-GB',
    taxSystem: 'VAT',
    taxDisplay: 'single',
    taxIdLabel: 'VAT Number',
    taxIdFormat: /^GB\d{9}$/,
    stateCodeSource: 'address',
    invoiceTerms: 'Payment due within 30 days',
    states: {},
  },

  AE: {
    name: 'United Arab Emirates',
    currency: 'AED',
    currencySymbol: 'AED',
    dateFormat: 'DD/MM/YYYY',
    locale: 'en-AE',
    taxSystem: 'VAT',
    taxDisplay: 'single',
    taxIdLabel: 'TRN',
    taxIdFormat: /^\d{15}$/,
    stateCodeSource: 'address',
    invoiceTerms: '',
    states: {},
  },
};
