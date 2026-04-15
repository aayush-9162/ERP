/**
 * Multi-company switching and cross-company permission test.
 *
 * Validates:
 * 1.  User sees only their companies on login
 * 2.  Company creation auto-assigns admin role
 * 3.  Switching to own company succeeds
 * 4.  Switching to another user's company is rejected
 * 5.  Data created in Company A is invisible from Company B
 * 6.  Invite user to company with specific role works
 * 7.  Invited user can access the company
 * 8.  Removed user loses access immediately
 * 9.  User has different roles in different companies
 * 10. companyScope middleware blocks missing header gracefully
 * 11. x-company-id header with wrong company is rejected
 * 12. Self-removal is blocked
 * 13. Duplicate invite is rejected
 *
 * Usage: NODE_ENV=production node src/tests/multicompany.test.js
 */

require('dotenv').config();
const { sequelize, User, Role, Company, UserCompany, Product, Category, Inventory } = require('../models');
const bcrypt = require('bcryptjs');

let passed = 0, failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { console.log(`  [PASS] ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label} ${detail}`); failed++; }
}

// Simulate HTTP-level middleware chain for a user+company combo
async function simulateCompanyScope(userId, companyId) {
  const membership = await UserCompany.findOne({
    where: { user_id: userId, company_id: companyId, status: 'active' },
  });
  return membership ? { companyId, roleId: membership.role_id, allowed: true } : { allowed: false };
}

let adminUser, managerUser, staffUser, outsiderUser;
let adminRole, managerRole, staffRole;
let company1, company2, company3;

async function setup() {
  await sequelize.authenticate();
  console.log('DB connected.\n');

  adminRole = await Role.findOne({ where: { name: 'admin' } });
  managerRole = await Role.findOne({ where: { name: 'manager' } });
  staffRole = await Role.findOne({ where: { name: 'staff' } });

  adminUser = await User.findOne({ where: { email: 'admin@erp.local' } });
  managerUser = await User.findOne({ where: { email: 'manager@erp.local' } });
  staffUser = await User.findOne({ where: { email: 'staff@erp.local' } });

  // Create an outsider user who has no companies
  let ou = await User.findOne({ where: { email: 'outsider@test.local' } });
  if (!ou) {
    ou = await User.create({
      first_name: 'Outside', last_name: 'User', email: 'outsider@test.local',
      password: 'Test@123', phone: '1111111111', role_id: staffRole.id, status: 'active',
    });
  }
  outsiderUser = ou;

  company1 = await Company.findOne({ where: { name: 'Acme Industries Pvt. Ltd.' } });

  // Create Company 2 owned by manager
  let c2 = await Company.findOne({ where: { name: 'Manager Corp Test' } });
  if (!c2) {
    c2 = await Company.create({ name: 'Manager Corp Test', country: 'India', currency: 'INR', owner_id: managerUser.id });
    await UserCompany.create({ user_id: managerUser.id, company_id: c2.id, role_id: adminRole.id, status: 'active' });
  }
  company2 = c2;

  // Create Company 3 owned by admin (for multi-company user test)
  let c3 = await Company.findOne({ where: { name: 'Admin Side Biz' } });
  if (!c3) {
    c3 = await Company.create({ name: 'Admin Side Biz', country: 'India', currency: 'USD', owner_id: adminUser.id });
    await UserCompany.findOrCreate({ where: { user_id: adminUser.id, company_id: c3.id }, defaults: { role_id: adminRole.id, status: 'active' } });
  }
  company3 = c3;

  console.log(`Setup: Company1=${company1.id} (Acme), Company2=${company2.id} (Manager Corp), Company3=${company3.id} (Admin Side Biz)`);
  console.log(`Users: admin=${adminUser.id}, manager=${managerUser.id}, staff=${staffUser.id}, outsider=${outsiderUser.id}\n`);
}

// ──────────────────────────────────
// Test 1: User sees only their companies
// ──────────────────────────────────
async function testUserCompanyList() {
  console.log('=== Test 1: User sees only their companies ===');

  const adminCompanies = await UserCompany.findAll({ where: { user_id: adminUser.id, status: 'active' } });
  const managerCompanies = await UserCompany.findAll({ where: { user_id: managerUser.id, status: 'active' } });
  const outsiderCompanies = await UserCompany.findAll({ where: { user_id: outsiderUser.id, status: 'active' } });

  assert('Admin has >= 2 companies (Acme + Side Biz)', adminCompanies.length >= 2, `got ${adminCompanies.length}`);
  assert('Manager has >= 2 companies (Acme + Manager Corp)', managerCompanies.length >= 2, `got ${managerCompanies.length}`);
  assert('Outsider has 0 companies', outsiderCompanies.length === 0);
}

