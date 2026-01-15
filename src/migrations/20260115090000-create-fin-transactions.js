'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('fin_transactions', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        id_code: { type: Sequelize.CHAR(36), allowNull: false, unique: true, defaultValue: Sequelize.literal('UUID()') },
        store_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'stores', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        type: {
          type: Sequelize.ENUM('PAYABLE', 'RECEIVABLE', 'TRANSFER', 'ADJUSTMENT'),
          allowNull: false
        },
        nf: { type: Sequelize.STRING(64), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: false },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'BRL' },
        due_date: { type: Sequelize.DATEONLY, allowNull: false },
        paid_at: { type: Sequelize.DATEONLY, allowNull: true },
        party_id: { type: Sequelize.STRING(255), allowNull: true },
        cost_center: { type: Sequelize.STRING(64), allowNull: true },
        category: { type: Sequelize.STRING(64), allowNull: true },
        is_paid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        status: {
          type: Sequelize.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'),
          allowNull: false,
          defaultValue: 'pending'
        },
        payment_method: { type: Sequelize.STRING(32), allowNull: true },
        bank_account_id: { type: Sequelize.STRING(64), allowNull: true },
        attachment_url: { type: Sequelize.STRING(500), allowNull: true },
        issue_date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addIndex('fin_transactions', ['store_id'], { transaction: t });
      await queryInterface.addIndex('fin_transactions', ['type'], { transaction: t });
      await queryInterface.addIndex('fin_transactions', ['status'], { transaction: t });
      await queryInterface.addIndex('fin_transactions', ['due_date'], { transaction: t });
      await queryInterface.addIndex('fin_transactions', ['paid_at'], { transaction: t });
      await queryInterface.addIndex('fin_transactions', ['id_code'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('fin_transactions');
  }
};

