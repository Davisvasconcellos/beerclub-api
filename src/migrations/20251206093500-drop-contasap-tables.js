'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      // Drop in dependency order
      await queryInterface.dropTable('contasap_payments', { transaction: t });
      await queryInterface.dropTable('contasap_payables', { transaction: t });
      await queryInterface.dropTable('contasap_vendors', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
  down: async (queryInterface, Sequelize) => {
    // No-op: tables will be recreated by their respective create migrations if needed
  }
};

