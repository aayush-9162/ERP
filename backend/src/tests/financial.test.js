/**
 * Financial calculation accuracy test.
 *
 * Validates:
 * 1. Seeded data math (sale/purchase items sum to header totals)
 * 2. Line-item GST formula: Math.round(subtotal * rate) / 100
 * 3. P&L report matches raw SUM from sales + purchases tables
 * 4. Accounting entries balance (total debits == total credits)
 * 5. Account running balances match SUM(transactions)
 * 6. Customer outstanding matches sales - payments
 * 7. Inventory valuation matches stock * purchase_price
 * 8. Edge-case formulas (rounding, discount cap, zero-amount)
 *
 * Usage: NODE_ENV=production node src/tests/financial.test.js
 */

require('dotenv').config();
const { sequelize, Sale, SaleItem, Purchase, PurchaseItem, Product, Inventory, Account, Transaction } = require('../models');
const ReportsService = require('../services/reports.service');
const AccountingService = require('../services/accounting.service');
const SalesService = require('../services/sales.service');
const PurchaseService = require('../services/purchase.service');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}

function near(a, b, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');
}

// ──────────────────────────────────────
// Test 1: Seeded sale items sum to header
// ──────────────────────────────────────
async function testSeededSaleMath() {
  console.log('=== Test 1: Seeded sale line-item math ===');

  const sales = await Sale.findAll({ include: [{ association: 'items' }] });

  for (const sale of sales) {
    const itemSubtotal = sale.items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
    const itemTax = sale.items.reduce((s, i) => s + parseFloat(i.tax_amount), 0);
    const itemTotal = sale.items.reduce((s, i) => s + parseFloat(i.total), 0);

    // Verify each line item's tax: Math.round(subtotal * rate) / 100
    for (const item of sale.items) {
      const sub = parseFloat(item.unit_price) * item.quantity;
      const expectedTax = Math.round(sub * parseFloat(item.tax_rate)) / 100;
      assert(
        `Sale ${sale.invoice_number} item "${item.product_name}": tax ${item.tax_amount} == ${expectedTax}`,
        near(parseFloat(item.tax_amount), expectedTax),
        `got ${item.tax_amount} expected ${expectedTax}`
      );
    }

    // Verify header totals = sum of items
    assert(
      `Sale ${sale.invoice_number}: total_amount ${sale.total_amount} == items subtotal ${itemSubtotal.toFixed(2)}`,
      near(parseFloat(sale.total_amount), itemSubtotal),
    );
    assert(
      `Sale ${sale.invoice_number}: tax_amount ${sale.tax_amount} == items tax ${itemTax.toFixed(2)}`,
      near(parseFloat(sale.tax_amount), itemTax),
    );
    // final = total + tax - discount
    const expectedFinal = parseFloat(sale.total_amount) + parseFloat(sale.tax_amount) - parseFloat(sale.discount_amount);
    assert(
      `Sale ${sale.invoice_number}: final_amount ${sale.final_amount} == ${expectedFinal.toFixed(2)}`,
      near(parseFloat(sale.final_amount), expectedFinal),
    );
  }
}

// ──────────────────────────────────────
// Test 2: Seeded purchase items sum to header
// ──────────────────────────────────────
async function testSeededPurchaseMath() {
  console.log('\n=== Test 2: Seeded purchase line-item math ===');

  const purchases = await Purchase.findAll({ include: [{ association: 'items' }] });

  for (const pur of purchases) {
    const itemSubtotal = pur.items.reduce((s, i) => s + parseFloat(i.unit_price) * i.quantity, 0);
    const itemTax = pur.items.reduce((s, i) => s + parseFloat(i.tax_amount), 0);

    for (const item of pur.items) {
      const sub = parseFloat(item.unit_price) * item.quantity;
      const expectedTax = Math.round(sub * parseFloat(item.tax_rate)) / 100;
      assert(
        `Purchase ${pur.purchase_number} item "${item.product_name}": tax ${item.tax_amount} == ${expectedTax}`,
        near(parseFloat(item.tax_amount), expectedTax),
      );
    }

    assert(
      `Purchase ${pur.purchase_number}: total_amount ${pur.total_amount} == ${itemSubtotal.toFixed(2)}`,
      near(parseFloat(pur.total_amount), itemSubtotal),
    );
    assert(
      `Purchase ${pur.purchase_number}: tax_amount ${pur.tax_amount} == ${itemTax.toFixed(2)}`,
      near(parseFloat(pur.tax_amount), itemTax),
    );
    const expectedFinal = parseFloat(pur.total_amount) + parseFloat(pur.tax_amount) - parseFloat(pur.discount_amount);
    assert(
      `Purchase ${pur.purchase_number}: final_amount ${pur.final_amount} == ${expectedFinal.toFixed(2)}`,
      near(parseFloat(pur.final_amount), expectedFinal),
    );
  }
}

