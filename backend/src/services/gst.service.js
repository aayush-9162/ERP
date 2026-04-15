const { sequelize, Company } = require('../models');

/**
 * GST return data generation for India.
 *
 * Tax split logic:
 * - Extract state code from first 2 chars of GSTIN (seller + buyer).
 * - Same state → CGST (half) + SGST (half) — intra-state supply.
 * - Different state → IGST (full) — inter-state supply.
 * - B2C (no buyer GSTIN) → assumes intra-state (CGST+SGST).
 *
 * Penny-off fix:
 * - CGST = FLOOR(tax / 2 * 100) / 100
 * - SGST = tax - CGST  (absorbs the rounding remainder)
 */
class GSTService {
  static _sellerStateCode = null;

  static async _getSellerStateCode() {
    if (this._sellerStateCode) return this._sellerStateCode;
    const company = await Company.findOne();
    this._sellerStateCode = company?.gst_number?.substring(0, 2) || '27';
    return this._sellerStateCode;
  }

  /**
   * GSTR-1: Outward supplies (sales) — item-level tax split.
   */
  static async getGSTR1({ from, to }) {
    const sellerState = await this._getSellerStateCode();
    const dateFilter = GSTService._dateFilter('s.created_at', from, to);
    const dateAnd = dateFilter ? 'AND ' + dateFilter : '';

    // Item-level data with buyer state for IGST determination
    const [allItems] = await sequelize.query(`
      SELECT
        s.id AS sale_id, s.invoice_number, s.created_at AS invoice_date,
        s.total_amount, s.tax_amount AS invoice_tax, s.final_amount,
        s.discount_amount,
        c.name AS customer_name, c.gst_number,
        si.product_name, si.product_sku, si.quantity,
        si.unit_price, si.tax_rate, si.tax_amount AS item_tax, si.total AS item_total,
        p.hsn_code
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE 1=1 ${dateAnd}
      ORDER BY s.created_at, si.id
    `);

    // Group items by invoice
    const invoiceMap = new Map();
    for (const row of allItems) {
      if (!invoiceMap.has(row.sale_id)) {
        invoiceMap.set(row.sale_id, {
          invoice_number: row.invoice_number,
          invoice_date: row.invoice_date,
          customer_name: row.customer_name || 'Walk-in',
          gst_number: row.gst_number,
          total_amount: parseFloat(row.total_amount),
          discount_amount: parseFloat(row.discount_amount),
          final_amount: parseFloat(row.final_amount),
          items: [],
        });
      }
      invoiceMap.get(row.sale_id).items.push(row);
    }

    const b2b = [];
    const b2c = [];
    const hsnMap = new Map();

    for (const [, inv] of invoiceMap) {
      const buyerState = inv.gst_number ? inv.gst_number.substring(0, 2) : null;
      const isInterState = buyerState && buyerState !== sellerState;

      let totalCgst = 0, totalSgst = 0, totalIgst = 0, totalTaxableValue = 0;

      for (const item of inv.items) {
        const taxableValue = parseFloat(item.unit_price) * item.quantity;
        const itemTax = parseFloat(item.item_tax);

        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = itemTax;
        } else {
          // Penny-off safe split: CGST = floor, SGST = remainder
          cgst = Math.floor(itemTax * 100 / 2) / 100;
          sgst = Math.round((itemTax - cgst) * 100) / 100;
        }

        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;
        totalTaxableValue += taxableValue;

        // HSN summary accumulation
        const hsnKey = `${item.hsn_code || 'N/A'}|${item.tax_rate}`;
        if (!hsnMap.has(hsnKey)) {
          hsnMap.set(hsnKey, {
            hsn_code: item.hsn_code || 'N/A',
            description: item.product_name,
            gst_rate: parseFloat(item.tax_rate),
            total_qty: 0, taxable_value: 0, total_tax: 0,
            cgst: 0, sgst: 0, igst: 0,
          });
        }
        const h = hsnMap.get(hsnKey);
        h.total_qty += item.quantity;
        h.taxable_value += taxableValue;
        h.total_tax += itemTax;
        h.cgst += cgst;
        h.sgst += sgst;
        h.igst += igst;
      }

      const invoiceRow = {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        customer_name: inv.customer_name,
        gst_number: inv.gst_number || null,
        taxable_value: Math.round(totalTaxableValue * 100) / 100,
        cgst: Math.round(totalCgst * 100) / 100,
        sgst: Math.round(totalSgst * 100) / 100,
        igst: Math.round(totalIgst * 100) / 100,
        invoice_value: inv.final_amount,
      };

      if (inv.gst_number) {
        b2b.push(invoiceRow);
      } else {
        b2c.push(invoiceRow);
      }
    }

