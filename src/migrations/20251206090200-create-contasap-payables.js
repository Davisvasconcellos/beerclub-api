'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('contasap_payables', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        id_code: { type: Sequelize.CHAR(36), allowNull: false, unique: true },
        store_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'stores', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        vendor_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'contasap_vendors', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        invoice_number: { type: Sequelize.STRING(64), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'BRL' },
        issue_date: { type: Sequelize.DATEONLY, allowNull: true },
        due_date: { type: Sequelize.DATEONLY, allowNull: false },
        paid_at: { type: Sequelize.DATE, allowNull: true },
        status: {
          type: Sequelize.ENUM('pending','approved','scheduled','paid','overdue','canceled'),
          allowNull: false,
          defaultValue: 'pending'
        },
        category: { type: Sequelize.STRING(64), allowNull: true },
        cost_center: { type: Sequelize.STRING(64), allowNull: true },
        created_by_user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
        approved_by_user_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
        attachment_url: { type: Sequelize.STRING(500), allowNull: true },
        conciliated_by: { type: Sequelize.ENUM('system','manual','gpt'), allowNull: true },
        conciliated_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addIndex('contasap_payables', ['store_id'], { transaction: t });
      await queryInterface.addIndex('contasap_payables', ['vendor_id'], { transaction: t });
      await queryInterface.addIndex('contasap_payables', ['status'], { transaction: t });
      await queryInterface.addIndex('contasap_payables', ['due_date'], { transaction: t });
      await queryInterface.addIndex('contasap_payables', ['id_code'], { transaction: t });
      await queryInterface.addIndex('contasap_payables', ['invoice_number'], { transaction: t });
      await queryInterface.addIndex('contasap_payables', ['store_id','status','due_date'], { transaction: t });

      await queryInterface.addConstraint('contasap_payables', {
        fields: ['vendor_id','invoice_number'],
        type: 'unique',
        name: 'uq_vendor_invoice'
      }, { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('contasap_payables');
    // MySQL não requer DROP TYPE de ENUM; se usar Postgres, seria necessário aqui.
  }
};

