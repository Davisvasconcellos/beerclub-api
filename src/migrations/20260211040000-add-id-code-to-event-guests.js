'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add id_code to event_guests
    await queryInterface.addColumn('event_guests', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: true, // Allow null initially to populate
      after: 'id'
    });

    // Populate existing records
    const guests = await queryInterface.sequelize.query(
      `SELECT id FROM event_guests`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const guest of guests) {
      await queryInterface.sequelize.query(
        `UPDATE event_guests SET id_code = '${uuidv4()}' WHERE id = ${guest.id}`
      );
    }

    // Change to not null and add unique constraint
    await queryInterface.changeColumn('event_guests', 'id_code', {
      type: Sequelize.STRING(36),
      allowNull: false,
      unique: true
    });
    
    await queryInterface.addIndex('event_guests', ['id_code'], {
      unique: true,
      name: 'event_guests_id_code_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('event_guests', 'event_guests_id_code_unique');
    await queryInterface.removeColumn('event_guests', 'id_code');
  }
};