    // Round HSN summary
    const hsn = Array.from(hsnMap.values()).map((h) => ({
      ...h,
      taxable_value: Math.round(h.taxable_value * 100) / 100,
      total_tax: Math.round(h.total_tax * 100) / 100,
      cgst: Math.round(h.cgst * 100) / 100,
      sgst: Math.round(h.sgst * 100) / 100,
      igst: Math.round(h.igst * 100) / 100,
    })).sort((a, b) => b.taxable_value - a.taxable_value);

    return {
      b2b: { invoices: b2b, count: b2b.length },
      b2c: { invoices: b2c, count: b2c.length },
      hsn_summary: hsn,
      seller_state_code: sellerState,
      period: { from, to },
    };
  }

  /**
   * GSTR-3B: Monthly summary — item-level split aggregated.
   */
  static async getGSTR3B({ from, to }) {
    const sellerState = await this._getSellerStateCode();
    const dateFilterS = GSTService._dateFilter('s.created_at', from, to);
    const dateFilterP = GSTService._dateFilter('p.created_at', from, to);
    const dateAndS = dateFilterS ? 'AND ' + dateFilterS : '';
    const dateAndP = dateFilterP ? 'AND ' + dateFilterP : '';

    // Outward: item-level split with state comparison
    const [outItems] = await sequelize.query(`
      SELECT
        si.tax_amount AS item_tax,
        c.gst_number AS buyer_gstin
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE 1=1 ${dateAndS}
    `);

    let outCgst = 0, outSgst = 0, outIgst = 0, outTaxable = 0, outTotal = 0;
    // Also need invoice-level totals for taxable_value and invoice count
    const [[outAgg]] = await sequelize.query(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS taxable, COALESCE(SUM(tax_amount),0) AS tax
      FROM sales s WHERE 1=1 ${dateAndS.replace('s.created_at', 'created_at')}
    `);
    outTaxable = parseFloat(outAgg.taxable);
    outTotal = parseFloat(outAgg.tax);

    for (const row of outItems) {
      const itemTax = parseFloat(row.item_tax);
      const buyerState = row.buyer_gstin ? row.buyer_gstin.substring(0, 2) : null;
      if (buyerState && buyerState !== sellerState) {
        outIgst += itemTax;
      } else {
        const c = Math.floor(itemTax * 100 / 2) / 100;
        outCgst += c;
        outSgst += Math.round((itemTax - c) * 100) / 100;
      }
    }

    // Inward: purchases (assume all intra-state for simplicity — supplier state check similar)
    const [[inAgg]] = await sequelize.query(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS taxable, COALESCE(SUM(tax_amount),0) AS tax
      FROM purchases p WHERE 1=1 ${dateAndP.replace('p.created_at', 'created_at')}
    `);
    const inTax = parseFloat(inAgg.tax);
    const inCgst = Math.floor(inTax * 100 / 2) / 100;
    const inSgst = Math.round((inTax - inCgst) * 100) / 100;

    const netCgst = Math.round((outCgst - inCgst) * 100) / 100;
    const netSgst = Math.round((outSgst - inSgst) * 100) / 100;
    const netIgst = Math.round(outIgst * 100) / 100;

    return {
      outward_supplies: {
        invoice_count: parseInt(outAgg.cnt),
        taxable_value: outTaxable,
        cgst: Math.round(outCgst * 100) / 100,
        sgst: Math.round(outSgst * 100) / 100,
        igst: Math.round(outIgst * 100) / 100,
        total_tax: outTotal,
      },
      inward_supplies: {
        invoice_count: parseInt(inAgg.cnt),
        taxable_value: parseFloat(inAgg.taxable),
        cgst: inCgst, sgst: inSgst, igst: 0,
        total_tax: inTax,
      },
      net_tax_payable: {
        cgst: netCgst, sgst: netSgst, igst: netIgst,
        total: Math.round((netCgst + netSgst + netIgst) * 100) / 100,
      },
      seller_state_code: sellerState,
      period: { from, to },
    };
  }

  static _dateFilter(col, from, to) {
    const parts = [];
    if (from) { const d = new Date(from); if (!isNaN(d)) parts.push(`${col} >= '${d.toISOString().slice(0, 10)} 00:00:00'`); }
    if (to) { const d = new Date(to); if (!isNaN(d)) parts.push(`${col} <= '${d.toISOString().slice(0, 10)} 23:59:59'`); }
    return parts.join(' AND ');
  }
}

module.exports = GSTService;
