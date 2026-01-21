const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Party = sequelize.define('Party', {
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
  store_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Stores the id_code (UUID) of the store'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  trade_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nome fantasia'
  },
  document: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'CPF ou CNPJ'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  mobile: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  // Roles flags
  is_customer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_supplier: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_employee: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_salesperson: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Address
  zip_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  address_street: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  address_number: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  address_complement: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  address_neighborhood: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  address_city: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  address_state: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  // Other info
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'blocked'),
    defaultValue: 'active'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'fin_parties',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (party) => {
      if (!party.id_code) {
        party.id_code = `pty-${uuidv4()}`;
      }
    }
  }
});

module.exports = Party;
