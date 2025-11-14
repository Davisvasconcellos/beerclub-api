'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE stores SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Não é possível reverter caso de forma confiável
  }
};