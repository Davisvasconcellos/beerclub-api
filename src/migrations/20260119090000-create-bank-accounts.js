'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_accounts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id_code: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Nome de identificação da conta (ex: Conta Principal)'
      },
      bank_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bank_code: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      agency: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      account_number: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      account_digit: {
        type: Sequelize.STRING(5),
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('checking', 'savings', 'investment', 'payment', 'other'),
        allowNull: false,
        defaultValue: 'checking'
      },
      initial_balance: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      store_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Stores the id_code (UUID) of the store'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('bank_accounts', ['id_code']);
    await queryInterface.addIndex('bank_accounts', ['store_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_accounts');
  }
};
