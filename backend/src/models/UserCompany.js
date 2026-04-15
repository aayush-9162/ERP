const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserCompany = sequelize.define('UserCompany', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Role within this company',
  },
  status: {
    type: DataTypes.ENUM('active', 'invited', 'removed'),
    defaultValue: 'active',
  },
}, {
  tableName: 'user_companies',
  indexes: [
    { unique: true, fields: ['user_id', 'company_id'] },
    { fields: ['company_id'] },
  ],
});

module.exports = UserCompany;
