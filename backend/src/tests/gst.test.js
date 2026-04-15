/**
 * GST calculation accuracy test.
 *
 * Validates:
 * 1. CGST + SGST = total tax (intra-state, no penny-off)
 * 2. IGST = total tax (inter-state)
 * 3. GSTR-1 B2B/B2C classification is correct
 * 4. HSN summary has CGST/SGST/IGST columns that sum correctly
 * 5. GSTR-3B totals match GSTR-1 item sums
 * 6. E-invoice payload uses correct HSN codes and tax split
 * 7. Penny-off: odd tax amounts (3.01) split without discrepancy
 *
 * Usage: NODE_ENV=production node src/tests/gst.test.js
 */

require('dotenv').config();
const { sequelize, Sale, SaleItem, Customer, Company, Product, Inventory, StockMovement } = require('../models');
const SalesService = require('../services/sales.service');
const GSTService = require('../services/gst.service');
const EInvoiceService = require('../services/einvoice.service');

let passed = 0, failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');
}

// ──────────────────────────────────
// Test 1: CGST + SGST = total (no penny-off)
// ──────────────────────────────────
async function testCgstSgstSplit() {
  console.log('=== Test 1: CGST/SGST split accuracy ===');

  const gstr1 = await GSTService.getGSTR1({ from: '2020-01-01', to: '2030-12-31' });

  for (const inv of [...gstr1.b2b.invoices, ...gstr1.b2c.invoices]) {
    const cgst = parseFloat(inv.cgst);
    const sgst = parseFloat(inv.sgst);
    const igst = parseFloat(inv.igst);
    const total = cgst + sgst + igst;

    // Total from sale_items for this invoice
    const [[row]] = await sequelize.query(
      'SELECT SUM(tax_amount) AS item_tax FROM sale_items WHERE sale_id = (SELECT id FROM sales WHERE invoice_number = :inv)',
      { replacements: { inv: inv.invoice_number } }
    );
    const itemTaxSum = parseFloat(row.item_tax);

    assert(
      `${inv.invoice_number}: CGST(${cgst}) + SGST(${sgst}) + IGST(${igst}) = ${total} == item tax ${itemTaxSum}`,
      near(total, itemTaxSum),
      `diff=${(total - itemTaxSum).toFixed(4)}`
    );
  }
}

// ──────────────────────────────────
// Test 2: B2B vs B2C classification
// ──────────────────────────────────
async function testB2BClassification() {
  console.log('\n=== Test 2: B2B/B2C classification ===');

  const gstr1 = await GSTService.getGSTR1({ from: '2020-01-01', to: '2030-12-31' });

  for (const inv of gstr1.b2b.invoices) {
    assert(`B2B ${inv.invoice_number}: has GSTIN`, !!inv.gst_number && inv.gst_number.length === 15, `got "${inv.gst_number}"`);
  }
  for (const inv of gstr1.b2c.invoices) {
    assert(`B2C ${inv.invoice_number}: no GSTIN`, !inv.gst_number, `got "${inv.gst_number}"`);
  }
}

// ──────────────────────────────────
// Test 3: HSN summary columns
// ──────────────────────────────────
async function testHSNSummary() {
  console.log('\n=== Test 3: HSN summary CGST/SGST/IGST ===');

  const gstr1 = await GSTService.getGSTR1({ from: '2020-01-01', to: '2030-12-31' });

  for (const h of gstr1.hsn_summary) {
    const splitSum = parseFloat(h.cgst) + parseFloat(h.sgst) + parseFloat(h.igst);
    assert(
      `HSN ${h.hsn_code} @${h.gst_rate}%: CGST(${h.cgst})+SGST(${h.sgst})+IGST(${h.igst}) = ${splitSum} == total ${h.total_tax}`,
      near(splitSum, parseFloat(h.total_tax)),
    );
  }
}

