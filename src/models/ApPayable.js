const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const ApPayable = sequelize.define('ApPayable', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_code: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  store_id: { type: DataTypes.INTEGER, allowNull: false },
  vendor_id: { type: DataTypes.INTEGER, allowNull: false },
  invoice_number: { type: DataTypes.STRING(64), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  amount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BRL' },
  issue_date: { type: DataTypes.DATEONLY, allowNull: true },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  paid_at: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('pending','approved','scheduled','paid','overdue','canceled'), allowNull: false, defaultValue: 'pending' },
  category: { type: DataTypes.STRING(64), allowNull: true },
  cost_center: { type: DataTypes.STRING(64), allowNull: true },
  created_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
  approved_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  attachment_url: { type: DataTypes.STRING(500), allowNull: true },
  conciliated_by: { type: DataTypes.ENUM('system','manual','gpt'), allowNull: true },
  conciliated_at: { type: DataTypes.DATE, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'contasap_payables',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (p) => { p.id_code = uuidv4(); }
  }
});

module.exports = ApPayable;

