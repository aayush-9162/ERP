/**
 * Multi-company data isolation test.
 *
 * Creates 2 companies with separate data, then verifies
 * that queries scoped to Company A cannot see Company B's data.
 *
 * Usage: NODE_ENV=production node src/tests/isolation.test.js
 */

require('dotenv').config();
const { sequelize, User, Role, Company, UserCompany, Product, Category, Customer, Sale, SaleItem, Inventory, StockMovement } = require('../models');

let passed = 0, failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}

async function run() {
  await sequelize.authenticate();
  console.log('DB connected.\n');

  // ─── Setup: 2 companies, each with unique data ───
  const adminRole = await Role.findOne({ where: { name: 'admin' } });
  const user = await User.findOne({ where: { email: 'admin@erp.local' } });

  // Company 1 should already exist from seeder
  const company1 = await Company.findOne({ where: { name: 'Acme Industries Pvt. Ltd.' } });

  // Create Company 2
  let company2 = await Company.findOne({ where: { name: 'Test Isolation Corp' } });
  if (!company2) {
    company2 = await Company.create({ name: 'Test Isolation Corp', country: 'India', currency: 'INR', owner_id: user.id });
    await UserCompany.findOrCreate({ where: { user_id: user.id, company_id: company2.id }, defaults: { role_id: adminRole.id, status: 'active' } });
  }

  // Create data in Company 2
  let cat2 = await Category.findOne({ where: { name: 'Isolation-Category', company_id: company2.id } });
  if (!cat2) {
    cat2 = await Category.create({ name: 'Isolation-Category', company_id: company2.id });
  }

  let prod2 = await Product.findOne({ where: { sku: 'ISO-TEST-001', company_id: company2.id } });
  if (!prod2) {
    prod2 = await Product.create({
      name: 'Isolation Test Product', sku: 'ISO-TEST-001', company_id: company2.id,
      category_id: cat2.id, purchase_price: 100, selling_price: 200, tax_rate: 18,
    });
    await Inventory.create({ product_id: prod2.id, warehouse_id: null, stock_quantity: 50, company_id: company2.id });
  }

  let cust2 = await Customer.findOne({ where: { name: 'Isolation Customer', company_id: company2.id } });
  if (!cust2) {
    cust2 = await Customer.create({ name: 'Isolation Customer', phone: '9999999999', company_id: company2.id });
  }

  console.log(`Setup: Company 1 (ID ${company1.id}), Company 2 (ID ${company2.id})\n`);

  // ─── Test 1: Products scoped by company_id ───
  console.log('=== Test 1: Product isolation ===');

  const c1Products = await Product.findAll({ where: { company_id: company1.id } });
  const c2Products = await Product.findAll({ where: { company_id: company2.id } });

  assert('Company 1 has products', c1Products.length > 0, `got ${c1Products.length}`);
  assert('Company 2 has products', c2Products.length > 0, `got ${c2Products.length}`);
  assert('Company 1 products do NOT include ISO-TEST-001',
    !c1Products.find(p => p.sku === 'ISO-TEST-001'));
  assert('Company 2 products include ISO-TEST-001',
    !!c2Products.find(p => p.sku === 'ISO-TEST-001'));

  // ─── Test 2: Categories scoped ───
  console.log('\n=== Test 2: Category isolation ===');

  const c1Cats = await Category.findAll({ where: { company_id: company1.id } });
  const c2Cats = await Category.findAll({ where: { company_id: company2.id } });

  assert('Company 1 categories exist', c1Cats.length > 0);
  assert('Company 2 has Isolation-Category', c2Cats.some(c => c.name === 'Isolation-Category'));
  assert('Company 1 does NOT have Isolation-Category', !c1Cats.some(c => c.name === 'Isolation-Category'));

  // ─── Test 3: Customers scoped ───
  console.log('\n=== Test 3: Customer isolation ===');

  const c1Custs = await Customer.findAll({ where: { company_id: company1.id } });
  const c2Custs = await Customer.findAll({ where: { company_id: company2.id } });

  assert('Company 1 customers exist', c1Custs.length > 0);
  assert('Company 2 has Isolation Customer', c2Custs.some(c => c.name === 'Isolation Customer'));
  assert('Company 1 does NOT have Isolation Customer', !c1Custs.some(c => c.name === 'Isolation Customer'));

  // ─── Test 4: Sales scoped ───
  console.log('\n=== Test 4: Sales isolation ===');

  const c1Sales = await Sale.findAll({ where: { company_id: company1.id } });
  const c2Sales = await Sale.findAll({ where: { company_id: company2.id } });

  assert('Company 1 has sales', c1Sales.length > 0);
  assert('Company 2 has 0 sales', c2Sales.length === 0);

  // ─── Test 5: Inventory scoped ───
  console.log('\n=== Test 5: Inventory isolation ===');

  const c1Inv = await Inventory.findAll({ where: { company_id: company1.id } });
  const c2Inv = await Inventory.findAll({ where: { company_id: company2.id } });

  assert('Company 1 has inventory rows', c1Inv.length > 0);
  assert('Company 2 has inventory rows', c2Inv.length > 0);
  assert('Company 2 inventory is only for ISO product',
    c2Inv.every(i => i.product_id === prod2.id));

  // ─── Test 6: Raw SQL reports MUST filter ───
  console.log('\n=== Test 6: Raw SQL report queries ===');

  const [c1SalesRaw] = await sequelize.query(
    'SELECT COUNT(*) AS cnt FROM sales WHERE company_id = :cid',
    { replacements: { cid: company1.id } }
  );
  const [c2SalesRaw] = await sequelize.query(
    'SELECT COUNT(*) AS cnt FROM sales WHERE company_id = :cid',
    { replacements: { cid: company2.id } }
  );
  const [allSalesRaw] = await sequelize.query('SELECT COUNT(*) AS cnt FROM sales');

  assert('Raw: Company 1 sales > 0', parseInt(c1SalesRaw[0].cnt) > 0);
  assert('Raw: Company 2 sales = 0', parseInt(c2SalesRaw[0].cnt) === 0);
  assert('Raw: Unfiltered total >= Company 1',
    parseInt(allSalesRaw[0].cnt) >= parseInt(c1SalesRaw[0].cnt));

  // ─── Test 7: WHERE clause in controllers ───
  console.log('\n=== Test 7: Controller WHERE verification ===');

  // Verify the `const where = { company_id: req.companyId }` pattern
  const fs = require('fs');
  const controllersDir = 'src/controllers';
  const controllersToCheck = ['category', 'brand', 'customer', 'supplier', 'product', 'sale', 'purchase', 'quotation', 'stockMovement', 'inventory'];

  for (const name of controllersToCheck) {
    const content = fs.readFileSync(`${controllersDir}/${name}.controller.js`, 'utf8');
    const hasCompanyWhere = content.includes('company_id: req.companyId');
    assert(`${name}.controller.js has company_id in WHERE`, hasCompanyWhere);
  }

  // ─── Summary ───
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`${'═'.repeat(50)}`);

  process.exit(failed === 0 ? 0 : 1);
}

run().catch(console.error);
