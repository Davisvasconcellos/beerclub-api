'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Adiciona a coluna google_uid via SQL direto para máxima compatibilidade
      await queryInterface.sequelize.query(
        'ALTER TABLE users ADD COLUMN google_uid VARCHAR(255) UNIQUE',
        { transaction }
      );

      // Backfill: copiar valores existentes de google_id para google_uid
      await queryInterface.sequelize.query(
        'UPDATE users SET google_uid = google_id WHERE google_uid IS NULL AND google_id IS NOT NULL',
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('ALTER TABLE users DROP COLUMN google_uid');
  }
};