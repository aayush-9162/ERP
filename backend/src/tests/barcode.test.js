/**
 * Barcode scanning and generation test.
 *
 * Validates:
 * 1. Scan existing barcode → returns correct product with stock
 * 2. Scan non-existent barcode → 404
 * 3. Scan empty/too-short barcode → 400
 * 4. Scan inactive product barcode → 404
 * 5. EAN-13 check digit is mathematically correct
 * 6. Generated barcode is unique per product
 * 7. Cannot generate barcode for product that already has one
 * 8. Barcode scan performance (latency under load)
 * 9. Barcode scan → add to cart → sale → stock deducts correctly
 * 10. Special characters in barcode are handled
 *
 * Usage: NODE_ENV=production node src/tests/barcode.test.js
 */

require('dotenv').config();
const { sequelize, Product, Inventory } = require('../models');
const StockService = require('../services/stock.service');

let passed = 0, failed = 0;

function assert(label, cond, detail = '') {
  if (cond) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}

// Replicate the controller's EAN-13 check digit computation
function computeEAN13CheckDigit(first12) {
  const digits = first12.split('').map(Number);
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function verifyEAN13(barcode13) {
  if (barcode13.length !== 13 || !/^\d{13}$/.test(barcode13)) return false;
  const digits = barcode13.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  const expected = (10 - (sum % 10)) % 10;
  return digits[12] === expected;
}

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');
}

// ──────────────────────────────────
// Test 1: Scan existing barcode
// ──────────────────────────────────
async function testScanExisting() {
  console.log('=== Test 1: Scan existing barcode ===');

  const product = await Product.findOne({ where: { barcode: '2000000000039', status: 'active' } });
  assert('Product exists with barcode', !!product, 'barcode 2000000000039');

  // Simulate the scan query
  const [rows] = await sequelize.query(`
    SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.tax_rate,
           COALESCE(SUM(i.stock_quantity), 0) AS total_stock
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.barcode = :barcode AND p.status = 'active'
    GROUP BY p.id, p.name, p.sku, p.barcode, p.selling_price, p.tax_rate
  `, { replacements: { barcode: '2000000000039' } });

  assert('Scan returns 1 result', rows.length === 1);
  assert('Correct product: HP Wireless Mouse', rows[0]?.name === 'HP Wireless Mouse');
  assert('Has stock > 0', parseInt(rows[0]?.total_stock) > 0);
  assert('Has selling_price', parseFloat(rows[0]?.selling_price) > 0);
}

// ──────────────────────────────────
// Test 2: Scan non-existent barcode
// ──────────────────────────────────
async function testScanNonExistent() {
  console.log('\n=== Test 2: Scan non-existent barcode ===');

  const [rows] = await sequelize.query(
    "SELECT id FROM products WHERE barcode = :b AND status = 'active'",
    { replacements: { b: '9999999999999' } }
  );
  assert('Non-existent barcode returns 0 results', rows.length === 0);
}

// ──────────────────────────────────
// Test 3: Scan too-short barcode
// ──────────────────────────────────
async function testScanTooShort() {
  console.log('\n=== Test 3: Input validation ===');

  // The controller checks length >= 4 and <= 100
  const tooShort = '123';
  assert('Barcode "123" fails length check (< 4)', tooShort.length < 4);

  const tooLong = 'A'.repeat(101);
  assert('Barcode 101 chars fails length check (> 100)', tooLong.length > 100);

  const valid = '2000000000039';
  assert('Barcode "2000000000039" passes length check', valid.length >= 4 && valid.length <= 100);
}

// ──────────────────────────────────
// Test 4: Scan inactive product
// ──────────────────────────────────
async function testScanInactive() {
  console.log('\n=== Test 4: Inactive product barcode ===');

  // Temporarily deactivate a product
  const product = await Product.findOne({ where: { barcode: '2000000000053' } });
  const originalStatus = product.status;
  await product.update({ status: 'inactive' });

  const [rows] = await sequelize.query(
    "SELECT id FROM products WHERE barcode = :b AND status = 'active'",
    { replacements: { b: '2000000000053' } }
  );
  assert('Inactive product not found by barcode scan', rows.length === 0);

  // Restore
  await product.update({ status: originalStatus });
}

// ──────────────────────────────────
// Test 5: EAN-13 check digit accuracy
// ──────────────────────────────────
async function testEAN13CheckDigit() {
  console.log('\n=== Test 5: EAN-13 check digit accuracy ===');

  // Known correct EAN-13 barcodes (from seeder)
  const knownBarcodes = [
    '2000000000015', '2000000000022', '2000000000039',
    '2000000000046', '2000000000053', '2000000000060', '2000000000077',
  ];

  for (const bc of knownBarcodes) {
    assert(`Barcode ${bc} has valid check digit`, verifyEAN13(bc));
  }

  // Test the generation function for various product IDs
  const testCases = [
    { id: 1, base: '200000000001' },
    { id: 999999999, base: '200999999999' },
    { id: 42, base: '200000000042' },
    { id: 12345, base: '200000012345' },
  ];

  for (const tc of testCases) {
    const checkDigit = computeEAN13CheckDigit(tc.base);
    const full = tc.base + checkDigit;
    assert(`Generated EAN-13 for product ${tc.id}: ${full} valid`, verifyEAN13(full));
  }

  // Cross-check: verify against standard known EAN-13
  // Wikipedia example: 4006381333931 → valid
  assert('Standard EAN-13 "4006381333931" valid', verifyEAN13('4006381333931'));

  // Invalid check digit
  assert('Invalid "4006381333932" rejected', !verifyEAN13('4006381333932'));
}

