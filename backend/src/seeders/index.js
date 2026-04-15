require('dotenv').config();
const { sequelize, Role, Permission, User, Company, UserCompany, Category, Brand, Product, Inventory, StockMovement, Customer, Sale, SaleItem, Payment, Supplier, Purchase, PurchaseItem, SupplierPayment, Account, Transaction, Quotation, QuotationItem, TaxRule, Currency, ExchangeRate } = require('../models');
const { ROLES } = require('../config/constants');

async function seed() {
  try {
    await sequelize.sync({ force: true });
    console.log('Database synced.');

    // ===== Phase 1: Core =====

    const [adminRole, managerRole, staffRole] = await Promise.all([
      Role.create({ name: ROLES.ADMIN, description: 'Full system access' }),
      Role.create({ name: ROLES.MANAGER, description: 'Department-level management access' }),
      Role.create({ name: ROLES.STAFF, description: 'Basic operational access' }),
    ]);

    const permissions = await Permission.bulkCreate([
      { name: 'users:create', description: 'Create users', module: 'users' },
      { name: 'users:read', description: 'View users', module: 'users' },
      { name: 'users:update', description: 'Update users', module: 'users' },
      { name: 'users:delete', description: 'Delete/deactivate users', module: 'users' },
      { name: 'company:read', description: 'View company profile', module: 'company' },
      { name: 'company:update', description: 'Update company profile', module: 'company' },
      { name: 'roles:manage', description: 'Manage roles', module: 'roles' },
      { name: 'inventory:create', description: 'Create products', module: 'inventory' },
      { name: 'inventory:read', description: 'View inventory', module: 'inventory' },
      { name: 'inventory:update', description: 'Update products', module: 'inventory' },
      { name: 'inventory:delete', description: 'Delete products', module: 'inventory' },
      { name: 'inventory:stock_adjust', description: 'Adjust stock', module: 'inventory' },
      { name: 'sales:create', description: 'Create sales', module: 'sales' },
      { name: 'sales:read', description: 'View sales', module: 'sales' },
      { name: 'sales:update', description: 'Update sales', module: 'sales' },
      { name: 'sales:delete', description: 'Delete sales', module: 'sales' },
      { name: 'customers:create', description: 'Create customers', module: 'customers' },
      { name: 'customers:read', description: 'View customers', module: 'customers' },
      { name: 'customers:update', description: 'Update customers', module: 'customers' },
      { name: 'purchases:create', description: 'Create purchases', module: 'purchases' },
      { name: 'purchases:read', description: 'View purchases', module: 'purchases' },
      { name: 'purchases:update', description: 'Update purchases', module: 'purchases' },
      { name: 'suppliers:create', description: 'Create suppliers', module: 'suppliers' },
      { name: 'suppliers:read', description: 'View suppliers', module: 'suppliers' },
      { name: 'suppliers:update', description: 'Update suppliers', module: 'suppliers' },
    ]);

    await adminRole.setPermissions(permissions);
    await managerRole.setPermissions(permissions.filter((p) =>
      ['users:read', 'company:read', 'inventory:create', 'inventory:read', 'inventory:update', 'inventory:stock_adjust', 'sales:create', 'sales:read', 'sales:update', 'customers:create', 'customers:read', 'customers:update', 'purchases:create', 'purchases:read', 'purchases:update', 'suppliers:create', 'suppliers:read', 'suppliers:update'].includes(p.name)
    ));
    await staffRole.setPermissions(permissions.filter((p) =>
      ['company:read', 'inventory:read', 'sales:create', 'sales:read', 'customers:create', 'customers:read', 'purchases:read', 'suppliers:read'].includes(p.name)
    ));
    console.log('Roles + permissions set.');

    const adminUser = await User.create({ first_name: 'Super', last_name: 'Admin', email: 'admin@erp.local', password: 'Admin@123', phone: '9876543210', role_id: adminRole.id, status: 'active' });
    const managerUser = await User.create({ first_name: 'Rahul', last_name: 'Sharma', email: 'manager@erp.local', password: 'Manager@123', phone: '9876543211', role_id: managerRole.id, status: 'active' });
    const staffUser = await User.create({ first_name: 'Priya', last_name: 'Patel', email: 'staff@erp.local', password: 'Staff@123', phone: '9876543212', role_id: staffRole.id, status: 'active' });
    const company1 = await Company.create({ name: 'Acme Industries Pvt. Ltd.', gst_number: '27AAPFU0939F1ZV', pan_number: 'AAPFU0939F', address_line1: '42, Industrial Area Phase II', city: 'Pune', state: 'Maharashtra', pincode: '411018', country: 'India', currency: 'INR', phone: '020-12345678', email: 'info@acmeindustries.in', website: 'https://acmeindustries.in', owner_id: adminUser.id });

    // User-Company associations: all 3 users belong to company 1
    await UserCompany.bulkCreate([
      { user_id: adminUser.id, company_id: company1.id, role_id: adminRole.id, status: 'active' },
      { user_id: managerUser.id, company_id: company1.id, role_id: managerRole.id, status: 'active' },
      { user_id: staffUser.id, company_id: company1.id, role_id: staffRole.id, status: 'active' },
    ]);

    // Set company_id on all seeded data
    const CID = company1.id;
    console.log('Users + company created (ID:', CID, ')');

    // ===== Phase 2: Inventory =====

    const [catElectronics, catFurniture, catStationery] = await Promise.all([
      Category.create({ company_id: CID, name: 'Electronics', description: 'Electronic items' }),
      Category.create({ company_id: CID, name: 'Furniture', description: 'Office furniture' }),
      Category.create({ company_id: CID, name: 'Stationery', description: 'Office supplies' }),
    ]);
    const [brandHP, brandDell, brandGodrej, brandCello] = await Promise.all([
      Brand.create({ company_id: CID, name: 'HP' }), Brand.create({ company_id: CID, name: 'Dell' }), Brand.create({ company_id: CID, name: 'Godrej' }), Brand.create({ company_id: CID, name: 'Cello' }),
    ]);
    // Barcodes are valid EAN-13: 200 + 9-digit product ID + check digit
    const products = await Product.bulkCreate([
      { company_id: CID, name: 'HP Laptop ProBook 450', sku: 'ELEC-HP-001', barcode: '2000000000015', hsn_code: '84713010', category_id: catElectronics.id, brand_id: brandHP.id, purchase_price: 45000, selling_price: 55000, tax_rate: 18, unit: 'pcs', min_stock_alert: 5 },
      { company_id: CID, name: 'Dell Monitor 24"', sku: 'ELEC-DELL-001', barcode: '2000000000022', hsn_code: '85285100', category_id: catElectronics.id, brand_id: brandDell.id, purchase_price: 12000, selling_price: 15000, tax_rate: 18, unit: 'pcs', min_stock_alert: 10 },
      { company_id: CID, name: 'HP Wireless Mouse', sku: 'ELEC-HP-002', barcode: '2000000000039', hsn_code: '84716060', category_id: catElectronics.id, brand_id: brandHP.id, purchase_price: 500, selling_price: 800, tax_rate: 18, unit: 'pcs', min_stock_alert: 20 },
      { company_id: CID, name: 'Godrej Office Desk', sku: 'FURN-GDR-001', barcode: '2000000000046', hsn_code: '94033000', category_id: catFurniture.id, brand_id: brandGodrej.id, purchase_price: 8000, selling_price: 12000, tax_rate: 18, unit: 'pcs', min_stock_alert: 3 },
      { company_id: CID, name: 'Godrej Steel Almirah', sku: 'FURN-GDR-002', barcode: '2000000000053', hsn_code: '94031000', category_id: catFurniture.id, brand_id: brandGodrej.id, purchase_price: 15000, selling_price: 20000, tax_rate: 18, unit: 'pcs', min_stock_alert: 2 },
      { company_id: CID, name: 'Cello Ball Pen (Pack of 10)', sku: 'STAT-CEL-001', barcode: '2000000000060', hsn_code: '96081000', category_id: catStationery.id, brand_id: brandCello.id, purchase_price: 80, selling_price: 120, tax_rate: 12, unit: 'pack', min_stock_alert: 50 },
      { company_id: CID, name: 'A4 Copier Paper (Ream)', sku: 'STAT-GEN-001', barcode: '2000000000077', hsn_code: '48025520', category_id: catStationery.id, brand_id: null, purchase_price: 250, selling_price: 350, tax_rate: 5, unit: 'pack', min_stock_alert: 30 },
    ]);
    for (const { idx, qty } of [{ idx: 0, qty: 25 }, { idx: 1, qty: 40 }, { idx: 2, qty: 100 }, { idx: 3, qty: 8 }, { idx: 4, qty: 1 }, { idx: 5, qty: 200 }, { idx: 6, qty: 15 }]) {
      await Inventory.create({ company_id: CID, product_id: products[idx].id, warehouse_id: null, stock_quantity: qty });
      await StockMovement.create({ company_id: CID, product_id: products[idx].id, warehouse_id: null, type: 'IN', quantity: qty, reference: 'purchase', notes: 'Initial stock', created_by: adminUser.id });
    }
    console.log('Inventory seeded.');

    // ===== Phase 3: Sales =====

    await Customer.bulkCreate([
      { name: 'Amit Verma', phone: '9812345678', email: 'amit@example.com', address: '101, MG Road, Pune' },
      { name: 'TechSoft Solutions', phone: '9823456789', email: 'info@techsoft.in', address: '203, IT Park, Hinjewadi', gst_number: '27AABCT1234D1ZP' },
      { name: 'Sunita Enterprises', phone: '9834567890', email: 'sunita@example.com', address: '55, Market Yard, Pune', gst_number: '27AADCS5678E1ZQ' },
    ]);
    // Mouse: 2x800=1600, 18% tax=288, total=1888
    // Pen:   1x120=120,  12% tax=14.40, total=134.40
    // Header: sub=1720, tax=302.40, final=2022.40
    const sale1 = await Sale.create({ invoice_number: 'INV-202604-0001', customer_id: null, total_amount: 1720, tax_amount: 302.40, discount_amount: 0, final_amount: 2022.40, paid_amount: 2022.40, payment_status: 'PAID', payment_method: 'CASH', created_by: adminUser.id });
    await SaleItem.bulkCreate([
      { sale_id: sale1.id, product_id: products[2].id, product_name: 'HP Wireless Mouse', product_sku: 'ELEC-HP-002', quantity: 2, unit_price: 800, tax_rate: 18, tax_amount: 288, total: 1888 },
      { sale_id: sale1.id, product_id: products[5].id, product_name: 'Cello Ball Pen (Pack of 10)', product_sku: 'STAT-CEL-001', quantity: 1, unit_price: 120, tax_rate: 12, tax_amount: 14.40, total: 134.40 },
    ]);
    await Payment.create({ sale_id: sale1.id, amount: 2022.40, method: 'CASH' });
    for (const { prodIdx, qty } of [{ prodIdx: 2, qty: 2 }, { prodIdx: 5, qty: 1 }]) {
      const inv = await Inventory.findOne({ where: { product_id: products[prodIdx].id, warehouse_id: null } });
      await inv.update({ stock_quantity: inv.stock_quantity - qty });
      await StockMovement.create({ company_id: CID, product_id: products[prodIdx].id, warehouse_id: null, type: 'OUT', quantity: -qty, reference: 'sale', notes: 'Seeded sale', created_by: adminUser.id });
    }
    console.log('Sales seeded.');

    // ===== Phase 4: Suppliers & Purchases =====

    const suppliers = await Supplier.bulkCreate([
      { name: 'MegaTech Distributors', phone: '9845123456', email: 'sales@megatech.in', address: 'MIDC Bhosari, Pune', gst_number: '27AAACM1234E1ZR' },
      { name: 'Sharma Office Supplies', phone: '9856234567', email: 'sharma.office@gmail.com', address: '12, Laxmi Road, Pune' },
      { name: 'National Paper Mills', phone: '9867345678', email: 'orders@nationalpaper.in', address: 'Industrial Estate, Satara Road', gst_number: '27AAECN5678F1ZS' },
    ]);

    const pur1 = await Purchase.create({ purchase_number: 'PUR-202604-0001', supplier_id: suppliers[0].id, total_amount: 57000, tax_amount: 10260, discount_amount: 0, final_amount: 67260, paid_amount: 67260, payment_status: 'PAID', created_by: adminUser.id });
    await PurchaseItem.bulkCreate([
      { purchase_id: pur1.id, product_id: products[0].id, product_name: 'HP Laptop ProBook 450', product_sku: 'ELEC-HP-001', quantity: 1, unit_price: 45000, tax_rate: 18, tax_amount: 8100, total: 53100 },
      { purchase_id: pur1.id, product_id: products[2].id, product_name: 'HP Wireless Mouse', product_sku: 'ELEC-HP-002', quantity: 24, unit_price: 500, tax_rate: 18, tax_amount: 2160, total: 14160 },
    ]);
    await SupplierPayment.create({ purchase_id: pur1.id, amount: 67260, method: 'BANK', reference: 'NEFT-20260401' });
    for (const { prodIdx, qty } of [{ prodIdx: 0, qty: 1 }, { prodIdx: 2, qty: 24 }]) {
      const inv = await Inventory.findOne({ where: { product_id: products[prodIdx].id, warehouse_id: null } });
      await inv.update({ stock_quantity: inv.stock_quantity + qty });
      await StockMovement.create({ company_id: CID, product_id: products[prodIdx].id, warehouse_id: null, type: 'IN', quantity: qty, reference: 'purchase', notes: 'PUR-202604-0001', created_by: adminUser.id });
    }

    const pur2 = await Purchase.create({ purchase_number: 'PUR-202604-0002', supplier_id: suppliers[2].id, total_amount: 5000, tax_amount: 250, discount_amount: 0, final_amount: 5250, paid_amount: 0, payment_status: 'UNPAID', created_by: adminUser.id });
    await PurchaseItem.create({ purchase_id: pur2.id, product_id: products[6].id, product_name: 'A4 Copier Paper (Ream)', product_sku: 'STAT-GEN-001', quantity: 20, unit_price: 250, tax_rate: 5, tax_amount: 250, total: 5250 });
    const inv6 = await Inventory.findOne({ where: { product_id: products[6].id, warehouse_id: null } });
    await inv6.update({ stock_quantity: inv6.stock_quantity + 20 });
    await StockMovement.create({ company_id: CID, product_id: products[6].id, warehouse_id: null, type: 'IN', quantity: 20, reference: 'purchase', notes: 'PUR-202604-0002', created_by: adminUser.id });

    console.log('Purchases seeded.');

    // ===== Phase 5: Accounting =====

    // Permissions
    const p5perms = await Permission.bulkCreate([
      { name: 'reports:read', description: 'View reports', module: 'reports' },
      { name: 'accounting:read', description: 'View accounts', module: 'accounting' },
      { name: 'accounting:manage', description: 'Manage accounts', module: 'accounting' },
    ]);
    // Add to admin (all) and manager (read)
    const existingAdminPerms = await adminRole.getPermissions();
    await adminRole.setPermissions([...existingAdminPerms, ...p5perms]);
    const existingMgrPerms = await managerRole.getPermissions();
    await managerRole.setPermissions([...existingMgrPerms, ...p5perms.filter((p) => p.name !== 'accounting:manage')]);

    // Chart of Accounts
    await Account.bulkCreate([
      { name: 'Cash', type: 'ASSET', description: 'Cash on hand' },
      { name: 'Bank', type: 'ASSET', description: 'Bank account' },
      { name: 'Accounts Receivable', type: 'ASSET', description: 'Money owed by customers' },
      { name: 'Accounts Payable', type: 'LIABILITY', description: 'Money owed to suppliers' },
      { name: 'Sales Income', type: 'INCOME', description: 'Revenue from sales' },
      { name: 'Purchase Expense', type: 'EXPENSE', description: 'Cost of goods purchased' },
      { name: 'Tax Collected (GST)', type: 'LIABILITY', description: 'Output GST collected on sales' },
      { name: 'Tax Paid (Input GST)', type: 'ASSET', description: 'Input GST paid on purchases' },
      { name: 'Discount Given', type: 'EXPENSE', description: 'Discounts offered to customers' },
    ]);

    // Record accounting entries for seeded sale (sale1: PAID, CASH, 1957.60)
    const AccountingService = require('../services/accounting.service');
    AccountingService._cache = {}; // Clear cache
    await AccountingService.recordSale(sale1);
    const pay1 = await Payment.findOne({ where: { sale_id: sale1.id } });
    await AccountingService.recordPaymentReceived(pay1, sale1);

    // Record accounting for seeded purchases
    await AccountingService.recordPurchase(pur1);
    const spur1 = await SupplierPayment.findOne({ where: { purchase_id: pur1.id } });
    await AccountingService.recordSupplierPayment(spur1, pur1);
    await AccountingService.recordPurchase(pur2);
    // pur2 is UNPAID — no payment entry

    console.log('Accounting seeded.');

    // ===== Phase 6: Quotations + GST permissions =====
    const p6perms = await Permission.bulkCreate([
      { name: 'quotations:create', description: 'Create quotations', module: 'quotations' },
      { name: 'quotations:read', description: 'View quotations', module: 'quotations' },
      { name: 'quotations:update', description: 'Update quotations', module: 'quotations' },
      { name: 'gst:read', description: 'View GST reports', module: 'gst' },
    ]);
    const ea = await adminRole.getPermissions();
    await adminRole.setPermissions([...ea, ...p6perms]);
    const em = await managerRole.getPermissions();
    await managerRole.setPermissions([...em, ...p6perms]);
    const es = await staffRole.getPermissions();
    await staffRole.setPermissions([...es, ...p6perms.filter((p) => ['quotations:create', 'quotations:read'].includes(p.name))]);

    // Sample quotation
    const customers = await Customer.findAll({ raw: true });
    const quo1 = await Quotation.create({
      quotation_number: 'QUO-202604-0001', customer_id: customers[1]?.id || null,
      total_amount: 67000, tax_amount: 12060, discount_amount: 500,
      final_amount: 78560, status: 'SENT', created_by: adminUser.id,
      valid_until: '2026-04-30',
    });
    await QuotationItem.bulkCreate([
      { quotation_id: quo1.id, product_id: products[0].id, product_name: 'HP Laptop ProBook 450', product_sku: 'ELEC-HP-001', quantity: 1, unit_price: 55000, tax_rate: 18, tax_amount: 9900, total: 64900 },
      { quotation_id: quo1.id, product_id: products[2].id, product_name: 'HP Wireless Mouse', product_sku: 'ELEC-HP-002', quantity: 15, unit_price: 800, tax_rate: 18, tax_amount: 2160, total: 14160 },
    ]);
    console.log('Quotations seeded.');

    // Bulk-set company_id on all remaining tables that might have missed it
    const tables = ['customers', 'sales', 'sale_items', 'payments', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments', 'accounts', 'transactions', 'quotations', 'quotation_items'];
    for (const t of tables) {
      await sequelize.query(`UPDATE ${t} SET company_id = :cid WHERE company_id IS NULL`, { replacements: { cid: CID } }).catch(() => {});
    }
    console.log('Company IDs set on all data.');

    // ===== Multi-Country: Currencies + Tax Rules =====

    await Currency.bulkCreate([
      { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimal_places: 2 },
      { code: 'USD', symbol: '$', name: 'US Dollar', decimal_places: 2 },
      { code: 'EUR', symbol: '€', name: 'Euro', decimal_places: 2 },
      { code: 'GBP', symbol: '£', name: 'British Pound', decimal_places: 2 },
      { code: 'AED', symbol: 'AED', name: 'UAE Dirham', decimal_places: 2 },
    ]);

    await ExchangeRate.bulkCreate([
      { from_currency: 'USD', to_currency: 'INR', rate: 83.50 },
      { from_currency: 'EUR', to_currency: 'INR', rate: 90.20 },
      { from_currency: 'GBP', to_currency: 'INR', rate: 105.30 },
      { from_currency: 'AED', to_currency: 'INR', rate: 22.73 },
      { from_currency: 'USD', to_currency: 'EUR', rate: 0.92 },
      { from_currency: 'USD', to_currency: 'GBP', rate: 0.79 },
    ]);

    await TaxRule.bulkCreate([
      // India GST rates (standard)
      { country: 'IN', state: null, tax_type: 'CGST', rate: 9, name: 'Central GST @9%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'SGST', rate: 9, name: 'State GST @9%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'IGST', rate: 18, name: 'Integrated GST @18%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'CGST', rate: 6, name: 'Central GST @6%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'SGST', rate: 6, name: 'State GST @6%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'IGST', rate: 12, name: 'Integrated GST @12%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'CGST', rate: 2.5, name: 'Central GST @2.5%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'SGST', rate: 2.5, name: 'State GST @2.5%', applicable_from: '2017-07-01' },
      { country: 'IN', state: null, tax_type: 'IGST', rate: 5, name: 'Integrated GST @5%', applicable_from: '2017-07-01' },
      // US state sales tax rates (sample states)
      { country: 'US', state: 'CA', tax_type: 'SALES_TAX', rate: 7.25, name: 'California Sales Tax', applicable_from: '2024-01-01' },
      { country: 'US', state: 'NY', tax_type: 'SALES_TAX', rate: 8.00, name: 'New York Sales Tax', applicable_from: '2024-01-01' },
      { country: 'US', state: 'TX', tax_type: 'SALES_TAX', rate: 6.25, name: 'Texas Sales Tax', applicable_from: '2024-01-01' },
      { country: 'US', state: 'FL', tax_type: 'SALES_TAX', rate: 6.00, name: 'Florida Sales Tax', applicable_from: '2024-01-01' },
      { country: 'US', state: 'WA', tax_type: 'SALES_TAX', rate: 6.50, name: 'Washington Sales Tax', applicable_from: '2024-01-01' },
      { country: 'US', state: 'OR', tax_type: 'SALES_TAX', rate: 0, name: 'Oregon (No Sales Tax)', applicable_from: '2024-01-01' },
      { country: 'US', state: 'NH', tax_type: 'SALES_TAX', rate: 0, name: 'New Hampshire (No Sales Tax)', applicable_from: '2024-01-01' },
      // UK VAT
      { country: 'GB', state: null, tax_type: 'VAT', rate: 20, name: 'UK VAT @20%', applicable_from: '2011-01-04' },
      // UAE VAT
      { country: 'AE', state: null, tax_type: 'VAT', rate: 5, name: 'UAE VAT @5%', applicable_from: '2018-01-01' },
    ]);
    console.log('Tax rules + currencies seeded.');

    console.log('\nSeed complete!');
    console.log('  Admin   -> admin@erp.local   / Admin@123');
    console.log('  Manager -> manager@erp.local  / Manager@123');
    console.log('  Staff   -> staff@erp.local    / Staff@123');
    console.log('  7 products, 5 currencies, 19 tax rules (IN/US/GB/AE).');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
