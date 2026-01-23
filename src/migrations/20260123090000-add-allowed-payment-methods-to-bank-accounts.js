'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('fin_bank_accounts', 'allowed_payment_methods', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'List of allowed payment methods for this account (e.g., ["pix", "checking"])'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('fin_bank_accounts', 'allowed_payment_methods');
  }
};
