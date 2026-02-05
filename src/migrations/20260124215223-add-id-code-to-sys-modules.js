'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Adicionar coluna id_code permitindo NULL inicialmente
    await queryInterface.addColumn('sys_modules', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: true,
      unique: true,
      after: 'id'
    });

    // 2. Gerar UUIDs para os registros existentes
    const [modules] = await queryInterface.sequelize.query('SELECT id FROM sys_modules');
    for (const mod of modules) {
      await queryInterface.sequelize.query(
        `UPDATE sys_modules SET id_code = '${uuidv4()}' WHERE id = ${mod.id}`
      );
    }

    // 3. Alterar para NOT NULL após preencher
    await queryInterface.changeColumn('sys_modules', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: false,
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('sys_modules', 'id_code');
  }
};
