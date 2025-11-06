'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1) Adiciona coluna permitindo nulos temporariamente
      await queryInterface.addColumn('events', 'id_code', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      }, { transaction });

      // 2) Popular id_code com UUID v4 para registros existentes
      const events = await queryInterface.sequelize.query(
        'SELECT id FROM events WHERE id_code IS NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      for (const ev of events) {
        const code = uuidv4();
        await queryInterface.sequelize.query(
          `UPDATE events SET id_code = '${code}' WHERE id = ${ev.id}`,
          { transaction }
        );
      }

      // 3) Tornar coluna NOT NULL
      await queryInterface.changeColumn('events', 'id_code', {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('events', 'id_code');
  }
};