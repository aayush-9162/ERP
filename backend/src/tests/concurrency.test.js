/**
 * Concurrency stress test for stock deduction logic.
 *
 * Proves that:
 * 1. Concurrent sales for the same product serialize correctly (no overselling)
 * 2. Concurrent manual adjustments don't corrupt inventory
 * 3. Mixed concurrent sales + adjustments maintain consistency
 * 4. Stock reconciliation passes after all operations
 *
 * Usage:
 *   node src/tests/concurrency.test.js
 *
 * Prerequisites:
 *   - MySQL running, database seeded (npm run seed)
 *   - Server NOT running (test connects directly to DB)
 */

require('dotenv').config();
const { sequelize, Product, Inventory, StockMovement, User, Role } = require('../models');
const StockService = require('../services/stock.service');
const SalesService = require('../services/sales.service');

const CONCURRENCY = 10; // parallel requests per test
let testUser;
let testProduct;

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');

  // Use the admin user
  testUser = await User.findOne({
    where: { email: 'admin@erp.local' },
    include: [{ model: Role, as: 'role' }],
  });
  if (!testUser) {
    console.error('Run `npm run seed` first.');
    process.exit(1);
  }

  // Pick a product with enough stock (HP Wireless Mouse, stock ~100)
  testProduct = await Product.findOne({ where: { sku: 'ELEC-HP-002' } });
  if (!testProduct) {
    console.error('Product ELEC-HP-002 not found. Run `npm run seed` first.');
    process.exit(1);
  }

  // Reset stock to a known value
  const inv = await Inventory.findOne({ where: { product_id: testProduct.id, warehouse_id: null } });
  await inv.update({ stock_quantity: 100 });

  // Clear old movements for clean reconciliation
  await StockMovement.destroy({ where: { product_id: testProduct.id } });
  await StockMovement.create({
    product_id: testProduct.id, warehouse_id: null,
    type: 'IN', quantity: 100, reference: 'test-setup',
    notes: 'Concurrency test setup', created_by: testUser.id,
  });

  console.log(`Setup: ${testProduct.name} (ID ${testProduct.id}) stock reset to 100\n`);
}

async function getStock() {
  const inv = await Inventory.findOne({ where: { product_id: testProduct.id, warehouse_id: null } });
  return inv.stock_quantity;
}

// ────────────────────────────────────────────────
// Test 1: Concurrent stock removals (all should succeed, no overselling)
// ────────────────────────────────────────────────
async function testConcurrentRemovals() {
  console.log('=== Test 1: Concurrent stock removals (10 x qty=5, stock=100) ===');
  const startStock = await getStock();

  const promises = Array.from({ length: CONCURRENCY }, () =>
    StockService.removeStock({
      product_id: testProduct.id,
      quantity: 5,
      reference: 'test',
      notes: 'Concurrent removal test',
      user_id: testUser.id,
    }).then(() => 'OK').catch((e) => `FAIL: ${e.message}`)
  );

  const results = await Promise.all(promises);
  const endStock = await getStock();
  const successes = results.filter((r) => r === 'OK').length;
  const expected = startStock - (successes * 5);

  console.log(`  Start: ${startStock}, End: ${endStock}, Successes: ${successes}/${CONCURRENCY}`);
  console.log(`  Expected end stock: ${expected}`);
  console.log(`  RESULT: ${endStock === expected ? 'PASS' : 'FAIL'}\n`);
  return endStock === expected;
}

// ────────────────────────────────────────────────
// Test 2: Concurrent removals that should exhaust stock (oversell prevention)
// ────────────────────────────────────────────────
async function testOversellPrevention() {
  console.log('=== Test 2: Oversell prevention (20 x qty=5, stock=50) ===');

  // Reset stock to 50 properly (via movement for reconciliation accuracy)
  const inv = await Inventory.findOne({ where: { product_id: testProduct.id, warehouse_id: null } });
  const currentStock = inv.stock_quantity;
  const delta = 50 - currentStock;
  await inv.update({ stock_quantity: 50 });
  if (delta !== 0) {
    await StockMovement.create({
      product_id: testProduct.id, warehouse_id: null,
      type: delta > 0 ? 'IN' : 'OUT', quantity: delta, reference: 'test-reset',
      notes: 'Test reset', created_by: testUser.id,
    });
  }

  // 20 concurrent removals of 5 each = 100 needed, only 50 available
  const promises = Array.from({ length: 20 }, () =>
    StockService.removeStock({
      product_id: testProduct.id,
      quantity: 5,
      reference: 'test',
      notes: 'Oversell test',
      user_id: testUser.id,
    }).then(() => 'OK').catch(() => 'REJECTED')
  );

  const results = await Promise.all(promises);
  const endStock = await getStock();
  const successes = results.filter((r) => r === 'OK').length;
  const rejections = results.filter((r) => r === 'REJECTED').length;

  console.log(`  Successes: ${successes}, Rejections: ${rejections}`);
  console.log(`  End stock: ${endStock}`);
  console.log(`  Max possible successes: 10 (50/5)`);
  console.log(`  RESULT: ${endStock >= 0 && successes <= 10 ? 'PASS' : 'FAIL'} (stock never negative)\n`);
  return endStock >= 0 && successes <= 10;
}

