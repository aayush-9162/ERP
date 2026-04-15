/**
 * Report performance benchmark with large dataset.
 *
 * 1. Seeds 10K sales + 50K sale_items + 5K purchases + 20K purchase_items
 * 2. Benchmarks every report query
 * 3. Runs EXPLAIN on slow queries
 *
 * Usage: NODE_ENV=production node src/tests/perf-reports.test.js
 */

require('dotenv').config();
const { sequelize, Sale, SaleItem, Purchase, PurchaseItem, Product, Inventory, Customer, Supplier, StockMovement, Account, Transaction } = require('../models');
const ReportsService = require('../services/reports.service');
const SalesService = require('../services/sales.service');
const PurchaseService = require('../services/purchase.service');
const AccountingService = require('../services/accounting.service');

const SALE_COUNT = 10000;
const ITEMS_PER_SALE = 5;
const PURCHASE_COUNT = 5000;
const ITEMS_PER_PURCHASE = 4;

async function seedLargeDataset() {
  console.log(`Seeding large dataset: ${SALE_COUNT} sales, ${PURCHASE_COUNT} purchases...`);
  const start = performance.now();

  const products = await Product.findAll({ where: { status: 'active' }, raw: true });
  const customers = await Customer.findAll({ raw: true });
  const suppliers = await Supplier.findAll({ raw: true });

  if (products.length === 0 || customers.length === 0 || suppliers.length === 0) {
    console.error('Run `npm run seed` first to create base data.');
    process.exit(1);
  }

  // Bulk-insert sales
  const salesData = [];
  const saleItemsData = [];
  for (let i = 0; i < SALE_COUNT; i++) {
    const date = new Date(2025, 0, 1 + Math.floor(Math.random() * 450)); // spread over 15 months
    const custId = Math.random() > 0.3 ? customers[Math.floor(Math.random() * customers.length)].id : null;
    const statuses = ['PAID', 'PAID', 'PAID', 'PARTIAL', 'UNPAID'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    let total = 0; let tax = 0;
    const items = [];
    const numItems = 1 + Math.floor(Math.random() * ITEMS_PER_SALE);
    for (let j = 0; j < numItems; j++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = 1 + Math.floor(Math.random() * 10);
      const price = parseFloat(p.selling_price);
      const rate = parseFloat(p.tax_rate);
      const sub = price * qty;
      const itemTax = Math.round(sub * rate) / 100;
      total += sub;
      tax += itemTax;
      items.push({
        product_id: p.id, product_name: p.name, product_sku: p.sku,
        quantity: qty, unit_price: price, tax_rate: rate,
        tax_amount: itemTax, total: Math.round((sub + itemTax) * 100) / 100,
      });
    }
    total = Math.round(total * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    const final_amount = Math.round((total + tax) * 100) / 100;
    const paid = status === 'PAID' ? final_amount : status === 'PARTIAL' ? Math.round(final_amount * 0.5 * 100) / 100 : 0;

    salesData.push({
      invoice_number: `INV-PERF-${String(i + 1).padStart(6, '0')}`,
      customer_id: custId, total_amount: total, tax_amount: tax,
      discount_amount: 0, final_amount, paid_amount: paid,
      payment_status: status, payment_method: 'CASH', created_by: 1,
      created_at: date, updated_at: date,
    });

    for (const item of items) {
      saleItemsData.push({ ...item, _sale_idx: i });
    }
  }

  // Bulk insert sales in chunks
  const CHUNK = 2000;
  for (let i = 0; i < salesData.length; i += CHUNK) {
    await Sale.bulkCreate(salesData.slice(i, i + CHUNK), { validate: false });
  }

  // Get created sale IDs
  const allSales = await Sale.findAll({
    where: { invoice_number: { [sequelize.Sequelize.Op.like]: 'INV-PERF-%' } },
    attributes: ['id', 'invoice_number'], raw: true, order: [['id', 'ASC']],
  });
  const saleIdMap = {};
  allSales.forEach((s, idx) => { saleIdMap[idx] = s.id; });

  // Attach sale_id to items and bulk insert
  const itemsWithIds = saleItemsData.map((item) => {
    const { _sale_idx, ...rest } = item;
    return { ...rest, sale_id: saleIdMap[_sale_idx] };
  });
  for (let i = 0; i < itemsWithIds.length; i += CHUNK) {
    await SaleItem.bulkCreate(itemsWithIds.slice(i, i + CHUNK), { validate: false });
  }

  console.log(`  ${salesData.length} sales + ${itemsWithIds.length} items inserted.`);

  // Bulk-insert purchases
  const purchasesData = [];
  const purItemsData = [];
  for (let i = 0; i < PURCHASE_COUNT; i++) {
    const date = new Date(2025, 0, 1 + Math.floor(Math.random() * 450));
    const supId = suppliers[Math.floor(Math.random() * suppliers.length)].id;
    const statuses = ['PAID', 'PAID', 'PARTIAL', 'UNPAID'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    let total = 0; let tax = 0;
    const numItems = 1 + Math.floor(Math.random() * ITEMS_PER_PURCHASE);
    for (let j = 0; j < numItems; j++) {
      const p = products[Math.floor(Math.random() * products.length)];
      const qty = 1 + Math.floor(Math.random() * 20);
      const price = parseFloat(p.purchase_price);
      const rate = parseFloat(p.tax_rate);
      const sub = price * qty;
      const itemTax = Math.round(sub * rate) / 100;
      total += sub;
      tax += itemTax;
      purItemsData.push({
        product_id: p.id, product_name: p.name, product_sku: p.sku,
        quantity: qty, unit_price: price, tax_rate: rate,
        tax_amount: itemTax, total: Math.round((sub + itemTax) * 100) / 100,
        _pur_idx: i,
      });
    }
    total = Math.round(total * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    const final_amount = Math.round((total + tax) * 100) / 100;
    const paid = status === 'PAID' ? final_amount : status === 'PARTIAL' ? Math.round(final_amount * 0.4 * 100) / 100 : 0;

    purchasesData.push({
      purchase_number: `PUR-PERF-${String(i + 1).padStart(6, '0')}`,
      supplier_id: supId, total_amount: total, tax_amount: tax,
      discount_amount: 0, final_amount, paid_amount: paid,
      payment_status: status, created_by: 1,
      created_at: date, updated_at: date,
    });
  }

  for (let i = 0; i < purchasesData.length; i += CHUNK) {
    await Purchase.bulkCreate(purchasesData.slice(i, i + CHUNK), { validate: false });
  }

  const allPurchases = await Purchase.findAll({
    where: { purchase_number: { [sequelize.Sequelize.Op.like]: 'PUR-PERF-%' } },
    attributes: ['id'], raw: true, order: [['id', 'ASC']],
  });
  const purIdMap = {};
  allPurchases.forEach((p, idx) => { purIdMap[idx] = p.id; });

  const purItemsWithIds = purItemsData.map((item) => {
    const { _pur_idx, ...rest } = item;
    return { ...rest, purchase_id: purIdMap[_pur_idx] };
  });
  for (let i = 0; i < purItemsWithIds.length; i += CHUNK) {
    await PurchaseItem.bulkCreate(purItemsWithIds.slice(i, i + CHUNK), { validate: false });
  }

  console.log(`  ${purchasesData.length} purchases + ${purItemsWithIds.length} items inserted.`);
  console.log(`  Seeding took ${((performance.now() - start) / 1000).toFixed(1)}s\n`);
}

async function bench(label, fn) {
  // Warmup
  await fn();

  const runs = 5;
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / runs;
  const p50 = times[Math.floor(runs * 0.5)];
  const max = times[runs - 1];

  const status = avg < 100 ? 'FAST' : avg < 500 ? 'OK' : avg < 2000 ? 'SLOW' : 'CRITICAL';
  console.log(`  ${label.padEnd(45)} avg=${avg.toFixed(0).padStart(5)}ms  p50=${p50.toFixed(0).padStart(5)}ms  max=${max.toFixed(0).padStart(5)}ms  [${status}]`);
  return { label, avg, status };
}

async function explainQuery(label, sql) {
  const [rows] = await sequelize.query(`EXPLAIN ${sql}`);
  const slow = rows.filter((r) => r.type === 'ALL' || (r.rows && parseInt(r.rows) > 5000));
  if (slow.length > 0) {
    console.log(`    EXPLAIN ${label}: FULL SCAN detected`);
    slow.forEach((r) => console.log(`      table=${r.table} type=${r.type} rows=${r.rows} key=${r.key || 'NONE'}`));
  }
  return slow.length > 0;
}

async function run() {
  await sequelize.authenticate();
  console.log('DB connected.\n');

  // Count existing data
  const [salesCount] = await sequelize.query('SELECT COUNT(*) AS c FROM sales');
  if (parseInt(salesCount[0].c) < 1000) {
    await seedLargeDataset();
  } else {
    console.log(`Dataset already large (${salesCount[0].c} sales). Skipping seed.\n`);
  }

  // Verify dataset size
  const [[sc]] = await sequelize.query('SELECT COUNT(*) AS c FROM sales');
  const [[sic]] = await sequelize.query('SELECT COUNT(*) AS c FROM sale_items');
  const [[pc]] = await sequelize.query('SELECT COUNT(*) AS c FROM purchases');
  const [[pic]] = await sequelize.query('SELECT COUNT(*) AS c FROM purchase_items');
  console.log(`Dataset: ${sc.c} sales, ${sic.c} sale_items, ${pc.c} purchases, ${pic.c} purchase_items\n`);

  console.log('─'.repeat(90));
  console.log('BENCHMARK: Report Queries');
  console.log('─'.repeat(90));

  const results = [];

  results.push(await bench('salesReport (daily, no filter)', () => ReportsService.salesReport({})));
  results.push(await bench('salesReport (monthly, no filter)', () => ReportsService.salesReport({ group_by: 'month' })));
  results.push(await bench('salesReport (daily, 3-month range)', () => ReportsService.salesReport({ from: '2025-03-01', to: '2025-05-31' })));
  results.push(await bench('topSellingProducts (top 10)', () => ReportsService.topSellingProducts({})));
  results.push(await bench('topSellingProducts (3-month range)', () => ReportsService.topSellingProducts({ from: '2025-03-01', to: '2025-05-31' })));
  results.push(await bench('purchaseReport (daily)', () => ReportsService.purchaseReport({})));
  results.push(await bench('purchaseReport (monthly)', () => ReportsService.purchaseReport({ group_by: 'month' })));
  results.push(await bench('supplierWiseReport', () => ReportsService.supplierWiseReport({})));
  results.push(await bench('inventoryValuation', () => ReportsService.inventoryValuation()));
  results.push(await bench('profitAndLoss (no filter)', () => ReportsService.profitAndLoss({})));
  results.push(await bench('profitAndLoss (3-month range)', () => ReportsService.profitAndLoss({ from: '2025-03-01', to: '2025-05-31' })));
  results.push(await bench('customerReport', () => ReportsService.customerReport({})));
  results.push(await bench('customerLedger (customer 1)', () => ReportsService.customerLedger(1)));
  results.push(await bench('salesSummary (dashboard)', () => SalesService.getSalesSummary()));
  results.push(await bench('purchaseSummary (dashboard)', () => PurchaseService.getPurchaseSummary()));

  console.log('\n─'.repeat(90));
  console.log('EXPLAIN ANALYSIS: Checking for full table scans');
  console.log('─'.repeat(90));

  await explainQuery('salesReport', "SELECT DATE_FORMAT(s.created_at, '%Y-%m-%d') AS period, COUNT(s.id), SUM(s.final_amount) FROM sales s GROUP BY period");
  await explainQuery('salesReport (date filter)', "SELECT DATE_FORMAT(s.created_at, '%Y-%m-%d') AS period, COUNT(s.id), SUM(s.final_amount) FROM sales s WHERE s.created_at >= '2025-03-01' GROUP BY period");
  await explainQuery('topSellingProducts', "SELECT si.product_id, SUM(si.quantity), SUM(si.total) FROM sale_items si JOIN sales s ON s.id = si.sale_id GROUP BY si.product_id");
  await explainQuery('topSellingProducts (date)', "SELECT si.product_id, SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.created_at >= '2025-03-01' GROUP BY si.product_id");
  await explainQuery('purchaseReport', "SELECT DATE_FORMAT(p.created_at, '%Y-%m-%d') AS period, COUNT(p.id), SUM(p.final_amount) FROM purchases p GROUP BY period");
  await explainQuery('supplierReport', "SELECT sup.id, COUNT(p.id), SUM(p.final_amount) FROM purchases p JOIN suppliers sup ON sup.id = p.supplier_id GROUP BY sup.id");
  await explainQuery('customerReport', "SELECT c.id, COUNT(s.id), SUM(s.final_amount) FROM customers c LEFT JOIN sales s ON s.customer_id = c.id GROUP BY c.id");
  await explainQuery('salesSummary (unpaid)', "SELECT COUNT(id), SUM(final_amount) FROM sales WHERE payment_status != 'PAID'");
  await explainQuery('salesSummary (today)', "SELECT COUNT(id), SUM(final_amount) FROM sales WHERE created_at >= CURDATE()");

  // Summary
  const slow = results.filter((r) => r.status === 'SLOW' || r.status === 'CRITICAL');
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`TOTAL: ${results.length} queries benchmarked. ${slow.length} slow queries found.`);
  if (slow.length > 0) {
    console.log('Slow queries:');
    slow.forEach((r) => console.log(`  - ${r.label}: ${r.avg.toFixed(0)}ms`));
  }
  console.log(`${'═'.repeat(90)}`);

  await sequelize.close();
}

run().catch(console.error);
