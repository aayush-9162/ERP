const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  method: {
    type: DataTypes.ENUM('CASH', 'UPI', 'CARD'),
    allowNull: false,
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Transaction ID / UPI ref / cheque no.',
  },
}, {
  tableName: 'payments',
  indexes: [
    { fields: ['sale_id'] },
  ],
});

module.exports = Payment;
