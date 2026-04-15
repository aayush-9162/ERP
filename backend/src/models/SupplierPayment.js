const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SupplierPayment = sequelize.define('SupplierPayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  purchase_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  method: {
    type: DataTypes.ENUM('CASH', 'UPI', 'BANK'),
    allowNull: false,
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Cheque no / UTR / transaction ref',
  },
}, {
  tableName: 'supplier_payments',
  indexes: [
    { fields: ['purchase_id'] },
  ],
});

module.exports = SupplierPayment;