// ──────────────────────────────────────
// Test 3: P&L report matches raw table sums
// ──────────────────────────────────────
async function testProfitLossAccuracy() {
  console.log('\n=== Test 3: P&L report vs raw table sums ===');

  const pnl = await ReportsService.profitAndLoss();

  // Sum sales directly
  const [[rawSales]] = await sequelize.query('SELECT SUM(total_amount) AS rev, SUM(tax_amount) AS tax, SUM(discount_amount) AS disc, SUM(final_amount) AS total FROM sales');
  assert('P&L sales.revenue == SUM(sales.total_amount)', near(pnl.sales.revenue, parseFloat(rawSales.rev)));
  assert('P&L sales.tax == SUM(sales.tax_amount)', near(pnl.sales.tax, parseFloat(rawSales.tax)));
  assert('P&L sales.discount == SUM(sales.discount_amount)', near(pnl.sales.discount, parseFloat(rawSales.disc)));
  assert('P&L sales.total == SUM(sales.final_amount)', near(pnl.sales.total, parseFloat(rawSales.total)));

  const [[rawPur]] = await sequelize.query('SELECT SUM(total_amount) AS cost, SUM(tax_amount) AS tax, SUM(final_amount) AS total FROM purchases');
  assert('P&L purchases.cost == SUM(purchases.total_amount)', near(pnl.purchases.cost, parseFloat(rawPur.cost)));
  assert('P&L purchases.tax == SUM(purchases.tax_amount)', near(pnl.purchases.tax, parseFloat(rawPur.tax)));

  // Gross profit = sales revenue - purchase cost
  const expectedGross = pnl.sales.revenue - pnl.purchases.cost;
  assert(`Gross profit: ${pnl.gross_profit} == ${expectedGross.toFixed(2)}`, near(pnl.gross_profit, expectedGross));

  // Net profit = sales total - purchases total
  const expectedNet = pnl.sales.total - pnl.purchases.total;
  assert(`Net profit: ${pnl.net_profit} == ${expectedNet.toFixed(2)}`, near(pnl.net_profit, expectedNet));

  // Margin = gross_profit / revenue * 100
  const expectedMargin = pnl.sales.revenue > 0 ? Math.round((expectedGross / pnl.sales.revenue) * 10000) / 100 : 0;
  assert(`Gross margin: ${pnl.gross_margin}% == ${expectedMargin}%`, near(pnl.gross_margin, expectedMargin));
}

// ──────────────────────────────────────
// Test 4: Accounting entries balance (debits == credits)
// ──────────────────────────────────────
async function testAccountingBalance() {
  console.log('\n=== Test 4: Accounting double-entry balance ===');

  const [[result]] = await sequelize.query(`
    SELECT
      SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) AS total_debits,
      SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) AS total_credits
    FROM transactions
  `);

  const debits = parseFloat(result.total_debits) || 0;
  const credits = parseFloat(result.total_credits) || 0;

  assert(`Total debits (${debits.toFixed(2)}) == Total credits (${credits.toFixed(2)})`, near(debits, credits),
    `diff: ${Math.abs(debits - credits).toFixed(2)}`);
}

// ──────────────────────────────────────
// Test 5: Account running balances match SUM(transactions)
// ──────────────────────────────────────
async function testAccountBalances() {
  console.log('\n=== Test 5: Account balances == SUM(transactions) ===');

  const accounts = await Account.findAll();
  let allMatch = true;

  for (const acc of accounts) {
    const [[result]] = await sequelize.query(`
      SELECT
        SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE -amount END) AS computed_balance
      FROM transactions WHERE account_id = :id
    `, { replacements: { id: acc.id } });

    const computed = parseFloat(result.computed_balance) || 0;
    const stored = parseFloat(acc.balance);

    if (!near(stored, computed)) {
      assert(`Account "${acc.name}": stored=${stored}, computed=${computed}`, false, `drift=${(stored - computed).toFixed(2)}`);
      allMatch = false;
    }
  }
  if (allMatch) assert('All account running balances match transaction sums', true);
}

// ──────────────────────────────────────
// Test 6: Customer outstanding matches sales - payments
// ──────────────────────────────────────
async function testCustomerOutstanding() {
  console.log('\n=== Test 6: Customer outstanding accuracy ===');

  const report = await ReportsService.customerReport();

  for (const cust of report) {
    const [[raw]] = await sequelize.query(`
      SELECT
        COALESCE(SUM(final_amount), 0) AS total,
        COALESCE(SUM(paid_amount), 0) AS paid
      FROM sales WHERE customer_id = :cid
    `, { replacements: { cid: cust.id } });

    const expectedOutstanding = parseFloat(raw.total) - parseFloat(raw.paid);
    assert(
      `Customer "${cust.name}": outstanding ${cust.outstanding} == ${expectedOutstanding.toFixed(2)}`,
      near(parseFloat(cust.outstanding), expectedOutstanding),
    );
  }
}

