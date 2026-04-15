const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Currency = sequelize.define('Currency', {
  code: {
    type: DataTypes.STRING(3),
    primaryKey: true,
    comment: 'ISO 4217: INR, USD, EUR, GBP',
  },
  symbol: {
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  decimal_places: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
}, {
  tableName: 'currencies',
  timestamps: false,
});

module.exports = Currency;
