'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Rename bank_accounts to fin_bank_accounts
      await queryInterface.renameTable('bank_accounts', 'fin_bank_accounts', { transaction });
      
      // Rename financial_transactions to fin_transactions
      await queryInterface.renameTable('financial_transactions', 'fin_transactions', { transaction });
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Revert renames
      await queryInterface.renameTable('fin_bank_accounts', 'bank_accounts', { transaction });
      await queryInterface.renameTable('fin_transactions', 'financial_transactions', { transaction });
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