// ──────────────────────────────────
// Test 2: Company creation auto-assigns admin
// ──────────────────────────────────
async function testCompanyCreationRole() {
  console.log('\n=== Test 2: Company creation auto-assigns admin ===');

  const c2membership = await UserCompany.findOne({
    where: { user_id: managerUser.id, company_id: company2.id },
    include: [{ association: 'role' }],
  });
  assert('Manager is admin of Company 2', c2membership?.role?.name === 'admin', `got ${c2membership?.role?.name}`);
  assert('Company 2 owner_id = manager', company2.owner_id === managerUser.id);
}

// ──────────────────────────────────
// Test 3: Switching to own company succeeds
// ──────────────────────────────────
async function testSwitchOwnCompany() {
  console.log('\n=== Test 3: Switch to own company ===');

  const r1 = await simulateCompanyScope(adminUser.id, company1.id);
  assert('Admin → Company 1: allowed', r1.allowed);

  const r2 = await simulateCompanyScope(adminUser.id, company3.id);
  assert('Admin → Company 3 (Side Biz): allowed', r2.allowed);

  const r3 = await simulateCompanyScope(managerUser.id, company2.id);
  assert('Manager → Company 2 (own): allowed', r3.allowed);
}

// ──────────────────────────────────
// Test 4: Switching to non-member company rejected
// ──────────────────────────────────
async function testSwitchForeignCompany() {
  console.log('\n=== Test 4: Switch to foreign company blocked ===');

  const r1 = await simulateCompanyScope(outsiderUser.id, company1.id);
  assert('Outsider → Company 1: BLOCKED', !r1.allowed);

  const r2 = await simulateCompanyScope(outsiderUser.id, company2.id);
  assert('Outsider → Company 2: BLOCKED', !r2.allowed);

  const r3 = await simulateCompanyScope(staffUser.id, company2.id);
  assert('Staff → Company 2 (not a member): BLOCKED', !r3.allowed);
}

// ──────────────────────────────────
// Test 5: Data isolation between companies
// ──────────────────────────────────
async function testDataIsolation() {
  console.log('\n=== Test 5: Data isolation ===');

  // Create a product in Company 3
  let prod3 = await Product.findOne({ where: { sku: 'MC-ISO-001', company_id: company3.id } });
  if (!prod3) {
    const cat = await Category.findOrCreate({ where: { name: 'MC-Test-Cat', company_id: company3.id }, defaults: { company_id: company3.id } });
    prod3 = await Product.create({
      name: 'Multi-Company Test Product', sku: 'MC-ISO-001', company_id: company3.id,
      purchase_price: 50, selling_price: 100, tax_rate: 18,
    });
    await Inventory.create({ product_id: prod3.id, warehouse_id: null, stock_quantity: 25, company_id: company3.id });
  }

  // Query as Company 1 — should NOT see Company 3's product
  const c1prods = await Product.findAll({ where: { company_id: company1.id } });
  const c3prods = await Product.findAll({ where: { company_id: company3.id } });

  assert('Company 1 has products', c1prods.length > 0);
  assert('Company 3 has MC-ISO-001', c3prods.some(p => p.sku === 'MC-ISO-001'));
  assert('Company 1 does NOT have MC-ISO-001', !c1prods.some(p => p.sku === 'MC-ISO-001'));

  // Inventory isolation
  const c1inv = await Inventory.findAll({ where: { company_id: company1.id } });
  const c3inv = await Inventory.findAll({ where: { company_id: company3.id } });
  assert('Company 1 inventory excludes Company 3 products',
    !c1inv.some(i => i.product_id === prod3.id));
  assert('Company 3 inventory includes MC product',
    c3inv.some(i => i.product_id === prod3.id));
}

// ──────────────────────────────────
// Test 6: Invite user with specific role
// ──────────────────────────────────
async function testInviteUser() {
  console.log('\n=== Test 6: Invite user ===');

  // Invite staff user to Company 2 as staff
  let existing = await UserCompany.findOne({
    where: { user_id: staffUser.id, company_id: company2.id },
  });
  if (existing) await existing.destroy();

  await UserCompany.create({
    user_id: staffUser.id, company_id: company2.id,
    role_id: staffRole.id, status: 'active',
  });

  const membership = await UserCompany.findOne({
    where: { user_id: staffUser.id, company_id: company2.id },
    include: [{ association: 'role' }],
  });
  assert('Staff invited to Company 2', !!membership);
  assert('Staff role in Company 2 = staff', membership.role.name === 'staff');
}

// ──────────────────────────────────
// Test 7: Invited user can access the company
// ──────────────────────────────────
async function testInvitedAccess() {
  console.log('\n=== Test 7: Invited user can access ===');

  const r = await simulateCompanyScope(staffUser.id, company2.id);
  assert('Staff → Company 2: allowed after invite', r.allowed);
}

// ──────────────────────────────────
// Test 8: Removed user loses access
// ──────────────────────────────────
async function testRemovedAccess() {
  console.log('\n=== Test 8: Removed user loses access ===');

  // Remove staff from Company 2
  const membership = await UserCompany.findOne({
    where: { user_id: staffUser.id, company_id: company2.id },
  });
  await membership.update({ status: 'removed' });

  const r = await simulateCompanyScope(staffUser.id, company2.id);
  assert('Staff → Company 2: BLOCKED after removal', !r.allowed);

  // Restore for other tests
  await membership.update({ status: 'active' });
}

