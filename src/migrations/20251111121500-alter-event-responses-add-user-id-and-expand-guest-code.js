'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1) Remover índice único atual de guest_code (nome pode variar)
    const indexes = await queryInterface.showIndex('event_responses');
    const guestUnique = indexes.find(idx => idx.unique && idx.fields && idx.fields.length === 1 && idx.fields[0].attribute === 'guest_code');
    if (guestUnique) {
      await queryInterface.removeIndex('event_responses', guestUnique.name);
    }

    // 2) Expandir guest_code para suportar id_code (UUID)
    await queryInterface.changeColumn('event_responses', 'guest_code', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Pode ser um código curto ou o id_code (UUID) do usuário'
    });

    // 3) Adicionar user_id (nullable) para vincular resposta ao usuário autenticado
    await queryInterface.addColumn('event_responses', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Usuário autenticado autor da resposta, quando aplicável'
    });

    // 4) Índices únicos por evento
    await queryInterface.addIndex('event_responses', ['event_id', 'guest_code'], {
      unique: true,
      name: 'uniq_event_guest_code'
    });
    await queryInterface.addIndex('event_responses', ['event_id', 'user_id'], {
      unique: true,
      name: 'uniq_event_user'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remover novos índices
    await queryInterface.removeIndex('event_responses', 'uniq_event_guest_code');
    await queryInterface.removeIndex('event_responses', 'uniq_event_user');

    // Remover user_id
    await queryInterface.removeColumn('event_responses', 'user_id');

    // Voltar guest_code para tamanho original e índice único simples
    await queryInterface.changeColumn('event_responses', 'guest_code', {
      type: Sequelize.STRING(8),
      allowNull: false
    });

    await queryInterface.addIndex('event_responses', ['guest_code'], {
      unique: true,
      name: 'event_responses_guest_code_unique'
    });
  }
};