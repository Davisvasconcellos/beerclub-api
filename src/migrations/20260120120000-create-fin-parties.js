'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('fin_parties', {
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
      store_id: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      trade_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      document: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      mobile: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      is_customer: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_supplier: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_employee: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_salesperson: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      zip_code: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      address_street: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      address_complement: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address_neighborhood: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address_city: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address_state: {
        type: Sequelize.STRING(2),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'blocked'),
        defaultValue: 'active'
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

    // Add index on store_id and id_code
    await queryInterface.addIndex('fin_parties', ['store_id']);
    await queryInterface.addIndex('fin_parties', ['id_code']);
    await queryInterface.addIndex('fin_parties', ['document']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('fin_parties');
  }
};