// ────────────────────────────────────────────────
// Test 3: Concurrent sales for the same product
// ────────────────────────────────────────────────
async function testConcurrentSales() {
  console.log('=== Test 3: Concurrent sales (5 x qty=2, stock=30) ===');

  const inv = await Inventory.findOne({ where: { product_id: testProduct.id, warehouse_id: null } });
  const currentStock = inv.stock_quantity;
  const delta = 30 - currentStock;
  await inv.update({ stock_quantity: 30 });
  if (delta !== 0) {
    await StockMovement.create({
      product_id: testProduct.id, warehouse_id: null,
      type: delta > 0 ? 'IN' : 'OUT', quantity: delta, reference: 'test-reset',
      notes: 'Test reset', created_by: testUser.id,
    });
  }

  const promises = Array.from({ length: 5 }, () =>
    SalesService.createSale({
      items: [{ product_id: testProduct.id, quantity: 2 }],
      payment_method: 'CASH',
      paid_amount: 99999,
    }, testUser.id).then(() => 'OK').catch((e) => `FAIL: ${e.message}`)
  );

  const results = await Promise.all(promises);
  const endStock = await getStock();
  const successes = results.filter((r) => r === 'OK').length;
  const expected = 30 - (successes * 2);

  console.log(`  Successes: ${successes}/5`);
  console.log(`  End stock: ${endStock}, Expected: ${expected}`);
  console.log(`  RESULT: ${endStock === expected && endStock >= 0 ? 'PASS' : 'FAIL'}\n`);
  return endStock === expected && endStock >= 0;
}

// ────────────────────────────────────────────────
// Test 4: Mixed concurrent sales + manual adjustments
// ────────────────────────────────────────────────
async function testMixedOperations() {
  console.log('=== Test 4: Mixed sales + manual adjustments (stock=50) ===');

  const inv = await Inventory.findOne({ where: { product_id: testProduct.id, warehouse_id: null } });
  const currentStock = inv.stock_quantity;
  const delta = 50 - currentStock;
  await inv.update({ stock_quantity: 50 });
  if (delta !== 0) {
    await StockMovement.create({
      product_id: testProduct.id, warehouse_id: null,
      type: delta > 0 ? 'IN' : 'OUT', quantity: delta, reference: 'test-reset',
      notes: 'Test reset', created_by: testUser.id,
    });
  }

  const salePromises = Array.from({ length: 3 }, () =>
    SalesService.createSale({
      items: [{ product_id: testProduct.id, quantity: 3 }],
      payment_method: 'CASH',
      paid_amount: 99999,
    }, testUser.id).then(() => ({ type: 'sale', result: 'OK' })).catch((e) => ({ type: 'sale', result: `FAIL: ${e.message}` }))
  );

  const adjustPromises = Array.from({ length: 3 }, () =>
    StockService.addStock({
      product_id: testProduct.id,
      quantity: 5,
      reference: 'test',
      notes: 'Mixed test add',
      user_id: testUser.id,
    }).then(() => ({ type: 'add', result: 'OK' })).catch((e) => ({ type: 'add', result: `FAIL: ${e.message}` }))
  );

  const removePromises = Array.from({ length: 2 }, () =>
    StockService.removeStock({
      product_id: testProduct.id,
      quantity: 2,
      reference: 'test',
      notes: 'Mixed test remove',
      user_id: testUser.id,
    }).then(() => ({ type: 'remove', result: 'OK' })).catch((e) => ({ type: 'remove', result: `FAIL: ${e.message}` }))
  );

  const results = await Promise.all([...salePromises, ...adjustPromises, ...removePromises]);
  const endStock = await getStock();

  const saleOK = results.filter((r) => r.type === 'sale' && r.result === 'OK').length;
  const addOK = results.filter((r) => r.type === 'add' && r.result === 'OK').length;
  const removeOK = results.filter((r) => r.type === 'remove' && r.result === 'OK').length;
  const expected = 50 - (saleOK * 3) + (addOK * 5) - (removeOK * 2);

  console.log(`  Sales OK: ${saleOK}/3, Adds OK: ${addOK}/3, Removes OK: ${removeOK}/2`);
  console.log(`  End stock: ${endStock}, Expected: ${expected}`);
  console.log(`  RESULT: ${endStock === expected ? 'PASS' : 'FAIL'}\n`);
  return endStock === expected;
}

// ────────────────────────────────────────────────
// Test 5: Stock reconciliation — movements sum == inventory
// ────────────────────────────────────────────────
async function testReconciliation() {
  console.log('=== Test 5: Stock reconciliation ===');
  const mismatches = await StockService.reconcile();
  const productMismatch = mismatches.find((m) => m.product_id === testProduct.id);

  if (productMismatch) {
    console.log(`  FAIL: drift=${productMismatch.drift}, current=${productMismatch.current_stock}, movements_sum=${productMismatch.movements_sum}`);
  } else {
    console.log(`  Product ${testProduct.id}: inventory matches stock_movements sum`);
  }

  console.log(`  Total mismatches across all products: ${mismatches.length}`);
  console.log(`  RESULT: ${!productMismatch ? 'PASS' : 'FAIL'}\n`);
  return !productMismatch;
}

// ────────────────────────────────────────────────
async function run() {
  try {
    await setup();

    const results = [];
    results.push(await testConcurrentRemovals());
    results.push(await testOversellPrevention());
    results.push(await testConcurrentSales());
    results.push(await testMixedOperations());
    results.push(await testReconciliation());

    const passed = results.filter(Boolean).length;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TOTAL: ${passed}/${results.length} tests passed`);
    console.log(`${'='.repeat(50)}`);

    process.exit(passed === results.length ? 0 : 1);
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  }
}

run();
