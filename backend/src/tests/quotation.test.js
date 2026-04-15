/**
 * Quotation-to-Sale conversion and stock consistency test.
 *
 * Validates:
 * 1. Quotation creation does NOT affect stock
 * 2. Quotation totals match item sums (same formula as sales)
 * 3. Status transitions work correctly
 * 4. Converting quotation → sale deducts stock correctly
 * 5. Converted sale amounts match quotation amounts
 * 6. Double conversion is rejected
 * 7. Rejected quotation cannot be converted
 * 8. Conversion with insufficient stock is rejected, stock unchanged
 * 9. Concurrent conversions of different quotations maintain consistency
 * 10. Stock reconciliation passes after all operations
 *
 * Usage: NODE_ENV=production node src/tests/quotation.test.js
 */

require('dotenv').config();
const { sequelize, Product, Inventory, StockMovement, User, Role, Quotation, QuotationItem, Sale } = require('../models');
const QuotationService = require('../services/quotation.service');
const StockService = require('../services/stock.service');

let user;
let passed = 0, failed = 0;

function assert(label, cond, detail = '') {
  if (cond) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}
function near(a, b, eps = 0.01) { return Math.abs(a - b) < eps; }

async function getStock(productId) {
  const [rows] = await sequelize.query(
    'SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id IS NULL',
    { replacements: { pid: productId } }
  );
  return rows[0]?.stock_quantity ?? null;
}

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');
  user = await User.findOne({ where: { email: 'admin@erp.local' }, include: [{ model: Role, as: 'role' }] });
  if (!user) { console.error('Run `npm run seed` first.'); process.exit(1); }
}

// ──────────────────────────────────
// Test 1: Quotation does NOT affect stock
// ──────────────────────────────────
async function testQuotationNoStock() {
  console.log('=== Test 1: Quotation creation does NOT affect stock ===');

  const stockBefore = {};
  for (const pid of [1, 3]) { stockBefore[pid] = await getStock(pid); }

  const quo = await QuotationService.create({
    customer_id: 2,
    items: [{ product_id: 1, quantity: 5 }, { product_id: 3, quantity: 20 }],
    discount_amount: 500,
  }, user.id);

  assert('Quotation created', !!quo.quotation_number);
  assert('Status is DRAFT', quo.status === 'DRAFT');

  for (const pid of [1, 3]) {
    const stockAfter = await getStock(pid);
    assert(`Product ${pid}: stock unchanged (${stockBefore[pid]} → ${stockAfter})`, stockBefore[pid] === stockAfter);
  }

  // No stock movements created
  const [[movCount]] = await sequelize.query(
    "SELECT COUNT(*) AS cnt FROM stock_movements WHERE notes LIKE :pattern",
    { replacements: { pattern: `%${quo.quotation_number}%` } }
  );
  assert('No stock movements for quotation', parseInt(movCount.cnt) === 0);

  return quo;
}

// ──────────────────────────────────
// Test 2: Quotation totals match item sums
// ──────────────────────────────────
async function testQuotationMath(quo) {
  console.log('\n=== Test 2: Quotation total accuracy ===');

  const fullQuo = await Quotation.findByPk(quo.id, { include: [{ association: 'items' }] });

  const itemSub = fullQuo.items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
  const itemTax = fullQuo.items.reduce((s, i) => s + parseFloat(i.tax_amount), 0);

  assert(`Subtotal: ${fullQuo.total_amount} == items ${itemSub.toFixed(2)}`, near(parseFloat(fullQuo.total_amount), itemSub));
  assert(`Tax: ${fullQuo.tax_amount} == items ${itemTax.toFixed(2)}`, near(parseFloat(fullQuo.tax_amount), itemTax));

  const expectedFinal = parseFloat(fullQuo.total_amount) + parseFloat(fullQuo.tax_amount) - parseFloat(fullQuo.discount_amount);
  assert(`Final: ${fullQuo.final_amount} == ${expectedFinal.toFixed(2)}`, near(parseFloat(fullQuo.final_amount), expectedFinal));

  // Per-item tax formula matches
  for (const item of fullQuo.items) {
    const sub = parseFloat(item.unit_price) * item.quantity;
    const expectedTax = Math.round(sub * parseFloat(item.tax_rate)) / 100;
    assert(`Item "${item.product_name}": tax ${item.tax_amount} == ${expectedTax}`, near(parseFloat(item.tax_amount), expectedTax));
  }
}

