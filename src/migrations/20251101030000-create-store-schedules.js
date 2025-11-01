'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable('store_schedules', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        store_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'stores', // Nome da tabela de referência
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE' // Se a loja for deletada, seus horários também serão.
        },
        day_of_week: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: '0: Domingo, 1: Segunda, ..., 6: Sábado'
        },
        opening_time: {
          type: Sequelize.TIME,
          allowNull: true
        },
        closing_time: {
          type: Sequelize.TIME,
          allowNull: true
        },
        is_open: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction: t });

      await queryInterface.addIndex('store_schedules', ['store_id', 'day_of_week'], {
        unique: true,
        name: 'store_schedules_unique_store_day'
      }, { transaction: t });
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('store_schedules');
  }
};