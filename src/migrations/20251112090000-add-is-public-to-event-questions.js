'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adicionar coluna is_public às perguntas do evento
    await queryInterface.addColumn('event_questions', 'is_public', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Define se a pergunta é visível/respondível para usuários não autenticados'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remover coluna is_public
    await queryInterface.removeColumn('event_questions', 'is_public');
  }
};