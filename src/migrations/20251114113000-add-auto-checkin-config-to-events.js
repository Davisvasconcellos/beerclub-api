'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adiciona campos de configuração de auto check-in ao evento
    await queryInterface.addColumn('events', 'requires_auto_checkin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('events', 'auto_checkin_flow_quest', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('events', 'checkin_component_config', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('events', 'requires_auto_checkin');
    await queryInterface.removeColumn('events', 'auto_checkin_flow_quest');
    await queryInterface.removeColumn('events', 'checkin_component_config');
  }
};