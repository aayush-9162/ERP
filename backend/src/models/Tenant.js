const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  business_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'URL-safe unique identifier for the tenant',
  },
  owner_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  owner_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  owner_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    defaultValue: 'IN',
    comment: 'ISO 3166-1 alpha-2 country code (IN, US, GB, AE)',
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR',
  },
  plan: {
    type: DataTypes.ENUM('trial', 'basic', 'professional', 'enterprise'),
    defaultValue: 'trial',
  },
  max_users: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: 'Max users allowed under this plan',
  },
  max_companies: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Max companies allowed under this plan',
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'cancelled', 'trial'),
    defaultValue: 'trial',
  },
  trial_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  subscription_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  gst_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Tax ID of the tenant business',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Internal notes by super admin',
  },
}, {
  tableName: 'tenants',
});

module.exports = Tenant;
