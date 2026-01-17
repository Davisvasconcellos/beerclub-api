'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('financial_transactions', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        id_code: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true
        },
        type: {
          type: Sequelize.ENUM('PAYABLE', 'RECEIVABLE', 'TRANSFER', 'ADJUSTMENT'),
          allowNull: false
        },
        nf: {
          type: Sequelize.STRING(64),
          allowNull: true
        },
        description: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        currency: {
          type: Sequelize.STRING(3),
          allowNull: false,
          defaultValue: 'BRL'
        },
        due_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        paid_at: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        party_id: {
          type: Sequelize.STRING(64),
          allowNull: true
        },
        cost_center: {
          type: Sequelize.STRING(64),
          allowNull: true
        },
        category: {
          type: Sequelize.STRING(64),
          allowNull: true
        },
        is_paid: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'),
          allowNull: false,
          defaultValue: 'pending'
        },
        payment_method: {
          type: Sequelize.ENUM('cash', 'pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto'),
          allowNull: true
        },
        bank_account_id: {
          type: Sequelize.STRING(64),
          allowNull: true
        },
        attachment_url: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        created_by_user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
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

      await queryInterface.addIndex('financial_transactions', ['status'], { transaction });
      await queryInterface.addIndex('financial_transactions', ['due_date'], { transaction });
      await queryInterface.addIndex('financial_transactions', ['type'], { transaction });
      await queryInterface.addIndex('financial_transactions', ['created_by_user_id'], { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('financial_transactions', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_financial_transactions_type";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_financial_transactions_status";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_financial_transactions_payment_method";', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};

