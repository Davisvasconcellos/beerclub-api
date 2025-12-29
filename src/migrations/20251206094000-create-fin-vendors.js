'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('fin_vendors', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        id_code: { type: Sequelize.CHAR(36), allowNull: false, unique: true, defaultValue: Sequelize.literal('UUID()') },
        store_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
        name: { type: Sequelize.STRING(255), allowNull: false },
        document: { type: Sequelize.STRING(32) },
        email: { type: Sequelize.STRING(255) },
        phone: { type: Sequelize.STRING(32) },
        bank_info: { type: Sequelize.JSON },
        created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addIndex('fin_vendors', ['store_id'], { name: 'idx_fin_vendors_store_id', transaction: t });
      await queryInterface.addIndex('fin_vendors', ['document'], { name: 'idx_fin_vendors_document', transaction: t });
      await queryInterface.addIndex('fin_vendors', ['id_code'], { name: 'idx_fin_vendors_id_code', transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('fin_vendors');
  }
};

