const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  gst_number: {
    type: DataTypes.STRING(15),
    allowNull: true,
    validate: {
      is: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i,
    },
    comment: 'Indian GST number (15 chars)',
  },
  pan_number: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  address_line1: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  address_line2: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'India',
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR',
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
  website: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User who created/owns this company',
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tenant this company belongs to',
  },
}, {
  tableName: 'companies',
});

module.exports = Company;
