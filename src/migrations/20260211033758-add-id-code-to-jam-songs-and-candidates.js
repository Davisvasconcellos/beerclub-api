const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add id_code to event_jam_songs
    await queryInterface.addColumn('event_jam_songs', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: true,
      after: 'id'
    });

    // Populate event_jam_songs
    const songs = await queryInterface.sequelize.query(
      `SELECT id FROM event_jam_songs`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const song of songs) {
      await queryInterface.sequelize.query(
        `UPDATE event_jam_songs SET id_code = '${uuidv4()}' WHERE id = ${song.id}`
      );
    }

    await queryInterface.changeColumn('event_jam_songs', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: false,
      unique: true
    });

    // 2. Add id_code to event_jam_song_candidates
    await queryInterface.addColumn('event_jam_song_candidates', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: true,
      after: 'id'
    });

    // Populate event_jam_song_candidates
    const candidates = await queryInterface.sequelize.query(
      `SELECT id FROM event_jam_song_candidates`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const candidate of candidates) {
      await queryInterface.sequelize.query(
        `UPDATE event_jam_song_candidates SET id_code = '${uuidv4()}' WHERE id = ${candidate.id}`
      );
    }

    await queryInterface.changeColumn('event_jam_song_candidates', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: false,
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('event_jam_song_candidates', 'id_code');
    await queryInterface.removeColumn('event_jam_songs', 'id_code');
  }
};
