const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinPayment = sequelize.define('FinPayment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payable_id: { type: DataTypes.INTEGER, allowNull: true },
  receivable_id: { type: DataTypes.INTEGER, allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paid_at: { type: DataTypes.DATE, allowNull: false },
  method: { type: DataTypes.ENUM('pix', 'bank_transfer', 'cash', 'card', 'deposit'), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'fin_payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = FinPayment;

