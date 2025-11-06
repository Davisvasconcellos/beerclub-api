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
    type: DataTypes.STRING(8),
    allowNull: false,
    unique: true
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
  timestamps: false
});

module.exports = EventResponse;