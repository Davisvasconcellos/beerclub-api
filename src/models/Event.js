const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  banner_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  start_datetime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_datetime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  public_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  gallery_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  place: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  resp_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  resp_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  resp_phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  color_1: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  color_2: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  card_background: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at',
  hooks: {
    beforeValidate: (event) => {
      if (!event.id_code) {
        event.id_code = uuidv4();
      }
    }
  }
});

module.exports = Event;