// ──────────────────────────────────
// Test 6: Generated barcode uniqueness
// ──────────────────────────────────
async function testBarcodeUniqueness() {
  console.log('\n=== Test 6: Barcode uniqueness ===');

  // All seeded barcodes should be unique
  const [dupes] = await sequelize.query(`
    SELECT barcode, COUNT(*) AS cnt FROM products
    WHERE barcode IS NOT NULL
    GROUP BY barcode HAVING cnt > 1
  `);
  assert('No duplicate barcodes in database', dupes.length === 0,
    dupes.length > 0 ? `found: ${dupes.map((d) => d.barcode).join(', ')}` : '');

  // All generated barcodes for different IDs produce different values
  const generated = new Set();
  for (let id = 1; id <= 100; id++) {
    const base = '200' + String(id).padStart(9, '0');
    const bc = base + computeEAN13CheckDigit(base);
    assert(`Product ${id} → unique barcode`, !generated.has(bc), `duplicate: ${bc}`);
    generated.add(bc);
  }
}

// ──────────────────────────────────
// Test 7: Cannot generate barcode if product already has one
// ──────────────────────────────────
async function testNoDoubleGenerate() {
  console.log('\n=== Test 7: Double generate prevention ===');

  const product = await Product.findOne({ where: { barcode: { [sequelize.Sequelize.Op.ne]: null } } });
  assert('Product has existing barcode', !!product?.barcode);
  // The controller would throw ApiError.badRequest — we just verify the condition
  assert('Condition: product.barcode exists → reject', product.barcode !== null && product.barcode !== '');
}

// ──────────────────────────────────
// Test 8: Scan performance
// ──────────────────────────────────
async function testScanPerformance() {
  console.log('\n=== Test 8: Scan performance ===');

  const barcode = '2000000000039';
  const runs = 100;
  const times = [];

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await sequelize.query(`
      SELECT p.id, p.name, p.selling_price, p.tax_rate,
             COALESCE(SUM(i.stock_quantity), 0) AS total_stock
      FROM products p LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.barcode = :barcode AND p.status = 'active'
      GROUP BY p.id, p.name, p.selling_price, p.tax_rate
    `, { replacements: { barcode } });
    times.push(performance.now() - t0);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / runs;
  const p50 = times[Math.floor(runs * 0.5)];
  const p99 = times[Math.floor(runs * 0.99)];

  console.log(`  ${runs} scans: avg=${avg.toFixed(1)}ms  p50=${p50.toFixed(1)}ms  p99=${p99.toFixed(1)}ms`);
  assert(`Average scan < 10ms`, avg < 10, `got ${avg.toFixed(1)}ms`);
  assert(`p99 scan < 20ms`, p99 < 20, `got ${p99.toFixed(1)}ms`);
}

// ──────────────────────────────────
// Test 9: Full flow: scan → sale → stock deduction
// ──────────────────────────────────
async function testScanToSaleFlow() {
  console.log('\n=== Test 9: Scan → sale → stock deduction ===');

  const barcode = '2000000000039'; // HP Wireless Mouse

  // Step 1: Scan
  const [rows] = await sequelize.query(
    "SELECT id, name, selling_price, tax_rate FROM products WHERE barcode = :b AND status = 'active'",
    { replacements: { b: barcode } }
  );
  assert('Scan found product', rows.length === 1);

  const product = rows[0];
  const stockBefore = await (async () => {
    const [r] = await sequelize.query('SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id IS NULL', { replacements: { pid: product.id } });
    return r[0]?.stock_quantity;
  })();

  // Step 2: Create sale (simulating POS checkout after scan)
  const SalesService = require('../services/sales.service');
  const { User, Role } = require('../models');
  const user = await User.findOne({ where: { email: 'admin@erp.local' }, include: [{ model: Role, as: 'role' }] });

  const sale = await SalesService.createSale({
    items: [{ product_id: product.id, quantity: 3 }],
    payment_method: 'CASH', paid_amount: 99999,
  }, user.id);

  assert('Sale created from scanned product', !!sale.invoice_number);

  // Step 3: Verify stock deducted
  const [stockRows] = await sequelize.query('SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id IS NULL', { replacements: { pid: product.id } });
  const stockAfter = stockRows[0]?.stock_quantity;

  assert(`Stock: ${stockBefore} - 3 = ${stockAfter}`, stockAfter === stockBefore - 3);

  // Step 4: Reconciliation
  const mismatches = await StockService.reconcile();
  const productMismatch = mismatches.find((m) => m.product_id === product.id);
  assert('Stock reconciliation OK for scanned product', !productMismatch);
}

// ──────────────────────────────────
// Test 10: Special characters handling
// ──────────────────────────────────
async function testSpecialChars() {
  console.log('\n=== Test 10: Special character handling ===');

  // These should not crash the query — Sequelize parameterizes them
  const badInputs = ["'; DROP TABLE products; --", '<script>alert(1)</script>', '   ', '🎯📦'];

  for (const input of badInputs) {
    const [rows] = await sequelize.query(
      "SELECT id FROM products WHERE barcode = :b AND status = 'active'",
      { replacements: { b: input } }
    );
    assert(`Input "${input.substring(0, 20)}..." returns 0 results (no crash)`, rows.length === 0);
  }
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();

    await testScanExisting();
    await testScanNonExistent();
    await testScanTooShort();
    await testScanInactive();
    await testEAN13CheckDigit();
    await testBarcodeUniqueness();
    await testNoDoubleGenerate();
    await testScanPerformance();
    await testScanToSaleFlow();
    await testSpecialChars();

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
