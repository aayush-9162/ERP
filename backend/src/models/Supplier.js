const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Supplier = sequelize.define('Supplier', {
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
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  tax_id: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Tax ID: GSTIN, EIN, VAT number',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'suppliers',
  indexes: [
    { fields: ['phone'] },
    { fields: ['name'] },
  ],
});

module.exports = Supplier;
