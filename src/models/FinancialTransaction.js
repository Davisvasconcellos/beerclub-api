const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const FinancialTransaction = sequelize.define('FinancialTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM('PAYABLE', 'RECEIVABLE', 'TRANSFER', 'ADJUSTMENT'),
    allowNull: false
  },
  nf: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'BRL'
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  paid_at: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  party_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  cost_center: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  is_paid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto'),
    allowNull: true
  },
  bank_account_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  attachment_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  store_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Stores the id_code (UUID) of the store'
  },
  approved_by: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Stores the id_code (UUID) of the user who approved'
  },
  created_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  is_deleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
}, {
  tableName: 'financial_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (transaction) => {
      if (!transaction.id_code) {
        transaction.id_code = `txn-${uuidv4()}`;
      }
    }
  }
});

module.exports = FinancialTransaction;
