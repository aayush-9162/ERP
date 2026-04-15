/**
 * Tax engine accuracy test for India CGST/SGST/IGST.
 *
 * Validates:
 * 1.  Intra-state: CGST + SGST = total, each is half
 * 2.  Inter-state: IGST = total, no CGST/SGST
 * 3.  B2C walk-in (no buyer state): defaults to intra-state
 * 4.  Export (buyer country != IN): treated as inter-state (IGST)
 * 5.  Penny-off: odd tax amounts split without discrepancy
 * 6.  Multiple items with different rates on same invoice
 * 7.  Zero-rate items (exempt goods)
 * 8.  Every standard Indian GST rate (5%, 12%, 18%, 28%)
 * 9.  US sales tax from DB rules
 * 10. Tax summary aggregation across items
 * 11. UK VAT single-line
 * 12. CGST rate + SGST rate = total rate
 *
 * Usage: NODE_ENV=production node src/tests/tax-engine.test.js
 */

require('dotenv').config();
const { sequelize } = require('../models');
const TaxService = require('../services/tax.service');

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
// Test 1: Intra-state (same state) → CGST + SGST
// ──────────────────────────────────
async function testIntraState() {
  console.log('=== Test 1: India intra-state (CGST + SGST) ===');

  const result = await TaxService.calculateItemTax({
    sellerCountry: 'IN', sellerState: '27',
    buyerCountry: 'IN', buyerState: '27',
    taxableAmount: 10000, taxRate: 18,
  });

  assert('Total tax = 1800', near(result.totalTax, 1800));
  assert('2 components', result.components.length === 2);

  const cgst = result.components.find((c) => c.type === 'CGST');
  const sgst = result.components.find((c) => c.type === 'SGST');

  assert('CGST exists', !!cgst);
  assert('SGST exists', !!sgst);
  assert('CGST amount = 900', near(cgst.amount, 900));
  assert('SGST amount = 900', near(sgst.amount, 900));
  assert('CGST + SGST = totalTax', near(cgst.amount + sgst.amount, result.totalTax));
  assert('CGST rate = 9', near(cgst.rate, 9));
  assert('SGST rate = 9', near(sgst.rate, 9));
  assert('CGST rate + SGST rate = 18', near(cgst.rate + sgst.rate, 18));
}

// ──────────────────────────────────
// Test 2: Inter-state (different state) → IGST
// ──────────────────────────────────
async function testInterState() {
  console.log('\n=== Test 2: India inter-state (IGST) ===');

  const result = await TaxService.calculateItemTax({
    sellerCountry: 'IN', sellerState: '27', // Maharashtra
    buyerCountry: 'IN', buyerState: '29',   // Karnataka
    taxableAmount: 10000, taxRate: 18,
  });

  assert('Total tax = 1800', near(result.totalTax, 1800));
  assert('1 component', result.components.length === 1);

  const igst = result.components[0];
  assert('Type = IGST', igst.type === 'IGST');
  assert('IGST amount = 1800', near(igst.amount, 1800));
  assert('IGST rate = 18', near(igst.rate, 18));
  assert('No CGST', !result.components.find((c) => c.type === 'CGST'));
  assert('No SGST', !result.components.find((c) => c.type === 'SGST'));
}

// ──────────────────────────────────
// Test 3: B2C walk-in (no buyer state) → intra-state
// ──────────────────────────────────
async function testB2CWalkIn() {
  console.log('\n=== Test 3: B2C walk-in (no buyer state) ===');

  const result = await TaxService.calculateItemTax({
    sellerCountry: 'IN', sellerState: '27',
    buyerCountry: 'IN', buyerState: null,
    taxableAmount: 5000, taxRate: 12,
  });

  assert('Total tax = 600', near(result.totalTax, 600));
  assert('2 components (CGST + SGST)', result.components.length === 2);

  const cgst = result.components.find((c) => c.type === 'CGST');
  const sgst = result.components.find((c) => c.type === 'SGST');
  assert('CGST = 300', near(cgst.amount, 300));
  assert('SGST = 300', near(sgst.amount, 300));
}

// ──────────────────────────────────
// Test 4: Export (buyer country != IN) → IGST
// ──────────────────────────────────
async function testExport() {
  console.log('\n=== Test 4: Export sale (buyer in US) ===');

  const result = await TaxService.calculateItemTax({
    sellerCountry: 'IN', sellerState: '27',
    buyerCountry: 'US', buyerState: 'CA',
    taxableAmount: 10000, taxRate: 18,
  });

  assert('1 component (IGST for export)', result.components.length === 1);
  assert('Type = IGST', result.components[0].type === 'IGST');
  assert('IGST amount = 1800', near(result.components[0].amount, 1800));
}

