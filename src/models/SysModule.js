const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const SysModule = sequelize.define('SysModule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  id_code: {
    type: DataTypes.STRING(36),
    allowNull: false,
    unique: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Identificador único para uso no código (ex: financial, events, pub)'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'sys_modules',
  underscored: true,
  timestamps: true,
  hooks: {
    beforeValidate: (instance) => {
      if (!instance.id_code) {
        instance.id_code = uuidv4();
      }
    }
  }
});

SysModule.associate = (models) => {
  SysModule.belongsToMany(models.User, { 
    foreignKey: 'module_id', 
    through: 'sys_user_modules', 
    as: 'users' 
  });
};

module.exports = SysModule;