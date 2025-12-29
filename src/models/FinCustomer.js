const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinCustomer = sequelize.define('FinCustomer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_code: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  store_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  document: { type: DataTypes.STRING(32), allowNull: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(32), allowNull: true }
}, {
  tableName: 'fin_customers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = FinCustomer;

