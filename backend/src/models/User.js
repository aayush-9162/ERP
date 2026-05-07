const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_super_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Platform-level super admin (SaaS owner)',
  },
  must_change_password: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Force password change on next login (set after admin reset / invite)',
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Which tenant this user belongs to (null for super admin)',
  },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 12);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

// Instance method to verify password
User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Strip password from JSON output
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
