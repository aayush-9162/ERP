const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuotationItem = sequelize.define('QuotationItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  quotation_id: {
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
  tableName: 'quotation_items',
  indexes: [
    { fields: ['quotation_id'] },
    { fields: ['product_id'] },
  ],
});

module.exports = QuotationItem;
