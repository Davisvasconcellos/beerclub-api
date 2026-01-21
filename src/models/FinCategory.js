const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const FinCategory = sequelize.define('FinCategory', {
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
  type: {
    type: DataTypes.ENUM('payable', 'receivable'),
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'fin_categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (instance) => {
      if (!instance.id_code) {
        instance.id_code = `cat-${uuidv4()}`;
      }
    }
  }
});

module.exports = FinCategory;
