'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Adicionar a coluna, permitindo nulos temporariamente
      await queryInterface.addColumn('stores', 'id_code', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      }, { transaction });

      // 2. Popular o id_code para as lojas existentes
      const stores = await queryInterface.sequelize.query(
        'SELECT id FROM stores WHERE id_code IS NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      for (const store of stores) {
        const id_code = `${Date.now()}${store.id}`;
        await queryInterface.sequelize.query(
          `UPDATE stores SET id_code = '${id_code}' WHERE id = ${store.id}`,
          { transaction }
        );
      }

      // 3. Alterar a coluna para não permitir mais nulos
      await queryInterface.changeColumn('stores', 'id_code', {
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
    await queryInterface.removeColumn('stores', 'id_code');
  }
};