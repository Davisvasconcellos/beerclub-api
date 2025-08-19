const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PixPayment = sequelize.define('PixPayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id'
    }
  },
  external_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'invoice_id ou txid do PSP'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('created', 'pending', 'paid', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  received_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'pix_payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = PixPayment; 