const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventQuestion = sequelize.define('EventQuestion', {
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
  question_text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  question_type: {
    type: DataTypes.ENUM('text', 'textarea', 'radio', 'checkbox', 'rating', 'music_preference', 'auto_checkin'),
    allowNull: false,
    defaultValue: 'text'
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true
  },
  max_choices: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  correct_option_index: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  show_results: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  order_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'event_questions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = EventQuestion;