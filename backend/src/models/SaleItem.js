const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SaleItem = sequelize.define('SaleItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  product_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Snapshot — product name at time of sale',
  },
  product_sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Snapshot — SKU at time of sale',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Locked selling price at time of sale',
  },
  tax_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: 'GST % at time of sale',
  },
  tax_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    comment: '(unit_price * quantity) + tax_amount',
  },
}, {
  tableName: 'sale_items',
  indexes: [
    { fields: ['sale_id'] },
    { fields: ['product_id'] },
  ],
});

module.exports = SaleItem;
