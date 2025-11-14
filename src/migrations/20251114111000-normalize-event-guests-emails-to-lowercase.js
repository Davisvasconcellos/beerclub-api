'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Normaliza emails existentes para lowercase e remove espaços
    await queryInterface.sequelize.query(
      "UPDATE event_guests SET guest_email = LOWER(TRIM(guest_email)) WHERE guest_email IS NOT NULL"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Não é possível reverter para o case original de forma confiável
    // Operação de rollback intencionalmente vazia
  }
};