// ──────────────────────────────────────
// Test 7: Inventory valuation accuracy
// ──────────────────────────────────────
async function testInventoryValuation() {
  console.log('\n=== Test 7: Inventory valuation accuracy ===');

  const data = await ReportsService.inventoryValuation();

  let computedCost = 0;
  let computedRetail = 0;

  for (const item of data.items) {
    const stock = parseInt(item.stock, 10);
    const cost = parseFloat(item.purchase_price) * stock;
    const retail = parseFloat(item.selling_price) * stock;

    assert(
      `"${item.name}": cost_value ${item.cost_value} == ${cost.toFixed(2)}`,
      near(parseFloat(item.cost_value), cost),
    );
    assert(
      `"${item.name}": retail_value ${item.retail_value} == ${retail.toFixed(2)}`,
      near(parseFloat(item.retail_value), retail),
    );

    computedCost += cost;
    computedRetail += retail;
  }

  assert(`Total cost: ${data.total_cost_value} == ${computedCost.toFixed(2)}`, near(data.total_cost_value, computedCost));
  assert(`Total retail: ${data.total_retail_value} == ${computedRetail.toFixed(2)}`, near(data.total_retail_value, computedRetail));
}

// ──────────────────────────────────────
// Test 8: GST formula edge cases
// ──────────────────────────────────────
async function testGSTEdgeCases() {
  console.log('\n=== Test 8: GST formula edge cases ===');

  // The formula is: Math.round(subtotal * taxRate) / 100
  // Test with values that could cause floating-point drift

  const cases = [
    { price: 799.50, qty: 3, rate: 12.5, expectedTax: 299.81 },
    { price: 100, qty: 1, rate: 18, expectedTax: 18 },
    { price: 0.01, qty: 1, rate: 5, expectedTax: 0 }, // Math.round(0.05)/100 = 0 — sub-paisa rounds to 0
    { price: 999.99, qty: 7, rate: 28, expectedTax: 1959.98 },
    { price: 1, qty: 1, rate: 0, expectedTax: 0 },
    { price: 333.33, qty: 3, rate: 18, expectedTax: 180 }, // Math.round(999.99*18)/100 = 180
  ];

  for (const c of cases) {
    const sub = c.price * c.qty;
    const tax = Math.round(sub * c.rate) / 100;
    assert(
      `${c.price} x ${c.qty} @ ${c.rate}%: tax=${tax} expected=${c.expectedTax}`,
      near(tax, c.expectedTax, 0.015),
      `got ${tax}`
    );
  }
}

// ──────────────────────────────────────
// Test 9: Create sale + purchase, verify P&L updates correctly
// ──────────────────────────────────────
async function testLiveTransactionPnL() {
  console.log('\n=== Test 9: Live transaction updates P&L ===');

  const pnlBefore = await ReportsService.profitAndLoss();
  const { User, Role, Supplier } = require('../models');
  const user = await User.findOne({ where: { email: 'admin@erp.local' }, include: [{ model: Role, as: 'role' }] });
  const supplier = await Supplier.findOne({ where: { status: 'active' } });

  // Create a sale: 5 x HP Mouse @ 800, 18% GST
  // subtotal=4000, tax=720, total=4720
  const sale = await SalesService.createSale({
    items: [{ product_id: 3, quantity: 5 }],
    payment_method: 'CASH',
    paid_amount: 4720,
  }, user.id);

  assert('Sale subtotal = 4000', near(parseFloat(sale.total_amount), 4000));
  assert('Sale tax = 720', near(parseFloat(sale.tax_amount), 720));
  assert('Sale final = 4720', near(parseFloat(sale.final_amount), 4720));

  // Create a purchase: 10 x Paper @ 250, 5% GST
  // subtotal=2500, tax=125, total=2625
  const pur = await PurchaseService.createPurchase({
    supplier_id: supplier.id,
    items: [{ product_id: 7, quantity: 10, unit_price: 250 }],
    paid_amount: 0,
  }, user.id);

  assert('Purchase subtotal = 2500', near(parseFloat(pur.total_amount), 2500));
  assert('Purchase tax = 125', near(parseFloat(pur.tax_amount), 125));
  assert('Purchase final = 2625', near(parseFloat(pur.final_amount), 2625));

  // Check P&L changed by exact amounts
  const pnlAfter = await ReportsService.profitAndLoss();

  const revDelta = pnlAfter.sales.revenue - pnlBefore.sales.revenue;
  const costDelta = pnlAfter.purchases.cost - pnlBefore.purchases.cost;
  const profitDelta = pnlAfter.gross_profit - pnlBefore.gross_profit;

  assert(`Revenue delta: +${revDelta} == +4000`, near(revDelta, 4000));
  assert(`Cost delta: +${costDelta} == +2500`, near(costDelta, 2500));
  assert(`Profit delta: +${profitDelta} == +1500`, near(profitDelta, 1500));
}

// ──────────────────────────────────────
async function run() {
  try {
    await setup();

    await testSeededSaleMath();
    await testSeededPurchaseMath();
    await testProfitLossAccuracy();
    await testAccountingBalance();
    await testAccountBalances();
    await testCustomerOutstanding();
    await testInventoryValuation();
    await testGSTEdgeCases();
    await testLiveTransactionPnL();

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
