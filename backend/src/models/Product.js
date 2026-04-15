const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
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
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  hsn_code: {
    type: DataTypes.STRING(8),
    allowNull: true,
    comment: 'HSN/SAC code for GST classification',
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  purchase_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  selling_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  tax_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 18.00,
    comment: 'GST percentage',
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pcs',
  },
  min_stock_alert: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'products',
  indexes: [
    { unique: true, fields: ['sku'] },
    { unique: true, fields: ['barcode'] },
    { fields: ['category_id'] },
    { fields: ['brand_id'] },
    { fields: ['status'] },
    { fields: ['hsn_code'] },
  ],
});

module.exports = Product;
