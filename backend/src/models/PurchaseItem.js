const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PurchaseItem = sequelize.define('PurchaseItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  purchase_id: {
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
    comment: 'Snapshot at time of purchase',
  },
  product_sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Purchase price per unit',
  },
  tax_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
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
  },
}, {
  tableName: 'purchase_items',
  indexes: [
    { fields: ['purchase_id'] },
    { fields: ['product_id'] },
  ],
});

module.exports = PurchaseItem;
