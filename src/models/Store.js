const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid'); // Garante que o uuid está importado

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
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
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
  },
  instagram_handle: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  facebook_handle: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'stores',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  hooks: {
    beforeCreate: (store) => { // O hook beforeCreate garante que toda nova loja terá um id_code
      // Normalizar email
      if (store.email && typeof store.email === 'string') {
        store.email = store.email.trim().toLowerCase();
      }
      store.id_code = uuidv4();
    }
  }
});

// Suporte a operações em lote
Store.addHook('beforeBulkCreate', (instances) => {
  if (Array.isArray(instances)) {
    for (const inst of instances) {
      if (inst.email && typeof inst.email === 'string') {
        inst.email = inst.email.trim().toLowerCase();
      }
    }
  }
});

Store.addHook('beforeBulkUpdate', (options) => {
  if (options && options.attributes && typeof options.attributes.email === 'string') {
    options.attributes.email = options.attributes.email.trim().toLowerCase();
  }
});

module.exports = Store;