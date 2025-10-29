const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
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
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  password: {
    type: DataTypes.VIRTUAL,
    set(value) {
      this.setDataValue('password_hash', value);
    }
  },
  role: {
    type: DataTypes.ENUM('master', 'admin', 'manager', 'waiter', 'customer'),
    allowNull: false,
    defaultValue: 'customer'
  },
  google_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  avatar_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  birth_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  address_street: {
    type: DataTypes.STRING,
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
  address_neighborhood: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address_city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address_state: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  address_zip_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending_verification', 'banned'),
    allowNull: false,
    defaultValue: 'active'
  },
  team_user: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'football_teams',
      key: 'id'
    }
  },
  plan_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'plans',
      key: 'id'
    }
  },
  plan_start: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  plan_end: {
    type: DataTypes.DATEONLY,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password_hash, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 12);
      }
    },
    afterCreate: async (user) => {
      const id_code = `${Date.now()}${user.id}`;
      await user.update({ id_code });
    }
  }
});

// Relação com football_teams
// A associação foi movida para src/models/index.js para evitar dependências circulares.

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password_hash;
  delete values.password; // Também remover o campo virtual
  return values;
};

// Class methods
User.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

User.findByRole = function(role) {
  return this.findAll({ where: { role } });
};

module.exports = User;
