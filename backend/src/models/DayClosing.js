const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * End-of-day cash drawer reconciliation snapshot.
 * One row per (company_id, business_date). Captures sales/payment totals
 * for the day, expected vs counted cash, and a JSON breakdown by method.
 */
const DayClosing = sequelize.define('DayClosing', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id: { type: DataTypes.INTEGER, allowNull: true },
  business_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'The day being closed (YYYY-MM-DD)',
  },
  opening_cash: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Cash float at start of day',
  },
  expected_cash: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'opening_cash + cash receipts - cash payouts (computed at close)',
  },
  counted_cash: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Physical cash counted by user',
  },
  variance: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'counted_cash - expected_cash (negative = short, positive = over)',
  },
  total_sales_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_sales_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  total_purchases_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_purchases_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  total_received: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  total_paid:     { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  by_method: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Breakdown of received/paid by method, e.g. [{method, direction, amount}]',
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  closed_by: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'day_closings',
  indexes: [
    { unique: true, fields: ['company_id', 'business_date'] },
    { fields: ['business_date'] },
  ],
});

module.exports = DayClosing;
