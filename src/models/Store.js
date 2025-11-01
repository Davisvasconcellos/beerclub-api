const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Store = sequelize.define('Store', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_code: {
    type: DataTypes.STRING(255),
    allowNull: true, // Permitir nulo temporariamente para o hook funcionar
    unique: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('bar', 'restaurante', 'pub', 'cervejaria', 'casa noturna'),
    allowNull: true
  },
  legal_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  zip_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  address_street: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address_neighborhood: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address_state: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  address_number: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  address_complement: {
    type: DataTypes.STRING,
    allowNull: true
  },
  banner_url: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  cnpj: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  logo_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  instagram_handle: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  facebook_handle: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'stores',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  hooks: {
    beforeCreate: (store) => {
      store.id_code = uuidv4();
    }
  }
});

module.exports = Store; 