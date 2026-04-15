const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  warehouse_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Nullable for single-warehouse setups',
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'inventory',
  indexes: [
    { unique: true, fields: ['product_id', 'warehouse_id'] },
    { fields: ['product_id'] },
  ],
});

module.exports = Inventory;
