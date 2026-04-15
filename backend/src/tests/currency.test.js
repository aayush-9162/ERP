/**
 * Currency conversion consistency test.
 *
 * Validates:
 * 1.  Direct conversion (USD → INR) uses stored rate
 * 2.  Inverse conversion (INR → USD) computes correct inverse
 * 3.  Same currency returns identity (rate=1, amount unchanged)
 * 4.  Round-trip consistency: A→B→A ≈ original (within rounding tolerance)
 * 5.  All seeded direct pairs work
 * 6.  All seeded inverse pairs work
 * 7.  Cross conversion via common currency (EUR→GBP via rates)
 * 8.  Large amount precision (no floating-point drift)
 * 9.  Small amount precision (fractional cents)
 * 10. Missing pair throws error
 * 11. Currency formatting with correct symbols
 * 12. Invoice scenario: USD sale, base currency INR
 * 13. Multi-line invoice consistency (sum of converted items = converted total)
 * 14. Cache consistency (same rate on repeated calls)
 *
 * Usage: NODE_ENV=production node src/tests/currency.test.js
 */

require('dotenv').config();
const { sequelize } = require('../models');
const CurrencyService = require('../services/currency.service');

let passed = 0, failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }

async function setup() {
  await sequelize.authenticate();
  CurrencyService._cache = {}; // Clear cache for fresh test
  console.log('DB connected.\n');
}

// ──────────────────────────────────
// Test 1: Direct conversion (USD → INR)
// ──────────────────────────────────
async function testDirectConversion() {
  console.log('=== Test 1: Direct conversion ===');

  const r = await CurrencyService.convert(100, 'USD', 'INR');
  assert('100 USD → INR: amount=8350', near(r.amount, 8350));
  assert('Rate = 83.5', near(r.rate, 83.5));

  const r2 = await CurrencyService.convert(1, 'EUR', 'INR');
  assert('1 EUR → INR: amount=90.20', near(r2.amount, 90.20));

  const r3 = await CurrencyService.convert(50, 'GBP', 'INR');
  assert('50 GBP → INR: amount=5265', near(r3.amount, 5265));
}

// ──────────────────────────────────
// Test 2: Inverse conversion (INR → USD)
// ──────────────────────────────────
async function testInverseConversion() {
  console.log('\n=== Test 2: Inverse conversion ===');

  const r = await CurrencyService.convert(8350, 'INR', 'USD');
  // Inverse rate: 1/83.5 = 0.011976...
  const expectedRate = Math.round((1 / 83.5) * 1000000) / 1000000;
  assert(`8350 INR → USD: rate≈${expectedRate}`, near(r.rate, expectedRate, 0.000001));
  assert('8350 INR ≈ 100 USD', near(r.amount, 100, 0.1));

  const r2 = await CurrencyService.convert(9020, 'INR', 'EUR');
  assert('9020 INR ≈ 100 EUR', near(r2.amount, 100, 0.5));
}

// ──────────────────────────────────
// Test 3: Same currency (identity)
// ──────────────────────────────────
async function testSameCurrency() {
  console.log('\n=== Test 3: Same currency identity ===');

  const r = await CurrencyService.convert(12345.67, 'USD', 'USD');
  assert('USD→USD: amount unchanged', r.amount === 12345.67);
  assert('USD→USD: rate = 1', r.rate === 1);

  const r2 = await CurrencyService.convert(0, 'INR', 'INR');
  assert('0 INR→INR: amount = 0', r2.amount === 0);
}

// ──────────────────────────────────
// Test 4: Round-trip consistency (A→B→A)
// ──────────────────────────────────
async function testRoundTrip() {
  console.log('\n=== Test 4: Round-trip A→B→A ===');

  const original = 1000;

  // USD → INR → USD
  const toINR = await CurrencyService.convert(original, 'USD', 'INR');
  const backToUSD = await CurrencyService.convert(toINR.amount, 'INR', 'USD');
  assert(`USD round-trip: ${original} → ${toINR.amount} INR → ${backToUSD.amount} USD`,
    near(backToUSD.amount, original, 0.5), `drift: ${Math.abs(backToUSD.amount - original).toFixed(2)}`);

  // EUR → INR → EUR
  const toINR2 = await CurrencyService.convert(original, 'EUR', 'INR');
  const backToEUR = await CurrencyService.convert(toINR2.amount, 'INR', 'EUR');
  assert(`EUR round-trip: ${original} → ${toINR2.amount} INR → ${backToEUR.amount} EUR`,
    near(backToEUR.amount, original, 0.5));

  // GBP → INR → GBP
  const toINR3 = await CurrencyService.convert(original, 'GBP', 'INR');
  const backToGBP = await CurrencyService.convert(toINR3.amount, 'INR', 'GBP');
  assert(`GBP round-trip: ${original} → ${toINR3.amount} INR → ${backToGBP.amount} GBP`,
    near(backToGBP.amount, original, 0.5));
}

