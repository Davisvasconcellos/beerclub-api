const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StoreUser = sequelize.define('StoreUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'waiter'),
    allowNull: false
  }
}, {
  tableName: 'store_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = StoreUser; 