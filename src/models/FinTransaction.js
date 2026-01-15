const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinTransaction = sequelize.define('FinTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_code: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  store_id: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('PAYABLE', 'RECEIVABLE', 'TRANSFER', 'ADJUSTMENT'), allowNull: false },
  nf: { type: DataTypes.STRING(64), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'BRL' },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  paid_at: { type: DataTypes.DATEONLY, allowNull: true },
  party_id: { type: DataTypes.STRING(255), allowNull: true },
  cost_center: { type: DataTypes.STRING(64), allowNull: true },
  category: { type: DataTypes.STRING(64), allowNull: true },
  is_paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'), allowNull: false, defaultValue: 'pending' },
  payment_method: { type: DataTypes.STRING(32), allowNull: true },
  bank_account_id: { type: DataTypes.STRING(64), allowNull: true },
  attachment_url: { type: DataTypes.STRING(500), allowNull: true },
  issue_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  created_by: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'fin_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = FinTransaction;

