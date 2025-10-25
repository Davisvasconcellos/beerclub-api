const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TokenBlocklist = sequelize.define('TokenBlocklist', {
  token: {
    type: DataTypes.STRING(500),
    allowNull: false,
    primaryKey: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expiresAt' // Mapeia para a coluna 'expiresAt' no banco de dados
  }
}, {
  tableName: 'token_blacklist',
  timestamps: false,
});

module.exports = TokenBlocklist;