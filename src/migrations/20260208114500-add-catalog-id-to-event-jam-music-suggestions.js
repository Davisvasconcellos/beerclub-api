'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('event_jam_music_suggestions', 'catalog_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'event_jam_music_catalog',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('event_jam_music_suggestions', 'catalog_id');
  }
};
