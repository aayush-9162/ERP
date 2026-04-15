const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quotation = sequelize.define('Quotation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  quotation_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
  status: {
    type: DataTypes.ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'),
    allowNull: false,
    defaultValue: 'DRAFT',
  },
  valid_until: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  converted_sale_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Sale ID if converted',
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'quotations',
  indexes: [
    { unique: true, fields: ['quotation_number'] },
    { fields: ['customer_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
});

module.exports = Quotation;
