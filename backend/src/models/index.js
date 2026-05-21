const sequelize = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const Company = require('./Company');
const Category = require('./Category');
const Brand = require('./Brand');
const Product = require('./Product');
const Warehouse = require('./Warehouse');
const Inventory = require('./Inventory');
const StockMovement = require('./StockMovement');
const Customer = require('./Customer');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Payment = require('./Payment');
const Supplier = require('./Supplier');
const Purchase = require('./Purchase');
const PurchaseItem = require('./PurchaseItem');
const SupplierPayment = require('./SupplierPayment');
const Account = require('./Account');
const Transaction = require('./Transaction');
const Quotation = require('./Quotation');
const QuotationItem = require('./QuotationItem');
const TaxRule = require('./TaxRule');
const Currency = require('./Currency');
const ExchangeRate = require('./ExchangeRate');
const DayClosing = require('./DayClosing');

// Phase 1
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.belongsToMany(Permission, { through: 'role_permissions', foreignKey: 'role_id', otherKey: 'permission_id', as: 'permissions' });
Permission.belongsToMany(Role, { through: 'role_permissions', foreignKey: 'permission_id', otherKey: 'role_id', as: 'roles' });

// Phase 2: Inventory
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Brand.hasMany(Product, { foreignKey: 'brand_id', as: 'products' });
Product.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Product.hasMany(Inventory, { foreignKey: 'product_id', as: 'inventory' });
Inventory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Warehouse.hasMany(Inventory, { foreignKey: 'warehouse_id', as: 'inventory' });
Inventory.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Product.hasMany(StockMovement, { foreignKey: 'product_id', as: 'stockMovements' });
StockMovement.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Warehouse.hasMany(StockMovement, { foreignKey: 'warehouse_id', as: 'stockMovements' });
StockMovement.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
User.hasMany(StockMovement, { foreignKey: 'created_by', as: 'stockMovements' });
StockMovement.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// Phase 3: Sales
Customer.hasMany(Sale, { foreignKey: 'customer_id', as: 'sales' });
Sale.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
User.hasMany(Sale, { foreignKey: 'created_by', as: 'sales' });
Sale.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Product.hasMany(SaleItem, { foreignKey: 'product_id', as: 'saleItems' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Sale.hasMany(Payment, { foreignKey: 'sale_id', as: 'payments' });
Payment.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

// Phase 4: Purchases
Supplier.hasMany(Purchase, { foreignKey: 'supplier_id', as: 'purchases' });
Purchase.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
User.hasMany(Purchase, { foreignKey: 'created_by', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
Purchase.hasMany(PurchaseItem, { foreignKey: 'purchase_id', as: 'items' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });
Product.hasMany(PurchaseItem, { foreignKey: 'product_id', as: 'purchaseItems' });
PurchaseItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Purchase.hasMany(SupplierPayment, { foreignKey: 'purchase_id', as: 'payments' });
SupplierPayment.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });

// Phase 5: Accounting
Account.hasMany(Transaction, { foreignKey: 'account_id', as: 'transactions' });
Transaction.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });

// Phase 6: Quotations
Customer.hasMany(Quotation, { foreignKey: 'customer_id', as: 'quotations' });
Quotation.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
User.hasMany(Quotation, { foreignKey: 'created_by', as: 'quotations' });
Quotation.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
Quotation.hasMany(QuotationItem, { foreignKey: 'quotation_id', as: 'items' });
QuotationItem.belongsTo(Quotation, { foreignKey: 'quotation_id', as: 'quotation' });
Product.hasMany(QuotationItem, { foreignKey: 'product_id', as: 'quotationItems' });
QuotationItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Quotation.belongsTo(Sale, { foreignKey: 'converted_sale_id', as: 'convertedSale' });

// Multi-company: User <-> Company via UserCompany junction
const UserCompany = require('./UserCompany');
User.belongsToMany(Company, { through: UserCompany, foreignKey: 'user_id', otherKey: 'company_id', as: 'companies' });
Company.belongsToMany(User, { through: UserCompany, foreignKey: 'company_id', otherKey: 'user_id', as: 'members' });
User.hasMany(UserCompany, { foreignKey: 'user_id', as: 'userCompanies' });
Company.hasMany(UserCompany, { foreignKey: 'company_id', as: 'userCompanies' });
UserCompany.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserCompany.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
UserCompany.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Company.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// SaaS: Tenant associations
Tenant.hasMany(User, { foreignKey: 'tenant_id', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(Company, { foreignKey: 'tenant_id', as: 'companies' });
Company.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Day closings — created by a user, scoped to a company
User.hasMany(DayClosing, { foreignKey: 'closed_by', as: 'dayClosings' });
DayClosing.belongsTo(User, { foreignKey: 'closed_by', as: 'closedBy' });

// Company -> all business entities (for referential integrity)
const companyModels = [Category, Brand, Product, Warehouse, Customer, Supplier, Sale, Purchase, Quotation, Account, Inventory, StockMovement, Payment, SupplierPayment, Transaction, DayClosing];
for (const M of companyModels) {
  Company.hasMany(M, { foreignKey: 'company_id' });
  M.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
}

module.exports = {
  sequelize, Tenant, User, Role, Permission, Company, UserCompany,
  Category, Brand, Product, Warehouse, Inventory, StockMovement,
  Customer, Sale, SaleItem, Payment,
  Supplier, Purchase, PurchaseItem, SupplierPayment,
  TaxRule, Currency, ExchangeRate,
  Account, Transaction,
  Quotation, QuotationItem,
  DayClosing,
};
