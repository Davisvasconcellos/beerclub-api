const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventAnswer = sequelize.define('EventAnswer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  response_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'event_responses',
      key: 'id'
    }
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'event_questions',
      key: 'id'
    }
  },
  answer_text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  answer_json: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'event_answers',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['response_id', 'question_id'],
      name: 'uniq_response_question'
    }
  ]
});

module.exports = EventAnswer;