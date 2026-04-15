// Centralized constants for the ERP system
module.exports = {
  ROLES: {
    ADMIN: 'admin',
    MANAGER: 'manager',
    STAFF: 'staff',
  },

  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },

  STOCK_MOVEMENT_TYPES: {
    IN: 'IN',
    OUT: 'OUT',
    ADJUSTMENT: 'ADJUSTMENT',
  },

  STOCK_REFERENCES: {
    PURCHASE: 'purchase',
    SALE: 'sale',
    MANUAL: 'manual',
    RETURN: 'return',
  },

  UNITS: ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'set', 'pair', 'meter'],

  PAYMENT_STATUS: {
    PAID: 'PAID',
    PARTIAL: 'PARTIAL',
    UNPAID: 'UNPAID',
  },

  PAYMENT_METHODS: ['CASH', 'UPI', 'CARD', 'MIXED'],
  SUPPLIER_PAYMENT_METHODS: ['CASH', 'UPI', 'BANK'],

  // Default permissions by module — extend as new ERP modules are added
  PERMISSIONS: {
    USERS: {
      CREATE: 'users:create',
      READ: 'users:read',
      UPDATE: 'users:update',
      DELETE: 'users:delete',
    },
    COMPANY: {
      READ: 'company:read',
      UPDATE: 'company:update',
    },
    ROLES: {
      MANAGE: 'roles:manage',
    },
    INVENTORY: {
      CREATE: 'inventory:create',
      READ: 'inventory:read',
      UPDATE: 'inventory:update',
      DELETE: 'inventory:delete',
      STOCK_ADJUST: 'inventory:stock_adjust',
    },
    SALES: {
      CREATE: 'sales:create',
      READ: 'sales:read',
      UPDATE: 'sales:update',
      DELETE: 'sales:delete',
    },
    CUSTOMERS: {
      CREATE: 'customers:create',
      READ: 'customers:read',
      UPDATE: 'customers:update',
    },
    PURCHASES: {
      CREATE: 'purchases:create',
      READ: 'purchases:read',
      UPDATE: 'purchases:update',
    },
    SUPPLIERS: {
      CREATE: 'suppliers:create',
      READ: 'suppliers:read',
      UPDATE: 'suppliers:update',
    },
    REPORTS: {
      READ: 'reports:read',
    },
    ACCOUNTING: {
      READ: 'accounting:read',
      MANAGE: 'accounting:manage',
    },
    QUOTATIONS: {
      CREATE: 'quotations:create',
      READ: 'quotations:read',
      UPDATE: 'quotations:update',
    },
    GST: {
      READ: 'gst:read',
    },
  },

  QUOTATION_STATUS: {
    DRAFT: 'DRAFT',
    SENT: 'SENT',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    CONVERTED: 'CONVERTED',
  },

  // Indian GST state codes
  GST_STATE_CODES: {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala',
    '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
  },

  ACCOUNT_TYPES: {
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    INCOME: 'INCOME',
    EXPENSE: 'EXPENSE',
  },

  // Default chart of accounts — seeded on first run
  DEFAULT_ACCOUNTS: {
    CASH: 'Cash',
    BANK: 'Bank',
    ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
    ACCOUNTS_PAYABLE: 'Accounts Payable',
    SALES_INCOME: 'Sales Income',
    PURCHASE_EXPENSE: 'Purchase Expense',
    TAX_COLLECTED: 'Tax Collected (GST)',
    TAX_PAID: 'Tax Paid (Input GST)',
    DISCOUNT_GIVEN: 'Discount Given',
  },
};
