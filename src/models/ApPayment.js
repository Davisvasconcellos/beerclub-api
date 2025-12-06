const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ApPayment = sequelize.define('ApPayment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payable_id: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  paid_at: { type: DataTypes.DATE, allowNull: false },
  method: { type: DataTypes.ENUM('pix','bank_transfer','cash','card'), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  created_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'contasap_payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ApPayment;

