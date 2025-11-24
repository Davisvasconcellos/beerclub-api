const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventJamSongInstrumentSlot = sequelize.define('EventJamSongInstrumentSlot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  jam_song_id: { type: DataTypes.INTEGER, allowNull: false },
  instrument: { type: DataTypes.ENUM('guitar','bass','drums','keys','vocals','horns','percussion','strings','other'), allowNull: false },
  slots: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  fallback_allowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'event_jam_song_instrument_slots',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = EventJamSongInstrumentSlot;