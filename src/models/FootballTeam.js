const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FootballTeam = sequelize.define('FootballTeam', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  short_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  abbreviation: {
    type: DataTypes.CHAR(3),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  shield: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  }
}, {
  tableName: 'football_teams',
  timestamps: false
});

module.exports = FootballTeam;