// ──────────────────────────────────
// Test 5: Penny-off edge cases
// ──────────────────────────────────
async function testPennyOff() {
  console.log('\n=== Test 5: Penny-off edge cases ===');

  const cases = [
    { amount: 1, rate: 18, expectedTax: 0.18 },
    { amount: 33.33, rate: 18, expectedTax: 5.99 },
    { amount: 100, rate: 5, expectedTax: 5.00 },
    { amount: 999.99, rate: 28, expectedTax: 279.99 },
    { amount: 0.50, rate: 12, expectedTax: 0.06 },
    { amount: 7777.77, rate: 18, expectedTax: 1399.99 },
  ];

  for (const c of cases) {
    const result = await TaxService.calculateItemTax({
      sellerCountry: 'IN', sellerState: '27',
      buyerCountry: 'IN', buyerState: '27',
      taxableAmount: c.amount, taxRate: c.rate,
    });

    const cgst = result.components.find((x) => x.type === 'CGST');
    const sgst = result.components.find((x) => x.type === 'SGST');
    const splitSum = cgst.amount + sgst.amount;

    assert(
      `₹${c.amount} @${c.rate}%: tax=${result.totalTax}, CGST=${cgst.amount}+SGST=${sgst.amount}=${splitSum}`,
      near(splitSum, result.totalTax) && near(result.totalTax, c.expectedTax, 0.02),
      `expected ${c.expectedTax}, got ${result.totalTax}`
    );
  }
}

// ──────────────────────────────────
// Test 6: Multi-item invoice with different rates
// ──────────────────────────────────
async function testMultiItemInvoice() {
  console.log('\n=== Test 6: Multi-item invoice ===');

  const result = await TaxService.calculateInvoiceTax({
    seller: { country: 'IN', state: '27' },
    buyer: { country: 'IN', state: '27' },
    items: [
      { taxableAmount: 10000, taxRate: 18 }, // tax = 1800
      { taxableAmount: 5000, taxRate: 12 },  // tax = 600
      { taxableAmount: 2000, taxRate: 5 },   // tax = 100
    ],
  });

  assert('Total tax = 2500', near(result.totalTax, 2500));
  assert('3 items returned', result.items.length === 3);

  // Summary should have CGST and SGST at 3 different rates
  assert('Tax summary has entries', result.taxSummary.length >= 2);

  // Verify each item's tax
  assert('Item 1 tax = 1800', near(result.items[0].tax.totalTax, 1800));
  assert('Item 2 tax = 600', near(result.items[1].tax.totalTax, 600));
  assert('Item 3 tax = 100', near(result.items[2].tax.totalTax, 100));

  // Summary totals should match
  const summaryTotal = result.taxSummary.reduce((s, t) => s + t.amount, 0);
  assert(`Summary total (${summaryTotal}) = invoice total (${result.totalTax})`, near(summaryTotal, result.totalTax));
}

// ──────────────────────────────────
// Test 7: Zero-rate items
// ──────────────────────────────────
async function testZeroRate() {
  console.log('\n=== Test 7: Zero-rate items ===');

  const result = await TaxService.calculateItemTax({
    sellerCountry: 'IN', sellerState: '27',
    buyerCountry: 'IN', buyerState: '27',
    taxableAmount: 10000, taxRate: 0,
  });

  assert('Total tax = 0', result.totalTax === 0);
  assert('CGST = 0', result.components.find((c) => c.type === 'CGST')?.amount === 0);
  assert('SGST = 0', result.components.find((c) => c.type === 'SGST')?.amount === 0);
}

// ──────────────────────────────────
// Test 8: All standard Indian GST rates
// ──────────────────────────────────
async function testAllGSTRates() {
  console.log('\n=== Test 8: All standard GST rates ===');

  for (const rate of [5, 12, 18, 28]) {
    const result = await TaxService.calculateItemTax({
      sellerCountry: 'IN', sellerState: '27',
      buyerCountry: 'IN', buyerState: '27',
      taxableAmount: 10000, taxRate: rate,
    });

    const expectedTax = Math.round(10000 * rate) / 100;
    const cgst = result.components.find((c) => c.type === 'CGST');
    const sgst = result.components.find((c) => c.type === 'SGST');

    assert(`@${rate}%: total=${result.totalTax} == ${expectedTax}`, near(result.totalTax, expectedTax));
    assert(`@${rate}%: CGST(${cgst.rate}%) + SGST(${sgst.rate}%) = ${rate}%`, near(cgst.rate + sgst.rate, rate));
    assert(`@${rate}%: CGST amt + SGST amt = total`, near(cgst.amount + sgst.amount, result.totalTax));
  }
}

