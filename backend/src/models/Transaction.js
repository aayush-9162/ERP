const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  account_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('DEBIT', 'CREDIT'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  reference_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'sale, purchase, payment, supplier_payment, manual',
  },
  reference_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'transactions',
  indexes: [
    { fields: ['account_id'] },
    { fields: ['reference_type', 'reference_id'] },
    { fields: ['created_at'] },
  ],
});

module.exports = Transaction;
