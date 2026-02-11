const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Adicionar coluna id_code
    await queryInterface.addColumn('event_jams', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: true, // Inicialmente null para preencher
      after: 'id'
    });

    // 2. Preencher id_code para registros existentes
    const jams = await queryInterface.sequelize.query(
      `SELECT id FROM event_jams`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const jam of jams) {
      await queryInterface.sequelize.query(
        `UPDATE event_jams SET id_code = '${uuidv4()}' WHERE id = ${jam.id}`
      );
    }

    // 3. Alterar para não nulo e único
    await queryInterface.changeColumn('event_jams', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: false,
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('event_jams', 'id_code');
  }
};