// ──────────────────────────────────
// Test 3: Status transitions
// ──────────────────────────────────
async function testStatusTransitions() {
  console.log('\n=== Test 3: Status transitions ===');

  const quo = await QuotationService.create({
    items: [{ product_id: 6, quantity: 5 }],
  }, user.id);

  assert('Created as DRAFT', quo.status === 'DRAFT');

  await QuotationService.updateStatus(quo.id, 'SENT');
  const q2 = await Quotation.findByPk(quo.id);
  assert('DRAFT → SENT', q2.status === 'SENT');

  await QuotationService.updateStatus(quo.id, 'ACCEPTED');
  const q3 = await Quotation.findByPk(quo.id);
  assert('SENT → ACCEPTED', q3.status === 'ACCEPTED');

  return quo;
}

// ──────────────────────────────────
// Test 4: Convert quotation → sale deducts stock
// ──────────────────────────────────
async function testConversionStockDeduction(quoFromTest1) {
  console.log('\n=== Test 4: Conversion deducts stock correctly ===');

  const fullQuo = await Quotation.findByPk(quoFromTest1.id, { include: [{ association: 'items' }] });

  const stockBefore = {};
  for (const item of fullQuo.items) {
    stockBefore[item.product_id] = await getStock(item.product_id);
  }

  const result = await QuotationService.convertToSale(quoFromTest1.id, {
    payment_method: 'CASH', paid_amount: 99999,
  }, user.id);

  assert('Quotation status → CONVERTED', result.quotation.status === 'CONVERTED');
  assert('Sale created', !!result.sale.invoice_number);
  assert('converted_sale_id set', result.quotation.converted_sale_id === result.sale.id);

  for (const item of fullQuo.items) {
    const stockAfter = await getStock(item.product_id);
    const expected = stockBefore[item.product_id] - item.quantity;
    assert(
      `Product ${item.product_id}: ${stockBefore[item.product_id]} - ${item.quantity} = ${stockAfter}`,
      stockAfter === expected, `expected ${expected}`
    );
  }

  return result;
}

// ──────────────────────────────────
// Test 5: Sale amounts match quotation
// ──────────────────────────────────
async function testSaleMatchesQuotation(result) {
  console.log('\n=== Test 5: Sale amounts match quotation ===');

  const quo = await Quotation.findByPk(result.quotation.id);
  const sale = await Sale.findByPk(result.sale.id);

  assert(`Subtotal: sale ${sale.total_amount} == quo ${quo.total_amount}`,
    near(parseFloat(sale.total_amount), parseFloat(quo.total_amount)));
  assert(`Tax: sale ${sale.tax_amount} == quo ${quo.tax_amount}`,
    near(parseFloat(sale.tax_amount), parseFloat(quo.tax_amount)));
  assert(`Discount: sale ${sale.discount_amount} == quo ${quo.discount_amount}`,
    near(parseFloat(sale.discount_amount), parseFloat(quo.discount_amount)));
  assert(`Final: sale ${sale.final_amount} == quo ${quo.final_amount}`,
    near(parseFloat(sale.final_amount), parseFloat(quo.final_amount)));
}

// ──────────────────────────────────
// Test 6: Double conversion rejected
// ──────────────────────────────────
async function testDoubleConversion(result) {
  console.log('\n=== Test 6: Double conversion rejected ===');

  let err = null;
  try {
    await QuotationService.convertToSale(result.quotation.id, { paid_amount: 0 }, user.id);
  } catch (e) { err = e; }

  assert('Double conversion throws error', !!err);
  assert('Error message correct', err?.message?.includes('already converted'), `got: ${err?.message}`);
}

