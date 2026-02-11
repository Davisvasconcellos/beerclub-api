const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventJamMusicCatalog = sequelize.define('EventJamMusicCatalog', {
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
  discogs_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  spotify_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  artist: {
    type: DataTypes.STRING,
    allowNull: false
  },
  album: DataTypes.STRING,
  year: DataTypes.STRING,
  genre: DataTypes.STRING,
  cover_image: DataTypes.STRING,
  thumb_image: DataTypes.STRING,
  lyrics: DataTypes.TEXT('long'),
  chords: DataTypes.TEXT('long'),
  bpm: DataTypes.INTEGER,
  key: DataTypes.STRING,
  extra_data: DataTypes.JSON,
  usage_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'event_jam_music_catalog',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EventJamMusicCatalog;
