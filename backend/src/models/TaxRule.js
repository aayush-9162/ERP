const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaxRule = sequelize.define('TaxRule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    comment: 'ISO 3166-1 alpha-2: IN, US, GB, etc.',
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'State/province code. NULL = applies to entire country',
  },
  tax_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'e.g. CGST, SGST, IGST, SALES_TAX, VAT, GST',
  },
  rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Display name: "Central GST", "State Sales Tax", etc.',
  },
  applicable_from: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'When this rate became effective',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'tax_rules',
  indexes: [
    { fields: ['country', 'state', 'tax_type'] },
    { fields: ['country', 'is_active'] },
  ],
});

module.exports = TaxRule;
