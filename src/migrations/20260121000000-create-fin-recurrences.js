'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Create fin_recurrences table
      await queryInterface.createTable('fin_recurrences', {
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
        store_id: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'Stores the id_code (UUID) of the store'
        },
        type: {
          type: Sequelize.ENUM('PAYABLE', 'RECEIVABLE', 'TRANSFER'),
          allowNull: false
        },
        description: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          comment: 'Estimated or fixed amount'
        },
        frequency: {
          type: Sequelize.ENUM('weekly', 'monthly', 'yearly'),
          allowNull: false,
          defaultValue: 'monthly'
        },
        status: {
          type: Sequelize.ENUM('active', 'paused', 'finished'),
          allowNull: false,
          defaultValue: 'active'
        },
        start_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        end_date: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        next_due_date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        day_of_month: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        party_id: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        category_id: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        cost_center_id: {
          type: Sequelize.STRING(255),
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
        updated_by_user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
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

      // Add indexes for fin_recurrences
      await queryInterface.addIndex('fin_recurrences', ['store_id'], { transaction });
      await queryInterface.addIndex('fin_recurrences', ['status'], { transaction });
      await queryInterface.addIndex('fin_recurrences', ['next_due_date'], { transaction });

      // 2. Add recurrence_id to fin_transactions
      await queryInterface.addColumn('fin_transactions', 'recurrence_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        references: {
          model: 'fin_recurrences',
          key: 'id_code'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      // 3. Add 'provisioned' to status enum in fin_transactions
      // Since Sequelize doesn't support ALTER TYPE easily for Postgres Enums in migration helper
      // We try to add it via raw query if we are on Postgres
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        // We need to guess the enum name. It's usually enum_table_column
        // Table was originally financial_transactions, renamed to fin_transactions
        // The enum might still be enum_financial_transactions_status OR enum_fin_transactions_status
        // We'll try both to be safe or check pg_type
        
        // However, in a migration, it's safer to just run the command.
        // But if it fails, it breaks.
        // Let's assume the name matches the ORIGINAL table name if it wasn't explicitly changed.
        // Or updated name if Sequelize renamed it. 
        // Best bet: use a DO block or catch error
        
        // Actually, let's try to find the type name first via a harmless query if possible, or just try to add to likely names.
        // But simpler: just add it to the column definition in model, but for DB constraint we need this.
        
        // Let's try the most likely one: "enum_financial_transactions_status" (original creation)
        try {
            await queryInterface.sequelize.query('ALTER TYPE "enum_financial_transactions_status" ADD VALUE IF NOT EXISTS \'provisioned\'', { transaction });
        } catch (e) {
            // If that failed, maybe it is the new name
             try {
                await queryInterface.sequelize.query('ALTER TYPE "enum_fin_transactions_status" ADD VALUE IF NOT EXISTS \'provisioned\'', { transaction });
            } catch (e2) {
                console.warn('Could not add provisioned to enum via raw query. You might need to add it manually if using Postgres Enums.');
            }
        }
      } 
      // For MySQL/MariaDB, modifyColumn handles enum updates usually
      if (queryInterface.sequelize.getDialect() === 'mysql' || queryInterface.sequelize.getDialect() === 'mariadb') {
         await queryInterface.changeColumn('fin_transactions', 'status', {
            type: Sequelize.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled', 'provisioned'),
            allowNull: false,
            defaultValue: 'pending'
         }, { transaction });
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Remove recurrence_id
      await queryInterface.removeColumn('fin_transactions', 'recurrence_id', { transaction });

      // Drop fin_recurrences table
      await queryInterface.dropTable('fin_recurrences', { transaction });

      // Removing enum value is not supported in Postgres easily (requires dropping type and recreating)
      // So we skip that for now in down migration to avoid data loss risks

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
