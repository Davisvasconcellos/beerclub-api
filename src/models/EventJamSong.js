const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventJamSong = sequelize.define('EventJamSong', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  jam_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(255), allowNull: false },
  artist: { type: DataTypes.STRING(255), allowNull: true },
  key: { type: DataTypes.STRING(10), allowNull: true },
  tempo_bpm: { type: DataTypes.INTEGER, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  release_batch: { type: DataTypes.INTEGER, allowNull: true },
  ready: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status: { type: DataTypes.ENUM('planned','open_for_candidates','on_stage','played','canceled'), allowNull: false, defaultValue: 'planned' },
  order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'event_jam_songs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EventJamSong;
