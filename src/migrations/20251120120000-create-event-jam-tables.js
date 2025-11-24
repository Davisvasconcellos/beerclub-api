'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('event_jams', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      event_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'events', key: 'id' }, onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM('active', 'finished', 'canceled'), allowNull: false, defaultValue: 'active' },
      order_index: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('event_jam_songs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      jam_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event_jams', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(255), allowNull: false },
      artist: { type: Sequelize.STRING(255), allowNull: true },
      key: { type: Sequelize.STRING(10), allowNull: true },
      tempo_bpm: { type: Sequelize.INTEGER, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      release_batch: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.ENUM('planned', 'open_for_candidates', 'on_stage', 'played', 'canceled'), allowNull: false, defaultValue: 'planned' },
      order_index: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('event_jam_song_instrument_slots', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      jam_song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event_jam_songs', key: 'id' }, onDelete: 'CASCADE' },
      instrument: { type: Sequelize.ENUM('guitar','bass','drums','keys','vocals','horns','percussion','strings','other'), allowNull: false },
      slots: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      fallback_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('event_jam_song_candidates', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      jam_song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event_jam_songs', key: 'id' }, onDelete: 'CASCADE' },
      instrument: { type: Sequelize.ENUM('guitar','bass','drums','keys','vocals','horns','percussion','strings','other'), allowNull: false },
      event_guest_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event_guests', key: 'id' }, onDelete: 'CASCADE' },
      status: { type: Sequelize.ENUM('pending','approved','rejected'), allowNull: false, defaultValue: 'pending' },
      applied_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      approved_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } }
    });
    await queryInterface.addConstraint('event_jam_song_candidates', { fields: ['jam_song_id','instrument','event_guest_id'], type: 'unique', name: 'uniq_jam_song_instrument_candidate' });

    await queryInterface.createTable('event_jam_song_ratings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      jam_song_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'event_jam_songs', key: 'id' }, onDelete: 'CASCADE' },
      event_guest_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'event_guests', key: 'id' }, onDelete: 'SET NULL' },
      user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      stars: { type: Sequelize.INTEGER, allowNull: false },
      rated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addConstraint('event_jam_song_ratings', { fields: ['jam_song_id','event_guest_id'], type: 'unique', name: 'uniq_jam_song_rating_by_guest' });
    await queryInterface.addConstraint('event_jam_song_ratings', { fields: ['jam_song_id','user_id'], type: 'unique', name: 'uniq_jam_song_rating_by_user' });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('event_jam_song_ratings');
    await queryInterface.dropTable('event_jam_song_candidates');
    await queryInterface.dropTable('event_jam_song_instrument_slots');
    await queryInterface.dropTable('event_jam_songs');
    await queryInterface.dropTable('event_jams');
  }
};