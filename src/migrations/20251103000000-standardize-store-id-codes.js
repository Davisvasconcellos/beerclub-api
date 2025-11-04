'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Buscar todas as lojas existentes.
      const stores = await queryInterface.sequelize.query(
        'SELECT id FROM stores',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      // 2. Para cada loja, gerar um novo UUID v4 e atualizar o id_code.
      for (const store of stores) {
        const new_id_code = uuidv4();
        await queryInterface.sequelize.query(
          `UPDATE stores SET id_code = '${new_id_code}' WHERE id = ${store.id}`,
          { transaction }
        );
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    // Esta migração é destrutiva para os id_codes antigos. A reversão não restaurará os valores.
    console.log('A reversão desta migração não restaurará os id_codes antigos.');
    return Promise.resolve();
  }
};