// ──────────────────────────────────
// Test 7: Rejected quotation cannot convert
// ──────────────────────────────────
async function testRejectedConversion() {
  console.log('\n=== Test 7: Rejected quotation cannot convert ===');

  const quo = await QuotationService.create({
    items: [{ product_id: 1, quantity: 1 }],
  }, user.id);
  await QuotationService.updateStatus(quo.id, 'REJECTED');

  let err = null;
  try {
    await QuotationService.convertToSale(quo.id, { paid_amount: 0 }, user.id);
  } catch (e) { err = e; }

  assert('Rejected conversion throws error', !!err);
  assert('Error mentions rejected', err?.message?.includes('rejected'), `got: ${err?.message}`);
}

// ──────────────────────────────────
// Test 8: Conversion with insufficient stock
// ──────────────────────────────────
async function testConversionInsufficientStock() {
  console.log('\n=== Test 8: Conversion with insufficient stock ===');

  // Product 5 (Almirah) has very low stock
  const stock = await getStock(5);
  const qty = stock + 999;

  const quo = await QuotationService.create({
    items: [{ product_id: 5, quantity: qty }],
  }, user.id);

  const stockBefore = await getStock(5);

  let err = null;
  try {
    await QuotationService.convertToSale(quo.id, { paid_amount: 0 }, user.id);
  } catch (e) { err = e; }

  const stockAfter = await getStock(5);

  assert('Conversion rejected', !!err);
  assert('Error mentions insufficient', err?.message?.includes('Insufficient'), `got: ${err?.message}`);
  assert(`Stock unchanged: ${stockBefore} = ${stockAfter}`, stockBefore === stockAfter);

  // Quotation status should NOT be CONVERTED
  const q = await Quotation.findByPk(quo.id);
  assert('Quotation still DRAFT (not converted)', q.status === 'DRAFT');
}

// ──────────────────────────────────
// Test 9: Concurrent conversions
// ──────────────────────────────────
async function testConcurrentConversions() {
  console.log('\n=== Test 9: Concurrent conversions (different quotations) ===');

  // Create 5 quotations for product 3 (HP Mouse, plenty of stock)
  const stock = await getStock(3);
  const qty = 2;
  const quotations = [];

  for (let i = 0; i < 5; i++) {
    const quo = await QuotationService.create({
      items: [{ product_id: 3, quantity: qty }],
    }, user.id);
    quotations.push(quo);
  }

  assert(`Created 5 quotations, stock before: ${stock}`, quotations.length === 5);

  // Convert all 5 concurrently
  const results = await Promise.allSettled(
    quotations.map((q) => QuotationService.convertToSale(q.id, { paid_amount: 0 }, user.id))
  );

  const successes = results.filter((r) => r.status === 'fulfilled').length;
  const failures = results.filter((r) => r.status === 'rejected').length;

  const stockAfter = await getStock(3);
  const expected = stock - (successes * qty);

  assert(`Conversions: ${successes} OK, ${failures} failed`, true);
  assert(`Stock: ${stock} - (${successes} x ${qty}) = ${stockAfter}`, stockAfter === expected, `expected ${expected}`);
}

// ──────────────────────────────────
// Test 10: Final reconciliation
// ──────────────────────────────────
async function testReconciliation() {
  console.log('\n=== Test 10: Stock reconciliation ===');

  const mismatches = await StockService.reconcile();
  assert('0 mismatches', mismatches.length === 0, `got ${mismatches.length}`);

  if (mismatches.length > 0) {
    mismatches.forEach((m) => console.log(`    product=${m.product_id}: inventory=${m.current_stock}, movements=${m.movements_sum}, drift=${m.drift}`));
  }
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();

    const quo = await testQuotationNoStock();
    await testQuotationMath(quo);
    await testStatusTransitions();
    const result = await testConversionStockDeduction(quo);
    await testSaleMatchesQuotation(result);
    await testDoubleConversion(result);
    await testRejectedConversion();
    await testConversionInsufficientStock();
    await testConcurrentConversions();
    await testReconciliation();

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
