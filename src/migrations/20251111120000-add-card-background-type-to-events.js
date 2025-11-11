"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('events', 'card_background_type', {
      type: Sequelize.TINYINT,
      allowNull: true,
      comment: '0=cores (gradient), 1=imagem'
    });

    // Backfill: inferir tipo com base nos campos atuais
    // 1 para imagem se card_background não for nulo; 0 para cores se color_1 ou color_2 tiver valor; senão null
    const [results] = await queryInterface.sequelize.query(
      "SELECT id, card_background, color_1, color_2 FROM events"
    );

    for (const row of results) {
      let type = null;
      if (row.card_background) {
        type = 1;
      } else if (row.color_1 || row.color_2) {
        type = 0;
      }
      await queryInterface.sequelize.query(
        "UPDATE events SET card_background_type = :type WHERE id = :id",
        { replacements: { type, id: row.id } }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('events', 'card_background_type');
  }
};