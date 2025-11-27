const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventJamSongRating = sequelize.define('EventJamSongRating', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  jam_song_id: { type: DataTypes.INTEGER, allowNull: false },
  event_guest_id: { type: DataTypes.INTEGER, allowNull: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
  stars: { type: DataTypes.INTEGER, allowNull: false },
  rated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'event_jam_song_ratings',
  timestamps: false
});

module.exports = EventJamSongRating;

