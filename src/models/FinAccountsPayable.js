const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinAccountsPayable = sequelize.define('FinAccountsPayable', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_code: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  store_id: { type: DataTypes.INTEGER, allowNull: false },
  vendor_id: { type: DataTypes.INTEGER, allowNull: false },
  invoice_number: { type: DataTypes.STRING(64), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.CHAR(3), allowNull: true, defaultValue: 'BRL' },
  issue_date: { type: DataTypes.DATEONLY, allowNull: true },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  paid_at: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'), allowNull: false, defaultValue: 'pending' },
  category: { type: DataTypes.STRING(64), allowNull: true },
  cost_center: { type: DataTypes.STRING(64), allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  approved_by: { type: DataTypes.INTEGER, allowNull: true },
  attachment_url: { type: DataTypes.STRING(500), allowNull: true }
}, {
  tableName: 'fin_accounts_payable',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = FinAccountsPayable;

