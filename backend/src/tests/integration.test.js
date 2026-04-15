/**
 * End-to-end integration test: Purchase → Stock → Sale → Reconciliation
 *
 * Validates that the full purchase-to-sale lifecycle maintains correct stock
 * balances, movement audit trails, and financial totals.
 *
 * Usage:  NODE_ENV=production node src/tests/integration.test.js
 * Prereq: npm run seed (server NOT running)
 */

require('dotenv').config();
const { sequelize, Product, Inventory, StockMovement, User, Role, Supplier, Sale, Purchase } = require('../models');
const StockService = require('../services/stock.service');
const SalesService = require('../services/sales.service');
const PurchaseService = require('../services/purchase.service');

let user;
let supplier;
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label} ${detail}`);
    failed++;
  }
}

async function getStock(productId) {
  const [rows] = await sequelize.query(
    'SELECT stock_quantity FROM inventory WHERE product_id = :pid AND warehouse_id IS NULL',
    { replacements: { pid: productId } }
  );
  return rows[0]?.stock_quantity ?? null;
}

async function getMovementsSum(productId) {
  const [rows] = await sequelize.query(
    'SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_movements WHERE product_id = :pid',
    { replacements: { pid: productId } }
  );
  return parseInt(rows[0].total, 10);
}

async function getMovementsCount(productId, type, reference) {
  const [rows] = await sequelize.query(
    'SELECT COUNT(*) AS cnt FROM stock_movements WHERE product_id = :pid AND type = :type AND reference = :ref',
    { replacements: { pid: productId, type, ref: reference } }
  );
  return parseInt(rows[0].cnt, 10);
}

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');

  user = await User.findOne({ where: { email: 'admin@erp.local' }, include: [{ model: Role, as: 'role' }] });
  supplier = await Supplier.findOne({ where: { status: 'active' } });

  if (!user || !supplier) { console.error('Run `npm run seed` first.'); process.exit(1); }
}

// ──────────────────────────────────────────────
// Test 1: Seeded data consistency
// ──────────────────────────────────────────────
async function testSeedConsistency() {
  console.log('=== Test 1: Seeded data consistency ===');

  const products = await Product.findAll({ where: { status: 'active' } });
  assert('Products exist', products.length === 7, `got ${products.length}`);

  // Check every product: inventory == SUM(stock_movements)
  let allMatch = true;
  for (const p of products) {
    const stock = await getStock(p.id);
    const movSum = await getMovementsSum(p.id);
    if (stock !== movSum) {
      assert(`Product ${p.id} (${p.sku}) inventory=${stock} vs movements=${movSum}`, false);
      allMatch = false;
    }
  }
  if (allMatch) assert('All seeded products: inventory matches movements sum', true);

  // Global reconciliation
  const mismatches = await StockService.reconcile();
  assert('Global reconciliation: 0 mismatches', mismatches.length === 0, `got ${mismatches.length}`);
}

// ──────────────────────────────────────────────
// Test 2: Purchase → stock increases correctly
// ──────────────────────────────────────────────
async function testPurchaseStockIn() {
  console.log('\n=== Test 2: Purchase → stock IN ===');

  const product = await Product.findOne({ where: { sku: 'ELEC-HP-002' } }); // HP Mouse
  const stockBefore = await getStock(product.id);

  const purchase = await PurchaseService.createPurchase({
    supplier_id: supplier.id,
    items: [{ product_id: product.id, quantity: 50, unit_price: 480 }],
    paid_amount: 0,
  }, user.id);

  const stockAfter = await getStock(product.id);
  assert(`Stock increased: ${stockBefore} + 50 = ${stockAfter}`, stockAfter === stockBefore + 50);

  // Check movement was created
  const movCount = await getMovementsCount(product.id, 'IN', 'purchase');
  assert('Stock movement (type=IN, ref=purchase) recorded', movCount > 0);

  // Check purchase totals
  const sub = 480 * 50;
  const tax = Math.round(sub * 18) / 100; // 18% GST
  const total = Math.round((sub + tax) * 100) / 100;
  assert(`Purchase total: ${sub} + ${tax} tax = ${total}`, parseFloat(purchase.final_amount) === total,
    `got ${purchase.final_amount}`);
  assert('Purchase status: UNPAID', purchase.payment_status === 'UNPAID');

  // Reconciliation still passes
  const m = await StockService.reconcile();
  assert('Reconciliation after purchase: 0 mismatches', m.length === 0, `got ${m.length}`);
}

// ──────────────────────────────────────────────
// Test 3: Sale → stock decreases correctly
// ──────────────────────────────────────────────
async function testSaleStockOut() {
  console.log('\n=== Test 3: Sale → stock OUT ===');

  const product = await Product.findOne({ where: { sku: 'ELEC-HP-002' } });
  const stockBefore = await getStock(product.id);

  const sale = await SalesService.createSale({
    items: [{ product_id: product.id, quantity: 10 }],
    payment_method: 'CASH',
    paid_amount: 99999,
  }, user.id);

  const stockAfter = await getStock(product.id);
  assert(`Stock decreased: ${stockBefore} - 10 = ${stockAfter}`, stockAfter === stockBefore - 10);

  const movCount = await getMovementsCount(product.id, 'OUT', 'sale');
  assert('Stock movement (type=OUT, ref=sale) recorded', movCount > 0);

  // Sale totals
  const sub = 800 * 10; // selling_price = 800
  const tax = Math.round(sub * 18) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  assert(`Sale total: ${sub} + ${tax} tax = ${total}`, parseFloat(sale.final_amount) === total,
    `got ${sale.final_amount}`);
  assert('Sale status: PAID', sale.payment_status === 'PAID');

  const m = await StockService.reconcile();
  assert('Reconciliation after sale: 0 mismatches', m.length === 0, `got ${m.length}`);
}

// ──────────────────────────────────────────────
// Test 4: Purchase → Sell more than initial stock → verify
// ──────────────────────────────────────────────
async function testBuyThenSellSequence() {
  console.log('\n=== Test 4: Buy 100 → Sell 80 → check stock ===');

  const product = await Product.findOne({ where: { sku: 'FURN-GDR-002' } }); // Almirah, low stock
  const stockBefore = await getStock(product.id);

  // Purchase 100
  await PurchaseService.createPurchase({
    supplier_id: supplier.id,
    items: [{ product_id: product.id, quantity: 100, unit_price: 14500 }],
    paid_amount: 0,
  }, user.id);

  const stockAfterPurchase = await getStock(product.id);
  assert(`After purchase: ${stockBefore} + 100 = ${stockAfterPurchase}`, stockAfterPurchase === stockBefore + 100);

  // Sell 80
  await SalesService.createSale({
    items: [{ product_id: product.id, quantity: 80 }],
    payment_method: 'UPI',
    paid_amount: 99999999,
  }, user.id);

  const stockAfterSale = await getStock(product.id);
  const expected = stockBefore + 100 - 80;
  assert(`After sale: ${stockAfterPurchase} - 80 = ${stockAfterSale}`, stockAfterSale === expected,
    `expected ${expected}`);

  const m = await StockService.reconcile();
  assert('Reconciliation: 0 mismatches', m.length === 0, `got ${m.length}`);
}

// ──────────────────────────────────────────────
// Test 5: Sale rejected when stock insufficient
// ──────────────────────────────────────────────
async function testSaleInsufficientStock() {
  console.log('\n=== Test 5: Sale rejected when stock insufficient ===');

  const product = await Product.findOne({ where: { sku: 'FURN-GDR-002' } });
  const stockBefore = await getStock(product.id);

  let errorMsg = null;
  try {
    await SalesService.createSale({
      items: [{ product_id: product.id, quantity: stockBefore + 999 }],
      payment_method: 'CASH',
      paid_amount: 0,
    }, user.id);
  } catch (err) {
    errorMsg = err.message;
  }

  const stockAfter = await getStock(product.id);
  assert('Sale was rejected', errorMsg !== null);
  assert('Error mentions insufficient stock', errorMsg?.includes('Insufficient'), `got: ${errorMsg}`);
  assert(`Stock unchanged: ${stockBefore} = ${stockAfter}`, stockAfter === stockBefore);
}

// ──────────────────────────────────────────────
// Test 6: Manual adjustment + purchase + sale — mixed flow
// ──────────────────────────────────────────────
async function testMixedFlow() {
  console.log('\n=== Test 6: Manual adj + purchase + sale mixed ===');

  const product = await Product.findOne({ where: { sku: 'STAT-CEL-001' } }); // Pens
  const stockBefore = await getStock(product.id);

  // Manual adjustment: +25
  await StockService.addStock({
    product_id: product.id, quantity: 25, reference: 'manual',
    notes: 'Integration test adj', user_id: user.id,
  });
  const s1 = await getStock(product.id);
  assert(`After manual +25: ${stockBefore} + 25 = ${s1}`, s1 === stockBefore + 25);

  // Purchase: +100
  await PurchaseService.createPurchase({
    supplier_id: supplier.id,
    items: [{ product_id: product.id, quantity: 100, unit_price: 75 }],
    paid_amount: 0,
  }, user.id);
  const s2 = await getStock(product.id);
  assert(`After purchase +100: ${s1} + 100 = ${s2}`, s2 === s1 + 100);

  // Sale: -30
  await SalesService.createSale({
    items: [{ product_id: product.id, quantity: 30 }],
    payment_method: 'CASH',
    paid_amount: 99999,
  }, user.id);
  const s3 = await getStock(product.id);
  assert(`After sale -30: ${s2} - 30 = ${s3}`, s3 === s2 - 30);

  // Manual removal: -10
  await StockService.removeStock({
    product_id: product.id, quantity: 10, reference: 'manual',
    notes: 'Integration test remove', user_id: user.id,
  });
  const s4 = await getStock(product.id);
  assert(`After manual -10: ${s3} - 10 = ${s4}`, s4 === s3 - 10);

  const total = stockBefore + 25 + 100 - 30 - 10;
  assert(`Final stock: ${total} = ${s4}`, s4 === total);

  const m = await StockService.reconcile();
  assert('Reconciliation: 0 mismatches', m.length === 0, `got ${m.length}`);
}

// ──────────────────────────────────────────────
// Test 7: Concurrent purchase + sale on same product
// ──────────────────────────────────────────────
async function testConcurrentPurchaseAndSale() {
  console.log('\n=== Test 7: Concurrent purchase + sale on same product ===');

  const product = await Product.findOne({ where: { sku: 'ELEC-DELL-001' } }); // Dell Monitor
  const stockBefore = await getStock(product.id);

  // Fire purchase (+20) and sale (-5) concurrently
  const [purResult, saleResult] = await Promise.allSettled([
    PurchaseService.createPurchase({
      supplier_id: supplier.id,
      items: [{ product_id: product.id, quantity: 20, unit_price: 11800 }],
      paid_amount: 0,
    }, user.id),
    SalesService.createSale({
      items: [{ product_id: product.id, quantity: 5 }],
      payment_method: 'CASH',
      paid_amount: 99999,
    }, user.id),
  ]);

  const purOK = purResult.status === 'fulfilled';
  const saleOK = saleResult.status === 'fulfilled';

  const delta = (purOK ? 20 : 0) - (saleOK ? 5 : 0);
  const stockAfter = await getStock(product.id);
  const expected = stockBefore + delta;

  assert(`Purchase ${purOK ? 'OK' : 'FAIL'}, Sale ${saleOK ? 'OK' : 'FAIL'}`, true);
  assert(`Stock: ${stockBefore} + ${delta} = ${stockAfter}`, stockAfter === expected,
    `expected ${expected}`);

  const m = await StockService.reconcile();
  assert('Reconciliation: 0 mismatches', m.length === 0, `got ${m.length}`);
}

// ──────────────────────────────────────────────
// Test 8: Multi-item purchase + multi-item sale
// ──────────────────────────────────────────────
async function testMultiItemTransactions() {
  console.log('\n=== Test 8: Multi-item purchase + sale ===');

  const p1 = await Product.findOne({ where: { sku: 'ELEC-HP-001' } });
  const p2 = await Product.findOne({ where: { sku: 'STAT-GEN-001' } });
  const s1Before = await getStock(p1.id);
  const s2Before = await getStock(p2.id);

  // Purchase both products in one order
  await PurchaseService.createPurchase({
    supplier_id: supplier.id,
    items: [
      { product_id: p1.id, quantity: 3, unit_price: 44000 },
      { product_id: p2.id, quantity: 50, unit_price: 240 },
    ],
    paid_amount: 0,
  }, user.id);

  assert(`Product ${p1.sku}: ${s1Before} + 3 = ${await getStock(p1.id)}`, await getStock(p1.id) === s1Before + 3);
  assert(`Product ${p2.sku}: ${s2Before} + 50 = ${await getStock(p2.id)}`, await getStock(p2.id) === s2Before + 50);

  // Sell both in one sale
  const s1Mid = await getStock(p1.id);
  const s2Mid = await getStock(p2.id);

  await SalesService.createSale({
    items: [
      { product_id: p1.id, quantity: 2 },
      { product_id: p2.id, quantity: 10 },
    ],
    payment_method: 'CARD',
    paid_amount: 99999999,
  }, user.id);

  assert(`Product ${p1.sku}: ${s1Mid} - 2 = ${await getStock(p1.id)}`, await getStock(p1.id) === s1Mid - 2);
  assert(`Product ${p2.sku}: ${s2Mid} - 10 = ${await getStock(p2.id)}`, await getStock(p2.id) === s2Mid - 10);

  const m = await StockService.reconcile();
  assert('Reconciliation: 0 mismatches', m.length === 0, `got ${m.length}`);
}

// ──────────────────────────────────────────────
// Test 9: GST calculation parity between purchase and sale
// ──────────────────────────────────────────────
async function testGSTCalculation() {
  console.log('\n=== Test 9: GST calculation accuracy ===');

  const product = await Product.findOne({ where: { sku: 'STAT-GEN-001' } }); // 5% GST

  // Purchase: 30 x 250 = 7500, 5% tax = 375, total = 7875
  const pur = await PurchaseService.createPurchase({
    supplier_id: supplier.id,
    items: [{ product_id: product.id, quantity: 30, unit_price: 250 }],
    paid_amount: 0,
  }, user.id);

  assert('Purchase subtotal = 7500', parseFloat(pur.total_amount) === 7500);
  assert('Purchase tax = 375', parseFloat(pur.tax_amount) === 375);
  assert('Purchase final = 7875', parseFloat(pur.final_amount) === 7875);

  // Sale: 10 x 350 = 3500, 5% tax = 175, total = 3675
  const sale = await SalesService.createSale({
    items: [{ product_id: product.id, quantity: 10 }],
    payment_method: 'CASH',
    paid_amount: 99999,
  }, user.id);

  assert('Sale subtotal = 3500', parseFloat(sale.total_amount) === 3500);
  assert('Sale tax = 175', parseFloat(sale.tax_amount) === 175);
  assert('Sale final = 3675', parseFloat(sale.final_amount) === 3675);
}

// ──────────────────────────────────────────────
// Test 10: Full reconciliation across all products
// ──────────────────────────────────────────────
async function testFinalReconciliation() {
  console.log('\n=== Test 10: Final global reconciliation ===');

  const mismatches = await StockService.reconcile();
  assert('0 mismatches across all products', mismatches.length === 0, `got ${mismatches.length}`);

  if (mismatches.length > 0) {
    for (const m of mismatches) {
      console.log(`    product_id=${m.product_id}: inventory=${m.current_stock}, movements=${m.movements_sum}, drift=${m.drift}`);
    }
  }

  // Cross-check: for every product, inventory = SUM(movements)
  const products = await Product.findAll();
  let perfect = true;
  for (const p of products) {
    const stock = await getStock(p.id);
    const movSum = await getMovementsSum(p.id);
    if (stock !== movSum) {
      console.log(`    MISMATCH: product ${p.id} (${p.sku}): inventory=${stock}, movements_sum=${movSum}`);
      perfect = false;
    }
  }
  assert('Per-product cross-check: all match', perfect);
}

// ──────────────────────────────────────────────
async function run() {
  try {
    await setup();

    await testSeedConsistency();
    await testPurchaseStockIn();
    await testSaleStockOut();
    await testBuyThenSellSequence();
    await testSaleInsufficientStock();
    await testMixedFlow();
    await testConcurrentPurchaseAndSale();
    await testMultiItemTransactions();
    await testGSTCalculation();
    await testFinalReconciliation();

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
