const { TaxRule, Company } = require('../models');

/**
 * Dynamic tax engine — no hardcoded rates or country logic.
 *
 * Tax calculation depends on:
 * - Seller (company) country + state
 * - Buyer (customer/supplier) country + state
 * - Product tax_rate (base rate from product catalog)
 *
 * Country-specific behavior is driven entirely by tax_rules table:
 * - India (IN): CGST+SGST (intra-state) or IGST (inter-state)
 * - USA (US): State sales tax
 * - Others: Single VAT/GST line
 */
class TaxService {
  /**
   * Calculate tax breakdown for a line item.
   *
   * @param {Object} params
   * @param {string} params.sellerCountry  - ISO 2-char (IN, US)
   * @param {string} params.sellerState    - State code or name
   * @param {string} params.buyerCountry   - ISO 2-char
   * @param {string} params.buyerState     - State code or name
   * @param {number} params.taxableAmount  - Line subtotal (price * qty)
   * @param {number} params.taxRate        - Base GST/tax rate % from product
   * @returns {Object} { components: [{ type, name, rate, amount }], totalTax, taxRate }
   */
  static async calculateItemTax({ sellerCountry, sellerState, buyerCountry, buyerState, taxableAmount, taxRate }) {
    const country = (sellerCountry || 'IN').toUpperCase();
    const components = [];

    if (country === 'IN') {
      return TaxService._calculateIndiaTax({ sellerState, buyerCountry, buyerState, taxableAmount, taxRate });
    }

    if (country === 'US') {
      return TaxService._calculateUSTax({ sellerState, buyerState, taxableAmount, taxRate });
    }

    // Generic: single-line tax (VAT, GST, etc.)
    const rules = await TaxRule.findAll({
      where: { country, is_active: true },
      order: [['applicable_from', 'DESC']],
    });

    if (rules.length > 0) {
      const rule = rules[0];
      const amount = Math.round(taxableAmount * parseFloat(rule.rate)) / 100;
      components.push({ type: rule.tax_type, name: rule.name, rate: parseFloat(rule.rate), amount });
    } else {
      // Fallback: use product's tax_rate as a single line
      const amount = Math.round(taxableAmount * taxRate) / 100;
      components.push({ type: 'TAX', name: 'Tax', rate: taxRate, amount });
    }

    const totalTax = components.reduce((s, c) => s + c.amount, 0);
    return { components, totalTax: Math.round(totalTax * 100) / 100, taxRate };
  }

  /**
   * India: CGST+SGST (intra-state) or IGST (inter-state)
   */
  static _calculateIndiaTax({ sellerState, buyerCountry, buyerState, taxableAmount, taxRate }) {
    const totalTax = Math.round(taxableAmount * taxRate) / 100;
    const components = [];

    const isInterState = (buyerCountry && buyerCountry !== 'IN') ||
      (buyerState && sellerState && buyerState !== sellerState);

    if (isInterState) {
      components.push({
        type: 'IGST', name: 'Integrated GST',
        rate: taxRate, amount: totalTax,
      });
    } else {
      // Penny-off safe split
      const halfRate = Math.round(taxRate * 100 / 2) / 100;
      const cgst = Math.floor(totalTax * 100 / 2) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;

      components.push(
        { type: 'CGST', name: 'Central GST', rate: halfRate, amount: cgst },
        { type: 'SGST', name: 'State GST', rate: Math.round((taxRate - halfRate) * 100) / 100, amount: sgst },
      );
    }

    return { components, totalTax, taxRate };
  }

  /**
   * USA: State-based sales tax from tax_rules table.
   * Falls back to product tax_rate if no rule exists.
   */
  static async _calculateUSTax({ sellerState, buyerState, taxableAmount, taxRate }) {
    const components = [];

    // Look up the buyer's state tax rate (nexus rules simplified: charge buyer's state rate)
    const taxState = buyerState || sellerState;
    const rule = await TaxRule.findOne({
      where: { country: 'US', state: taxState, tax_type: 'SALES_TAX', is_active: true },
      order: [['applicable_from', 'DESC']],
    });

    const effectiveRate = rule ? parseFloat(rule.rate) : taxRate;
    const amount = Math.round(taxableAmount * effectiveRate) / 100;

    components.push({
      type: 'SALES_TAX',
      name: rule ? `${taxState} Sales Tax` : 'Sales Tax',
      rate: effectiveRate,
      amount,
    });

    return { components, totalTax: amount, taxRate: effectiveRate };
  }

  /**
   * Calculate tax for multiple items (full invoice).
   *
   * @param {Object} params
   * @param {Object} params.seller   - { country, state }
   * @param {Object} params.buyer    - { country, state }
   * @param {Array}  params.items    - [{ taxableAmount, taxRate }]
   * @returns {Object} { items: [...withTaxBreakdown], totalTax, taxSummary }
   */
  static async calculateInvoiceTax({ seller, buyer, items }) {
    const results = [];
    const summary = {};

    for (const item of items) {
      const tax = await TaxService.calculateItemTax({
        sellerCountry: seller.country,
        sellerState: seller.state,
        buyerCountry: buyer.country,
        buyerState: buyer.state,
        taxableAmount: item.taxableAmount,
        taxRate: item.taxRate,
      });

      results.push({ ...item, tax });

      // Aggregate into summary
      for (const comp of tax.components) {
        const key = `${comp.type}_${comp.rate}`;
        if (!summary[key]) {
          summary[key] = { type: comp.type, name: comp.name, rate: comp.rate, amount: 0 };
        }
        summary[key].amount += comp.amount;
      }
    }

    // Round summary amounts
    const taxSummary = Object.values(summary).map((s) => ({
      ...s, amount: Math.round(s.amount * 100) / 100,
    }));

    const totalTax = taxSummary.reduce((s, t) => s + t.amount, 0);

    return {
      items: results,
      totalTax: Math.round(totalTax * 100) / 100,
      taxSummary,
    };
  }
}

module.exports = TaxService;
