const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const ApVendor = sequelize.define('ApVendor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_code: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  store_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(255), allowNull: false },
  document: { type: DataTypes.STRING(32), allowNull: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(32), allowNull: true },
  bank_info: { type: DataTypes.JSON, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'contasap_vendors',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (vendor) => { vendor.id_code = uuidv4(); }
  }
});

module.exports = ApVendor;

