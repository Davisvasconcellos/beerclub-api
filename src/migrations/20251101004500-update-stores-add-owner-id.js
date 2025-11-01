'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * A função 'up' é usada para aplicar a migração.
     * 1. Adiciona a coluna 'owner_id' como uma chave estrangeira para a tabela 'users'.
     * 2. Remove a antiga coluna 'legal_responsible'.
     */
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('stores', 'owner_id', {
        type: Sequelize.INTEGER,
        allowNull: true, // Permite nulo temporariamente para não quebrar dados existentes
        references: {
          model: 'users', // Nome da tabela de referência
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, { transaction });

      await queryInterface.removeColumn('stores', 'legal_responsible', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    // A função 'down' reverte a migração, recriando a coluna antiga e removendo a nova.
    await queryInterface.addColumn('stores', 'legal_responsible', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.removeColumn('stores', 'owner_id');
  }
};