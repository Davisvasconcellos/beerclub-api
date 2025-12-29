'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('fin_payments', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        payable_id: { type: Sequelize.INTEGER, references: { model: 'fin_accounts_payable', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        receivable_id: { type: Sequelize.INTEGER, references: { model: 'fin_accounts_receivable', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        paid_at: { type: Sequelize.DATE, allowNull: false },
        method: { type: Sequelize.ENUM('pix', 'bank_transfer', 'cash', 'card', 'deposit'), allowNull: false },
        notes: { type: Sequelize.TEXT },
        created_by: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
        created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addIndex('fin_payments', ['payable_id'], { transaction: t });
      await queryInterface.addIndex('fin_payments', ['receivable_id'], { transaction: t });
      await queryInterface.addIndex('fin_payments', ['paid_at'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('fin_payments');
  }
};

