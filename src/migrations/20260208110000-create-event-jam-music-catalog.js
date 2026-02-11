'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('event_jam_music_catalog', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id_code: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        unique: true
      },
      discogs_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true
      },
      spotify_id: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      artist: {
        type: Sequelize.STRING,
        allowNull: false
      },
      album: {
        type: Sequelize.STRING,
        allowNull: true
      },
      year: {
        type: Sequelize.STRING,
        allowNull: true
      },
      genre: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cover_image: {
        type: Sequelize.STRING,
        allowNull: true
      },
      thumb_image: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lyrics: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      chords: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      bpm: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      key: {
        type: Sequelize.STRING,
        allowNull: true
      },
      extra_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      usage_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Indexes for performance
    await queryInterface.addIndex('event_jam_music_catalog', ['id_code']);
    await queryInterface.addIndex('event_jam_music_catalog', ['discogs_id']);
    await queryInterface.addIndex('event_jam_music_catalog', ['title']);
    await queryInterface.addIndex('event_jam_music_catalog', ['artist']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('event_jam_music_catalog');
  }
};
