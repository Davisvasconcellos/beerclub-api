'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Add FKs to fin_transactions
      await queryInterface.addColumn('fin_transactions', 'category_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      }, { transaction });
      
      await queryInterface.addColumn('fin_transactions', 'cost_center_id', {
        type: Sequelize.STRING(255),
        allowNull: true
      }, { transaction });

      await queryInterface.addIndex('fin_transactions', ['category_id'], { transaction });
      await queryInterface.addIndex('fin_transactions', ['cost_center_id'], { transaction });

      // Create pivot table for Tags
      await queryInterface.createTable('fin_transaction_tags', {
        transaction_id: {
          type: Sequelize.STRING(255),
          allowNull: false,
          references: {
            model: 'fin_transactions',
            key: 'id_code'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        tag_id: {
          type: Sequelize.STRING(255),
          allowNull: false,
          references: {
            model: 'fin_tags',
            key: 'id_code'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      }, { transaction });
      
      // Composite Primary Key
      await queryInterface.addConstraint('fin_transaction_tags', {
        fields: ['transaction_id', 'tag_id'],
        type: 'primary key',
        name: 'pk_fin_transaction_tags',
        transaction
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('fin_transaction_tags', { transaction });
      await queryInterface.removeColumn('fin_transactions', 'cost_center_id', { transaction });
      await queryInterface.removeColumn('fin_transactions', 'category_id', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
