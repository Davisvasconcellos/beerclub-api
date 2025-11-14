const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventGuest = sequelize.define('EventGuest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  guest_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  guest_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  guest_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  guest_document_type: {
    type: DataTypes.ENUM('rg', 'cpf', 'passport'),
    allowNull: true
  },
  guest_document_number: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('normal', 'vip', 'premium'),
    allowNull: false,
    defaultValue: 'normal'
  },
  source: {
    type: DataTypes.ENUM('invited', 'walk_in'),
    allowNull: false,
    defaultValue: 'invited'
  },
  rsvp_confirmed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  rsvp_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  invited_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  invited_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  check_in_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  check_in_method: {
    type: DataTypes.ENUM('google', 'staff_manual', 'invited_qr', 'auto_checkin'),
    allowNull: true
  },
  authorized_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'event_guests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Normalização de email: garantir lowercase e remover espaços
EventGuest.addHook('beforeCreate', (guest) => {
  if (guest.guest_email && typeof guest.guest_email === 'string') {
    guest.guest_email = guest.guest_email.trim().toLowerCase();
  }
});

EventGuest.addHook('beforeUpdate', (guest) => {
  if (guest.guest_email && typeof guest.guest_email === 'string') {
    guest.guest_email = guest.guest_email.trim().toLowerCase();
  }
});

// Suporte a operações em lote (bulkCreate/bulkUpdate)
EventGuest.addHook('beforeBulkCreate', (instances) => {
  if (Array.isArray(instances)) {
    for (const inst of instances) {
      if (inst.guest_email && typeof inst.guest_email === 'string') {
        inst.guest_email = inst.guest_email.trim().toLowerCase();
      }
    }
  }
});

EventGuest.addHook('beforeBulkUpdate', (options) => {
  if (options && options.attributes && typeof options.attributes.guest_email === 'string') {
    options.attributes.guest_email = options.attributes.guest_email.trim().toLowerCase();
  }
});

module.exports = EventGuest;