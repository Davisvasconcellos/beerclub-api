'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('event_guests', 'selfie_url', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('event_guests', 'selfie_url');
  }
};