// ──────────────────────────────────
// Test 9: US sales tax from DB
// ──────────────────────────────────
async function testUSSalesTax() {
  console.log('\n=== Test 9: US sales tax (DB-driven) ===');

  // California: 7.25%
  const ca = await TaxService.calculateItemTax({
    sellerCountry: 'US', sellerState: 'CA',
    buyerCountry: 'US', buyerState: 'CA',
    taxableAmount: 10000, taxRate: 0,
  });
  assert('CA: tax = 725 (7.25%)', near(ca.totalTax, 725));
  assert('CA: type = SALES_TAX', ca.components[0]?.type === 'SALES_TAX');

  // Oregon: 0%
  const or = await TaxService.calculateItemTax({
    sellerCountry: 'US', sellerState: 'OR',
    buyerCountry: 'US', buyerState: 'OR',
    taxableAmount: 10000, taxRate: 0,
  });
  assert('OR: tax = 0 (no sales tax)', or.totalTax === 0);

  // New York: 8%
  const ny = await TaxService.calculateItemTax({
    sellerCountry: 'US', sellerState: 'NY',
    buyerCountry: 'US', buyerState: 'NY',
    taxableAmount: 10000, taxRate: 0,
  });
  assert('NY: tax = 800 (8%)', near(ny.totalTax, 800));
}

// ──────────────────────────────────
// Test 10: Invoice summary aggregation
// ──────────────────────────────────
async function testSummaryAggregation() {
  console.log('\n=== Test 10: Summary aggregation ===');

  // Inter-state invoice: all items should aggregate under IGST
  const result = await TaxService.calculateInvoiceTax({
    seller: { country: 'IN', state: '27' },
    buyer: { country: 'IN', state: '29' },
    items: [
      { taxableAmount: 5000, taxRate: 18 },
      { taxableAmount: 3000, taxRate: 18 },
    ],
  });

  const igstEntry = result.taxSummary.find((s) => s.type === 'IGST');
  assert('IGST in summary', !!igstEntry);
  assert('IGST total = 1440 (5000*18/100 + 3000*18/100)', near(igstEntry.amount, 1440));
  assert('No CGST in summary', !result.taxSummary.find((s) => s.type === 'CGST'));
}

// ──────────────────────────────────
// Test 11: UK VAT
// ──────────────────────────────────
async function testUKVAT() {
  console.log('\n=== Test 11: UK VAT ===');

  const result = await TaxService.calculateItemTax({
    sellerCountry: 'GB', sellerState: null,
    buyerCountry: 'GB', buyerState: null,
    taxableAmount: 10000, taxRate: 20,
  });

  assert('Total tax = 2000 (20%)', near(result.totalTax, 2000));
  assert('1 component', result.components.length === 1);
  assert('Type = VAT', result.components[0]?.type === 'VAT');
}

// ──────────────────────────────────
// Test 12: CGST rate + SGST rate = total rate (all rates)
// ──────────────────────────────────
async function testRateSplitAccuracy() {
  console.log('\n=== Test 12: Rate split accuracy ===');

  for (const rate of [5, 12, 18, 28, 0.25, 3, 7.5]) {
    const result = await TaxService.calculateItemTax({
      sellerCountry: 'IN', sellerState: '27',
      buyerCountry: 'IN', buyerState: '27',
      taxableAmount: 10000, taxRate: rate,
    });

    const cgst = result.components.find((c) => c.type === 'CGST');
    const sgst = result.components.find((c) => c.type === 'SGST');

    if (cgst && sgst) {
      const rateSum = cgst.rate + sgst.rate;
      assert(`@${rate}%: CGST rate (${cgst.rate}) + SGST rate (${sgst.rate}) = ${rateSum} == ${rate}`,
        near(rateSum, rate, 0.01));
    }
  }
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();

    await testIntraState();
    await testInterState();
    await testB2CWalkIn();
    await testExport();
    await testPennyOff();
    await testMultiItemInvoice();
    await testZeroRate();
    await testAllGSTRates();
    await testUSSalesTax();
    await testSummaryAggregation();
    await testUKVAT();
    await testRateSplitAccuracy();

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
