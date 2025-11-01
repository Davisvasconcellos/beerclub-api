const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StoreSchedule = sequelize.define('StoreSchedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  store_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    }
  },
  day_of_week: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '0: Domingo, 1: Segunda, ..., 6: Sábado'
  },
  opening_time: {
    type: DataTypes.TIME,
    allowNull: true
  },
  closing_time: {
    type: DataTypes.TIME,
    allowNull: true
  },
  is_open: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'store_schedules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = StoreSchedule;