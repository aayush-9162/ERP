/**
 * Stock performance benchmark — measures throughput and latency
 * under varying concurrency levels.
 *
 * Usage:  NODE_ENV=production node src/tests/benchmark.test.js
 * Prereq: npm run seed (server NOT running)
 */

require('dotenv').config();
const { sequelize, Product, Inventory, StockMovement, User, Role } = require('../models');
const StockService = require('../services/stock.service');

let testUser;
let products;

async function setup() {
  await sequelize.authenticate();

  testUser = await User.findOne({
    where: { email: 'admin@erp.local' },
    include: [{ model: Role, as: 'role' }],
  });
  products = await Product.findAll({ where: { status: 'active' }, limit: 7 });

  if (!testUser || products.length === 0) {
    console.error('Run `npm run seed` first.');
    process.exit(1);
  }

  // Reset all products to high stock via stock movements (keeps reconciliation clean)
  for (const p of products) {
    const inv = await Inventory.findOne({ where: { product_id: p.id, warehouse_id: null } });
    if (!inv) continue;
    const delta = 100000 - inv.stock_quantity;
    if (delta !== 0) {
      await inv.update({ stock_quantity: 100000 });
      await StockMovement.create({
        product_id: p.id, warehouse_id: null,
        type: delta > 0 ? 'IN' : 'OUT', quantity: delta,
        reference: 'bench-reset', notes: 'Benchmark reset',
        created_by: testUser.id,
      });
    }
  }
}

async function bench(label, concurrency, opFn) {
  const start = performance.now();
  const latencies = [];

  const promises = Array.from({ length: concurrency }, async () => {
    const t0 = performance.now();
    await opFn();
    latencies.push(performance.now() - t0);
  });

  await Promise.all(promises);
  const elapsed = performance.now() - start;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(
    `  ${label.padEnd(40)} | ${String(concurrency).padStart(3)} ops` +
    ` | ${elapsed.toFixed(0).padStart(6)}ms total` +
    ` | p50=${p50.toFixed(0).padStart(4)}ms  p95=${p95.toFixed(0).padStart(4)}ms  p99=${p99.toFixed(0).padStart(4)}ms` +
    ` | ${(concurrency / elapsed * 1000).toFixed(1).padStart(6)} ops/sec`
  );
}

async function run() {
  await setup();
  const mainProduct = products[0];

  console.log(`\nBenchmarking stock movement throughput (${products.length} products, pool=25)`);
  console.log('─'.repeat(120));

  // Same-product contention (worst case — every op locks same row)
  console.log('\n[Same-product contention — all ops hit product ' + mainProduct.id + ']');
  for (const c of [1, 5, 10, 20, 50, 100]) {
    await bench('removeStock (same product)', c, () =>
      StockService.removeStock({
        product_id: mainProduct.id, quantity: 1, reference: 'bench',
        notes: null, user_id: testUser.id,
      })
    );
  }

  // Different-product parallelism (best case — no lock contention)
  console.log('\n[Different-product parallelism — round-robin across ' + products.length + ' products]');
  for (const c of [5, 10, 20, 50, 100]) {
    let idx = 0;
    await bench(`removeStock (${products.length}-way spread)`, c, () => {
      const p = products[idx++ % products.length];
      return StockService.removeStock({
        product_id: p.id, quantity: 1, reference: 'bench',
        notes: null, user_id: testUser.id,
      });
    });
  }

  // addStock (no negative-check branch — should be faster)
  console.log('\n[addStock same-product — no negative guard branch]');
  for (const c of [1, 10, 50, 100]) {
    await bench('addStock (same product)', c, () =>
      StockService.addStock({
        product_id: mainProduct.id, quantity: 1, reference: 'bench',
        notes: null, user_id: testUser.id,
      })
    );
  }

  // Verify no data corruption
  console.log('\n[Post-benchmark reconciliation]');
  const mismatches = await StockService.reconcile();
  console.log(`  Mismatches: ${mismatches.length} ${mismatches.length === 0 ? '✓' : '✗ CORRUPTION DETECTED'}`);

  await sequelize.close();
}

run().catch(console.error);
