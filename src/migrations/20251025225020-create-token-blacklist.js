'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('token_blacklist', {
      token: {
        type: Sequelize.STRING(500),
        allowNull: false,
        primaryKey: true,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('token_blacklist');
  }
};
