'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('fin_transactions');
    
    if (!tableInfo.party_id) {
      await queryInterface.addColumn('fin_transactions', 'party_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
      await queryInterface.addIndex('fin_transactions', ['party_id']);
    } else {
      // If exists but is small, change it
      await queryInterface.changeColumn('fin_transactions', 'party_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // We don't really want to drop it as it might lose data, 
    // but strictly speaking down should reverse up.
    // If we added it, we remove it. If we changed it, we revert size.
    // For safety, let's just leave it or revert to 64 if that was the state.
    // Let's assume we keep it.
  }
};
