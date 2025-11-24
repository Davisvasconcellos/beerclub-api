const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventJamSongCandidate = sequelize.define('EventJamSongCandidate', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  jam_song_id: { type: DataTypes.INTEGER, allowNull: false },
  instrument: { type: DataTypes.ENUM('guitar','bass','drums','keys','vocals','horns','percussion','strings','other'), allowNull: false },
  event_guest_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('pending','approved','rejected'), allowNull: false, defaultValue: 'pending' },
  applied_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  approved_at: { type: DataTypes.DATE, allowNull: true },
  approved_by_user_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'event_jam_song_candidates',
  timestamps: false
});

module.exports = EventJamSongCandidate;