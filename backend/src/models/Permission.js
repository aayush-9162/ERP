const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  module: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'ERP module this permission belongs to (e.g. users, company, inventory)',
  },
}, {
  tableName: 'permissions',
});

module.exports = Permission;
