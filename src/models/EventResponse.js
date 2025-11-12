const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventResponse = sequelize.define('EventResponse', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    }
  },
  guest_code: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  selfie_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'event_responses',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'guest_code'],
      name: 'uniq_event_guest_code'
    },
    {
      unique: true,
      fields: ['event_id', 'user_id'],
      name: 'uniq_event_user'
    }
  ]
});

module.exports = EventResponse;