// ──────────────────────────────────
// Test 5: All seeded direct pairs
// ──────────────────────────────────
async function testAllDirectPairs() {
  console.log('\n=== Test 5: All direct pairs ===');

  const pairs = [
    { from: 'USD', to: 'INR', rate: 83.5 },
    { from: 'EUR', to: 'INR', rate: 90.2 },
    { from: 'GBP', to: 'INR', rate: 105.3 },
    { from: 'AED', to: 'INR', rate: 22.73 },
    { from: 'USD', to: 'EUR', rate: 0.92 },
    { from: 'USD', to: 'GBP', rate: 0.79 },
  ];

  for (const p of pairs) {
    CurrencyService._cache = {}; // Clear cache
    const rate = await CurrencyService.getRate(p.from, p.to);
    assert(`${p.from}→${p.to}: rate=${rate} == ${p.rate}`, near(rate, p.rate, 0.001));
  }
}

// ──────────────────────────────────
// Test 6: All inverse pairs
// ──────────────────────────────────
async function testAllInversePairs() {
  console.log('\n=== Test 6: All inverse pairs ===');

  const pairs = [
    { from: 'INR', to: 'USD', expected: 1 / 83.5 },
    { from: 'INR', to: 'EUR', expected: 1 / 90.2 },
    { from: 'INR', to: 'GBP', expected: 1 / 105.3 },
    { from: 'INR', to: 'AED', expected: 1 / 22.73 },
    { from: 'EUR', to: 'USD', expected: 1 / 0.92 },
    { from: 'GBP', to: 'USD', expected: 1 / 0.79 },
  ];

  for (const p of pairs) {
    CurrencyService._cache = {};
    const rate = await CurrencyService.getRate(p.from, p.to);
    const expectedRounded = Math.round(p.expected * 1000000) / 1000000;
    assert(`${p.from}→${p.to}: rate=${rate} ≈ ${expectedRounded}`, near(rate, expectedRounded, 0.0001));
  }
}

// ──────────────────────────────────
// Test 7: Cross conversion (EUR→GBP)
// ──────────────────────────────────
async function testCrossConversion() {
  console.log('\n=== Test 7: Cross conversion ===');

  // EUR→GBP not directly stored, but EUR→INR and GBP→INR are.
  // Service tries direct first, then inverse. EUR→GBP has no direct or inverse.
  // This should throw an error.
  let threw = false;
  try {
    CurrencyService._cache = {};
    await CurrencyService.convert(100, 'EUR', 'GBP');
  } catch (e) {
    threw = true;
    assert('EUR→GBP: throws "No exchange rate found"', e.message.includes('No exchange rate'));
  }
  if (!threw) assert('EUR→GBP should throw (no direct/inverse pair)', false);

  // But EUR→USD works (inverse of USD→EUR)
  CurrencyService._cache = {};
  const r = await CurrencyService.convert(100, 'EUR', 'USD');
  assert('EUR→USD via inverse: works', r.amount > 0);
  assert('EUR→USD rate ≈ 1.087', near(r.rate, 1 / 0.92, 0.01));
}

// ──────────────────────────────────
// Test 8: Large amounts
// ──────────────────────────────────
async function testLargeAmounts() {
  console.log('\n=== Test 8: Large amount precision ===');

  CurrencyService._cache = {};
  const r = await CurrencyService.convert(1000000, 'USD', 'INR');
  assert('$1M → ₹83,500,000', near(r.amount, 83500000));

  const r2 = await CurrencyService.convert(9999999.99, 'USD', 'INR');
  const expected = Math.round(9999999.99 * 83.5 * 100) / 100;
  assert(`$9,999,999.99 → ₹${expected}`, near(r2.amount, expected));
}

// ──────────────────────────────────
// Test 9: Small amounts (sub-cent)
// ──────────────────────────────────
async function testSmallAmounts() {
  console.log('\n=== Test 9: Small amount precision ===');

  CurrencyService._cache = {};
  const r = await CurrencyService.convert(0.01, 'USD', 'INR');
  assert('$0.01 → ₹0.84', near(r.amount, 0.84, 0.01));

  const r2 = await CurrencyService.convert(0, 'USD', 'INR');
  assert('$0 → ₹0', r2.amount === 0);
}

