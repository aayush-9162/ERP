const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: { isEmail: true },
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Billing address',
  },
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Shipping address. NULL or empty = same as billing.',
  },
  gst_number: {
    type: DataTypes.STRING(15),
    allowNull: true,
    validate: {
      is: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i,
    },
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: true,
    defaultValue: 'IN',
    comment: 'ISO 3166-1 alpha-2',
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'State/province for tax determination',
  },
  tax_id: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Tax ID: GSTIN (India), EIN/SSN (US), VAT (EU)',
  },
  credit_limit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '0 = no limit',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'customers',
  indexes: [
    { fields: ['phone'] },
    { fields: ['name'] },
  ],
});

module.exports = Customer;
