"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('event_questions', 'max_choices', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'options'
    });

    await queryInterface.addColumn('event_questions', 'correct_option_index', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'max_choices'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('event_questions', 'correct_option_index');
    await queryInterface.removeColumn('event_questions', 'max_choices');
  }
};