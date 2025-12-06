'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('contasap_payments', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        payable_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'contasap_payables', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        paid_at: { type: Sequelize.DATE, allowNull: false },
        method: { type: Sequelize.ENUM('pix','bank_transfer','cash','card'), allowNull: false },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_by_user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addIndex('contasap_payments', ['payable_id'], { transaction: t });
      await queryInterface.addIndex('contasap_payments', ['paid_at'], { transaction: t });
      await queryInterface.addIndex('contasap_payments', ['created_by_user_id'], { transaction: t });
      await queryInterface.addIndex('contasap_payments', ['payable_id','paid_at'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('contasap_payments');
  }
};

