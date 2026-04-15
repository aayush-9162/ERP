const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExchangeRate = sequelize.define('ExchangeRate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  from_currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
  },
  to_currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
  },
  rate: {
    type: DataTypes.DECIMAL(14, 6),
    allowNull: false,
    comment: '1 unit of from_currency = rate units of to_currency',
  },
}, {
  tableName: 'exchange_rates',
  indexes: [
    { unique: true, fields: ['from_currency', 'to_currency'] },
  ],
});

module.exports = ExchangeRate;
