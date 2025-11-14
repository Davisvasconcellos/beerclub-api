'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // MySQL: alterar ENUM adicionando o novo valor auto_checkin
    // Mantém default 'text' e NOT NULL
    await queryInterface.sequelize.query(`
      ALTER TABLE \`event_questions\`
      MODIFY COLUMN \`question_type\` ENUM('text','textarea','radio','checkbox','rating','music_preference','auto_checkin')
      NOT NULL DEFAULT 'text'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Reverter para enum anterior sem auto_checkin
    await queryInterface.sequelize.query(`
      ALTER TABLE \`event_questions\`
      MODIFY COLUMN \`question_type\` ENUM('text','textarea','radio','checkbox','rating','music_preference')
      NOT NULL DEFAULT 'text'
    `);
  }
};