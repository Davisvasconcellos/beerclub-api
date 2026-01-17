'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('financial_transactions', 'store_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Stores the id_code (UUID) of the store'
    });

    await queryInterface.addColumn('financial_transactions', 'approved_by', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Stores the id_code (UUID) of the user who approved'
    });

    // Add indices for performance
    await queryInterface.addIndex('financial_transactions', ['store_id']);
    await queryInterface.addIndex('financial_transactions', ['approved_by']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('financial_transactions', 'approved_by');
    await queryInterface.removeColumn('financial_transactions', 'store_id');
  }
};
