const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockMovement = sequelize.define('StockMovement', {
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
  },
  type: {
    type: DataTypes.ENUM('IN', 'OUT', 'ADJUSTMENT'),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Positive for IN/ADJUSTMENT-add, negative for OUT/ADJUSTMENT-subtract',
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'manual',
    comment: 'e.g. purchase, sale, manual, return',
  },
  notes: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'stock_movements',
  indexes: [
    { fields: ['product_id'] },
    { fields: ['type'] },
    { fields: ['created_at'] },
  ],
});

module.exports = StockMovement;
