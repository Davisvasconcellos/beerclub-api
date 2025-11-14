'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE events SET resp_email = LOWER(TRIM(resp_email)) WHERE resp_email IS NOT NULL"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Não é possível reverter caso de forma confiável
  }
};