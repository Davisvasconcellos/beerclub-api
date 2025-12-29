'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('fin_accounts_payable', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        id_code: { type: Sequelize.CHAR(36), allowNull: false, unique: true, defaultValue: Sequelize.literal('UUID()') },
        store_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        vendor_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fin_vendors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
        invoice_number: { type: Sequelize.STRING(64), allowNull: false },
        description: { type: Sequelize.TEXT },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        currency: { type: Sequelize.CHAR(3), defaultValue: 'BRL' },
        issue_date: { type: Sequelize.DATEONLY },
        due_date: { type: Sequelize.DATEONLY, allowNull: false },
        paid_at: { type: Sequelize.DATE },
        status: { type: Sequelize.ENUM('pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'), defaultValue: 'pending' },
        category: { type: Sequelize.STRING(64) },
        cost_center: { type: Sequelize.STRING(64) },
        created_by: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
        approved_by: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
        attachment_url: { type: Sequelize.STRING(500) },
        created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addConstraint('fin_accounts_payable', { fields: ['vendor_id', 'invoice_number'], type: 'unique', name: 'unique_vendor_invoice' }, { transaction: t });

      await queryInterface.addIndex('fin_accounts_payable', ['store_id'], { transaction: t });
      await queryInterface.addIndex('fin_accounts_payable', ['vendor_id'], { transaction: t });
      await queryInterface.addIndex('fin_accounts_payable', ['status'], { transaction: t });
      await queryInterface.addIndex('fin_accounts_payable', ['due_date'], { transaction: t });
      await queryInterface.addIndex('fin_accounts_payable', ['id_code'], { transaction: t });
      await queryInterface.addIndex('fin_accounts_payable', ['paid_at'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('fin_accounts_payable');
  }
};

