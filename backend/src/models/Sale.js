const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  invoice_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Null for walk-in customers',
  },
  quotation_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'If converted from a quotation',
  },
  total_amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  },
  tax_amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discount_amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  },
  final_amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  },
  paid_amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
  },
  payment_status: {
    type: DataTypes.ENUM('PAID', 'PARTIAL', 'UNPAID'),
    allowNull: false,
    defaultValue: 'UNPAID',
  },
  payment_method: {
    type: DataTypes.ENUM('CASH', 'UPI', 'CARD', 'MIXED'),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // E-invoicing fields
  irn: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Invoice Reference Number from e-invoice portal',
  },
  qr_code: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'QR code data string from e-invoice',
  },
  e_invoice_status: {
    type: DataTypes.ENUM('PENDING', 'GENERATED', 'FAILED'),
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'sales',
  indexes: [
    { unique: true, fields: ['invoice_number'] },
    { fields: ['customer_id'] },
    { fields: ['payment_status'] },
    { fields: ['created_at'] },
    { fields: ['quotation_id'] },
  ],
});

module.exports = Sale;