// ──────────────────────────────────
// Test 10: Missing pair throws error
// ──────────────────────────────────
async function testMissingPair() {
  console.log('\n=== Test 10: Missing pair error ===');

  let threw = false;
  try {
    CurrencyService._cache = {};
    await CurrencyService.convert(100, 'JPY', 'INR');
  } catch (e) {
    threw = true;
    assert('JPY→INR: throws error', e.message.includes('No exchange rate'));
  }
  if (!threw) assert('JPY→INR should throw', false);
}

// ──────────────────────────────────
// Test 11: Currency formatting
// ──────────────────────────────────
async function testFormatting() {
  console.log('\n=== Test 11: Currency formatting ===');

  const inr = await CurrencyService.formatAmount(12345.67, 'INR');
  assert(`INR format: "${inr}" contains ₹`, inr.includes('₹'));
  assert(`INR format: "${inr}" contains 12,345.67 or 12345.67`, inr.includes('12') && inr.includes('.67'));

  const usd = await CurrencyService.formatAmount(1000, 'USD');
  assert(`USD format: "${usd}" contains $`, usd.includes('$'));

  const gbp = await CurrencyService.formatAmount(500.50, 'GBP');
  assert(`GBP format: "${gbp}" contains £`, gbp.includes('£'));
}

// ──────────────────────────────────
// Test 12: Invoice scenario (USD sale, base INR)
// ──────────────────────────────────
async function testInvoiceScenario() {
  console.log('\n=== Test 12: Invoice conversion scenario ===');

  // Simulate: US company sells to Indian customer
  // Invoice in USD: subtotal=1000, tax=80, final=1080
  const subtotal = 1000;
  const tax = 80;
  const final_amount = 1080;

  CurrencyService._cache = {};
  const subConverted = await CurrencyService.convert(subtotal, 'USD', 'INR');
  const taxConverted = await CurrencyService.convert(tax, 'USD', 'INR');
  const finalConverted = await CurrencyService.convert(final_amount, 'USD', 'INR');

  // All should use the same rate
  assert('Same rate for subtotal and tax', subConverted.rate === taxConverted.rate);
  assert('Same rate for subtotal and final', subConverted.rate === finalConverted.rate);

  // Converted subtotal + converted tax should equal converted final
  const sumOfParts = subConverted.amount + taxConverted.amount;
  assert(`Sub(${subConverted.amount}) + Tax(${taxConverted.amount}) = ${sumOfParts} ≈ Final(${finalConverted.amount})`,
    near(sumOfParts, finalConverted.amount, 0.01));
}

// ──────────────────────────────────
// Test 13: Multi-line invoice consistency
// ──────────────────────────────────
async function testMultiLineConsistency() {
  console.log('\n=== Test 13: Multi-line consistency ===');

  const items = [
    { amount: 500 },
    { amount: 300 },
    { amount: 200 },
  ];

  CurrencyService._cache = {};
  const rate = await CurrencyService.getRate('USD', 'INR');

  let sumConverted = 0;
  for (const item of items) {
    const r = await CurrencyService.convert(item.amount, 'USD', 'INR');
    sumConverted += r.amount;
    assert(`Item $${item.amount} → ₹${r.amount} (rate=${r.rate})`, r.rate === rate);
  }

  const totalConverted = await CurrencyService.convert(1000, 'USD', 'INR');
  assert(`Sum of parts (${sumConverted}) = total converted (${totalConverted.amount})`,
    near(sumConverted, totalConverted.amount, 0.01));
}

// ──────────────────────────────────
// Test 14: Cache consistency
// ──────────────────────────────────
async function testCacheConsistency() {
  console.log('\n=== Test 14: Cache consistency ===');

  CurrencyService._cache = {};

  const r1 = await CurrencyService.getRate('USD', 'INR');
  const r2 = await CurrencyService.getRate('USD', 'INR');
  const r3 = await CurrencyService.getRate('USD', 'INR');

  assert('3 calls return same rate', r1 === r2 && r2 === r3);
  assert('Cache populated', !!CurrencyService._cache['USD_INR']);
  assert('Cached value matches', CurrencyService._cache['USD_INR'] === r1);
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();

    await testDirectConversion();
    await testInverseConversion();
    await testSameCurrency();
    await testRoundTrip();
    await testAllDirectPairs();
    await testAllInversePairs();
    await testCrossConversion();
    await testLargeAmounts();
    await testSmallAmounts();
    await testMissingPair();
    await testFormatting();
    await testInvoiceScenario();
    await testMultiLineConsistency();
    await testCacheConsistency();

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
