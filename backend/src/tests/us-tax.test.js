/**
 * USA state-based tax scenarios test.
 *
 * Validates:
 * 1.  Each seeded state returns correct rate from DB
 * 2.  No-tax states (OR, NH) return zero
 * 3.  Buyer in different state than seller uses buyer's rate
 * 4.  Buyer state missing → falls back to seller state
 * 5.  Both states missing → falls back to product tax_rate
 * 6.  State not in DB → falls back to product tax_rate
 * 7.  Multi-item invoice with same state
 * 8.  Multi-item invoice where buyer is in no-tax state
 * 9.  Cross-state sale: seller CA, buyer OR (no tax)
 * 10. Cross-state sale: seller OR, buyer NY (8%)
 * 11. Large amount accuracy (no floating-point drift)
 * 12. Tax component name includes state name
 * 13. Tax type is always SALES_TAX
 *
 * Usage: NODE_ENV=production node src/tests/us-tax.test.js
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

async function calcUS(sellerState, buyerState, amount, productRate = 0) {
  return TaxService.calculateItemTax({
    sellerCountry: 'US', sellerState,
    buyerCountry: 'US', buyerState,
    taxableAmount: amount, taxRate: productRate,
  });
}

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');
}

// ──────────────────────────────────
// Test 1: Each seeded state at correct rate
// ──────────────────────────────────
async function testSeededStateRates() {
  console.log('=== Test 1: Seeded state rates ===');

  const expected = [
    { state: 'CA', rate: 7.25, tax: 725 },
    { state: 'NY', rate: 8.00, tax: 800 },
    { state: 'TX', rate: 6.25, tax: 625 },
    { state: 'FL', rate: 6.00, tax: 600 },
    { state: 'WA', rate: 6.50, tax: 650 },
    { state: 'OR', rate: 0,    tax: 0 },
    { state: 'NH', rate: 0,    tax: 0 },
  ];

  for (const e of expected) {
    const r = await calcUS(e.state, e.state, 10000);
    assert(`${e.state}: rate=${r.taxRate}% == ${e.rate}%, tax=${r.totalTax} == ${e.tax}`,
      near(r.taxRate, e.rate) && near(r.totalTax, e.tax),
      `got rate=${r.taxRate}, tax=${r.totalTax}`);
  }
}

// ──────────────────────────────────
// Test 2: No-tax states return zero
// ──────────────────────────────────
async function testNoTaxStates() {
  console.log('\n=== Test 2: No-tax states ===');

  for (const state of ['OR', 'NH']) {
    const r = await calcUS(state, state, 50000);
    assert(`${state}: tax on $50,000 = $${r.totalTax}`, r.totalTax === 0);
    assert(`${state}: rate = 0`, r.taxRate === 0);
    assert(`${state}: 1 component`, r.components.length === 1);
    assert(`${state}: amount = 0`, r.components[0].amount === 0);
  }
}

// ──────────────────────────────────
// Test 3: Buyer in different state → buyer's rate
// ──────────────────────────────────
async function testCrossStateBuyerRate() {
  console.log('\n=== Test 3: Cross-state → buyer rate ===');

  // Seller in TX (6.25%), buyer in NY (8%) → should charge NY rate
  const r = await calcUS('TX', 'NY', 10000);
  assert('Seller TX, Buyer NY: rate=8%', near(r.taxRate, 8));
  assert('Tax = 800', near(r.totalTax, 800));
  assert('Name includes NY', r.components[0].name.includes('NY'));

  // Seller in CA (7.25%), buyer in FL (6%) → should charge FL rate
  const r2 = await calcUS('CA', 'FL', 10000);
  assert('Seller CA, Buyer FL: rate=6%', near(r2.taxRate, 6));
  assert('Tax = 600', near(r2.totalTax, 600));
}

// ──────────────────────────────────
// Test 4: Buyer state missing → seller state fallback
// ──────────────────────────────────
async function testBuyerStateMissing() {
  console.log('\n=== Test 4: Buyer state missing → seller fallback ===');

  const r = await calcUS('CA', null, 10000);
  assert('Buyer null: uses seller CA rate 7.25%', near(r.taxRate, 7.25));
  assert('Tax = 725', near(r.totalTax, 725));

  const r2 = await calcUS('TX', undefined, 10000);
  assert('Buyer undefined: uses seller TX rate 6.25%', near(r2.taxRate, 6.25));
  assert('Tax = 625', near(r2.totalTax, 625));
}

// ──────────────────────────────────
// Test 5: Both states missing → product rate fallback
// ──────────────────────────────────
async function testBothStatesMissing() {
  console.log('\n=== Test 5: Both states missing → product rate ===');

  // No state in DB for null → falls back to product taxRate
  const r = await calcUS(null, null, 10000, 5);
  assert('Both null: uses product rate 5%', near(r.taxRate, 5));
  assert('Tax = 500', near(r.totalTax, 500));
  assert('Name = Sales Tax (generic)', r.components[0].name === 'Sales Tax');
}

// ──────────────────────────────────
// Test 6: Unknown state → product rate fallback
// ──────────────────────────────────
async function testUnknownState() {
  console.log('\n=== Test 6: Unknown state → product rate ===');

  // State "ZZ" not in tax_rules
  const r = await calcUS('ZZ', 'ZZ', 10000, 7);
  assert('Unknown state ZZ: uses product rate 7%', near(r.taxRate, 7));
  assert('Tax = 700', near(r.totalTax, 700));
}

// ──────────────────────────────────
// Test 7: Multi-item same state
// ──────────────────────────────────
async function testMultiItemSameState() {
  console.log('\n=== Test 7: Multi-item invoice (same state) ===');

  const r = await TaxService.calculateInvoiceTax({
    seller: { country: 'US', state: 'CA' },
    buyer: { country: 'US', state: 'CA' },
    items: [
      { taxableAmount: 5000, taxRate: 0 },
      { taxableAmount: 3000, taxRate: 0 },
      { taxableAmount: 2000, taxRate: 0 },
    ],
  });

  // All at CA 7.25%
  assert('Total tax = 725', near(r.totalTax, 725));
  assert('Item 1 tax = 362.5', near(r.items[0].tax.totalTax, 362.5));
  assert('Item 2 tax = 217.5', near(r.items[1].tax.totalTax, 217.5));
  assert('Item 3 tax = 145', near(r.items[2].tax.totalTax, 145));
  assert('Summary has 1 entry', r.taxSummary.length === 1);
  assert('Summary type = SALES_TAX', r.taxSummary[0].type === 'SALES_TAX');
  assert('Summary rate = 7.25', near(r.taxSummary[0].rate, 7.25));
}

// ──────────────────────────────────
// Test 8: Multi-item buyer in no-tax state
// ──────────────────────────────────
async function testMultiItemNoTax() {
  console.log('\n=== Test 8: Multi-item (buyer in Oregon) ===');

  const r = await TaxService.calculateInvoiceTax({
    seller: { country: 'US', state: 'CA' },
    buyer: { country: 'US', state: 'OR' },
    items: [
      { taxableAmount: 10000, taxRate: 0 },
      { taxableAmount: 5000, taxRate: 0 },
    ],
  });

  assert('Total tax = 0', r.totalTax === 0);
  assert('Item 1 tax = 0', r.items[0].tax.totalTax === 0);
  assert('Item 2 tax = 0', r.items[1].tax.totalTax === 0);
}

// ──────────────────────────────────
// Test 9: Seller CA → Buyer OR (no tax)
// ──────────────────────────────────
async function testSellerCABuyerOR() {
  console.log('\n=== Test 9: CA seller → OR buyer ===');

  const r = await calcUS('CA', 'OR', 25000);
  assert('Tax = 0 (Oregon has no sales tax)', r.totalTax === 0);
  assert('Rate = 0', r.taxRate === 0);
  assert('Name includes OR', r.components[0].name.includes('OR'));
}

// ──────────────────────────────────
// Test 10: Seller OR → Buyer NY (8%)
// ──────────────────────────────────
async function testSellerORBuyerNY() {
  console.log('\n=== Test 10: OR seller → NY buyer ===');

  const r = await calcUS('OR', 'NY', 10000);
  assert('Tax = 800 (NY 8%)', near(r.totalTax, 800));
  assert('Rate = 8', near(r.taxRate, 8));
  assert('Name includes NY', r.components[0].name.includes('NY'));
}

// ──────────────────────────────────
// Test 11: Large amount accuracy
// ──────────────────────────────────
async function testLargeAmount() {
  console.log('\n=== Test 11: Large amount precision ===');

  const r = await calcUS('CA', 'CA', 999999.99);
  // 999999.99 * 7.25 / 100 = 72499.999275 → round → 72500
  const expected = Math.round(999999.99 * 7.25) / 100;
  assert(`$999,999.99 @ 7.25%: tax=$${r.totalTax} == $${expected}`, near(r.totalTax, expected));

  const r2 = await calcUS('NY', 'NY', 1000000);
  assert(`$1,000,000 @ 8%: tax=$${r2.totalTax} == $80000`, near(r2.totalTax, 80000));

  // Small amount
  const r3 = await calcUS('TX', 'TX', 0.01);
  assert(`$0.01 @ 6.25%: tax=$${r3.totalTax}`, r3.totalTax >= 0);
}

// ──────────────────────────────────
// Test 12: Component name includes state
// ──────────────────────────────────
async function testComponentName() {
  console.log('\n=== Test 12: Component naming ===');

  const states = ['CA', 'NY', 'TX', 'FL', 'WA'];
  for (const st of states) {
    const r = await calcUS(st, st, 1000);
    const comp = r.components[0];
    assert(`${st}: name="${comp.name}" includes "${st}"`, comp.name.includes(st));
  }
}

// ──────────────────────────────────
// Test 13: Type is always SALES_TAX
// ──────────────────────────────────
async function testTypeConsistency() {
  console.log('\n=== Test 13: Type consistency ===');

  const states = ['CA', 'NY', 'TX', 'FL', 'WA', 'OR', 'NH', null];
  for (const st of states) {
    const r = await calcUS(st || 'CA', st, 1000, 5);
    assert(`State ${st || 'null'}: type=SALES_TAX`, r.components[0].type === 'SALES_TAX');
  }
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();

    await testSeededStateRates();
    await testNoTaxStates();
    await testCrossStateBuyerRate();
    await testBuyerStateMissing();
    await testBothStatesMissing();
    await testUnknownState();
    await testMultiItemSameState();
    await testMultiItemNoTax();
    await testSellerCABuyerOR();
    await testSellerORBuyerNY();
    await testLargeAmount();
    await testComponentName();
    await testTypeConsistency();

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
