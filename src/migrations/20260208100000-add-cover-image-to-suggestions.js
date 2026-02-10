'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('event_jam_music_suggestions', 'cover_image', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('event_jam_music_suggestions', 'extra_data', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('event_jam_music_suggestions', 'extra_data');
    await queryInterface.removeColumn('event_jam_music_suggestions', 'cover_image');
  }
};
