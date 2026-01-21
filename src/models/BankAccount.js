const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const BankAccount = sequelize.define('BankAccount', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nome de identificação da conta (ex: Conta Principal)'
  },
  bank_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  bank_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  agency: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  account_number: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  account_digit: {
    type: DataTypes.STRING(5),
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('checking', 'savings', 'investment', 'payment', 'other'),
    allowNull: false,
    defaultValue: 'checking'
  },
  initial_balance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  store_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Stores the id_code (UUID) of the store'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'fin_bank_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (account) => {
      if (!account.id_code) {
        account.id_code = `bk-${uuidv4()}`;
      }
    }
  }
});

module.exports = BankAccount;