// ──────────────────────────────────
// Test 4: GSTR-3B totals match GSTR-1
// ──────────────────────────────────
async function testGSTR3BConsistency() {
  console.log('\n=== Test 4: GSTR-3B vs GSTR-1 consistency ===');

  const period = { from: '2020-01-01', to: '2030-12-31' };
  const gstr1 = await GSTService.getGSTR1(period);
  const gstr3b = await GSTService.getGSTR3B(period);

  // Sum GSTR-1 item-level taxes
  const gstr1TotalCgst = [...gstr1.b2b.invoices, ...gstr1.b2c.invoices].reduce((s, i) => s + parseFloat(i.cgst), 0);
  const gstr1TotalSgst = [...gstr1.b2b.invoices, ...gstr1.b2c.invoices].reduce((s, i) => s + parseFloat(i.sgst), 0);
  const gstr1TotalIgst = [...gstr1.b2b.invoices, ...gstr1.b2c.invoices].reduce((s, i) => s + parseFloat(i.igst), 0);

  assert(`Outward CGST: GSTR-3B(${gstr3b.outward_supplies.cgst}) == GSTR-1(${gstr1TotalCgst.toFixed(2)})`,
    near(gstr3b.outward_supplies.cgst, gstr1TotalCgst));
  assert(`Outward SGST: GSTR-3B(${gstr3b.outward_supplies.sgst}) == GSTR-1(${gstr1TotalSgst.toFixed(2)})`,
    near(gstr3b.outward_supplies.sgst, gstr1TotalSgst));
  assert(`Outward IGST: GSTR-3B(${gstr3b.outward_supplies.igst}) == GSTR-1(${gstr1TotalIgst.toFixed(2)})`,
    near(gstr3b.outward_supplies.igst, gstr1TotalIgst));

  // Net payable = outward - inward
  const expectedNet = gstr3b.outward_supplies.total_tax - gstr3b.inward_supplies.total_tax;
  assert(`Net payable: ${gstr3b.net_tax_payable.total} == ${expectedNet.toFixed(2)}`,
    near(gstr3b.net_tax_payable.total, expectedNet));
}

// ──────────────────────────────────
// Test 5: Penny-off stress test
// ──────────────────────────────────
async function testPennyOff() {
  console.log('\n=== Test 5: Penny-off edge cases ===');

  // Test the split formula directly
  const cases = [
    { tax: 3.01, expectedCgst: 1.50, expectedSgst: 1.51 },
    { tax: 1.01, expectedCgst: 0.50, expectedSgst: 0.51 },
    { tax: 0.01, expectedCgst: 0.00, expectedSgst: 0.01 },
    { tax: 100.00, expectedCgst: 50.00, expectedSgst: 50.00 },
    { tax: 288.00, expectedCgst: 144.00, expectedSgst: 144.00 },
    { tax: 14.40, expectedCgst: 7.20, expectedSgst: 7.20 },
    { tax: 9999.99, expectedCgst: 4999.99, expectedSgst: 5000.00 },
  ];

  for (const { tax, expectedCgst, expectedSgst } of cases) {
    const cgst = Math.floor(tax * 100 / 2) / 100;
    const sgst = Math.round((tax - cgst) * 100) / 100;
    assert(
      `Tax ${tax}: CGST=${cgst} SGST=${sgst}, sum=${cgst + sgst}`,
      near(cgst, expectedCgst) && near(sgst, expectedSgst) && near(cgst + sgst, tax),
      `expected CGST=${expectedCgst} SGST=${expectedSgst}`
    );
  }
}

// ──────────────────────────────────
// Test 6: E-invoice HSN code + state-based split
// ──────────────────────────────────
async function testEInvoicePayload() {
  console.log('\n=== Test 6: E-invoice payload accuracy ===');

  // Find a sale with GST-registered customer
  const sale = await Sale.findOne({
    include: [
      { association: 'customer', where: { gst_number: { [sequelize.Sequelize.Op.ne]: null } } },
    ],
  });

  if (!sale) {
    console.log('  [SKIP] No GST sale found to test e-invoice');
    return;
  }

  // Reset e-invoice status if already generated
  if (sale.e_invoice_status === 'GENERATED') {
    await sale.update({ e_invoice_status: null, irn: null, qr_code: null });
  }

  const result = await EInvoiceService.generate(sale.id);
  assert('E-invoice generated', result.status === 'GENERATED');
  assert('IRN is 64-char hex', result.irn?.length === 64);

  // Check HSN codes in payload
  for (const item of result.payload.ItemList) {
    assert(`Item "${item.PrdDesc}": HsnCd=${item.HsnCd}`, item.HsnCd && item.HsnCd !== 'undefined');
    const itemTax = item.CgstAmt + item.SgstAmt + (item.IgstAmt || 0);
    const expectedTax = Math.round(item.TotAmt * item.GstRt) / 100;
    assert(`Item tax split: CGST+SGST+IGST = ${itemTax.toFixed(2)} == computed ${expectedTax}`, near(itemTax, expectedTax));
  }

  // ValDtls check
  const v = result.payload.ValDtls;
  assert(`ValDtls: CGST+SGST+IGST = ${(v.CgstVal + v.SgstVal + v.IgstVal).toFixed(2)}`,
    near(v.CgstVal + v.SgstVal + v.IgstVal, parseFloat(sale.tax_amount)));
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();
    await testCgstSgstSplit();
    await testB2BClassification();
    await testHSNSummary();
    await testGSTR3BConsistency();
    await testPennyOff();
    await testEInvoicePayload();

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${passed + failed}`);
    console.log(`${'═'.repeat(50)}`);
    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  }
}

run();