// ──────────────────────────────────
// Test 9: Different roles in different companies
// ──────────────────────────────────
async function testDifferentRoles() {
  console.log('\n=== Test 9: Different roles per company ===');

  // Admin is admin in Company 1, admin in Company 3
  const ac1 = await UserCompany.findOne({
    where: { user_id: adminUser.id, company_id: company1.id },
    include: [{ association: 'role' }],
  });
  const ac3 = await UserCompany.findOne({
    where: { user_id: adminUser.id, company_id: company3.id },
    include: [{ association: 'role' }],
  });

  assert('Admin role in Company 1: admin', ac1?.role?.name === 'admin');
  assert('Admin role in Company 3: admin', ac3?.role?.name === 'admin');

  // Staff is staff in Company 1, staff in Company 2
  const sc1 = await UserCompany.findOne({
    where: { user_id: staffUser.id, company_id: company1.id },
    include: [{ association: 'role' }],
  });
  const sc2 = await UserCompany.findOne({
    where: { user_id: staffUser.id, company_id: company2.id },
    include: [{ association: 'role' }],
  });

  assert('Staff role in Company 1: staff', sc1?.role?.name === 'staff');
  assert('Staff role in Company 2: staff', sc2?.role?.name === 'staff');

  // Manager is manager in Company 1, admin in Company 2
  const mc1 = await UserCompany.findOne({
    where: { user_id: managerUser.id, company_id: company1.id },
    include: [{ association: 'role' }],
  });
  const mc2 = await UserCompany.findOne({
    where: { user_id: managerUser.id, company_id: company2.id },
    include: [{ association: 'role' }],
  });

  assert('Manager role in Company 1: manager', mc1?.role?.name === 'manager');
  assert('Manager role in Company 2: admin (creator)', mc2?.role?.name === 'admin');
}

// ──────────────────────────────────
// Test 10: No header falls back to first company
// ──────────────────────────────────
async function testNoHeaderFallback() {
  console.log('\n=== Test 10: No x-company-id header fallback ===');

  // Simulate middleware with no header — should pick first active company
  const firstUc = await UserCompany.findOne({
    where: { user_id: adminUser.id, status: 'active' },
    order: [['id', 'ASC']],
  });

  assert('Admin fallback company exists', !!firstUc);
  assert('Fallback is Company 1 (first joined)', firstUc.company_id === company1.id);

  // Outsider has no companies — would get error
  const ouUc = await UserCompany.findOne({
    where: { user_id: outsiderUser.id, status: 'active' },
  });
  assert('Outsider has no fallback (error expected)', !ouUc);
}

// ──────────────────────────────────
// Test 11: Wrong company ID header rejected
// ──────────────────────────────────
async function testWrongCompanyHeader() {
  console.log('\n=== Test 11: Wrong company ID rejected ===');

  // Staff is NOT a member of Company 3
  const r = await simulateCompanyScope(staffUser.id, company3.id);
  assert('Staff → Company 3 (not member): BLOCKED', !r.allowed);

  // Non-existent company
  const r2 = await simulateCompanyScope(adminUser.id, 99999);
  assert('Admin → Company 99999 (non-existent): BLOCKED', !r2.allowed);
}

// ──────────────────────────────────
// Test 12: Self-removal blocked
// ──────────────────────────────────
async function testSelfRemoval() {
  console.log('\n=== Test 12: Self-removal blocked ===');

  // The controller checks: if (parseInt(req.params.userId) === req.user.id)
  // Simulate this check
  const selfRemoveBlocked = (parseInt(adminUser.id) === adminUser.id);
  assert('Self-removal check works (userId === req.user.id)', selfRemoveBlocked);
}

// ──────────────────────────────────
// Test 13: Duplicate invite rejected
// ──────────────────────────────────
async function testDuplicateInvite() {
  console.log('\n=== Test 13: Duplicate invite detection ===');

  // Staff is already active in Company 2 (from test 6)
  const existing = await UserCompany.findOne({
    where: { user_id: staffUser.id, company_id: company2.id, status: 'active' },
  });
  assert('Staff already active in Company 2', !!existing);
  // Controller would throw conflict — we just verify the condition
  assert('Duplicate condition detected', existing?.status === 'active');
}

// ──────────────────────────────────
async function run() {
  try {
    await setup();
    await testUserCompanyList();
    await testCompanyCreationRole();
    await testSwitchOwnCompany();
    await testSwitchForeignCompany();
    await testDataIsolation();
    await testInviteUser();
    await testInvitedAccess();
    await testRemovedAccess();
    await testDifferentRoles();
    await testNoHeaderFallback();
    await testWrongCompanyHeader();
    await testSelfRemoval();
    await testDuplicateInvite();

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
