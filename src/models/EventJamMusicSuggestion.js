const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventJamMusicSuggestion = sequelize.define('EventJamMusicSuggestion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_code: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  song_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  artist_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  created_by_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'),
    allowNull: false,
    defaultValue: 'DRAFT'
  }
}, {
  tableName: 'event_jam_music_suggestions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EventJamMusicSuggestion;
