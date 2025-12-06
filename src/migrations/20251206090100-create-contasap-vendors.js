'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('contasap_vendors', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        id_code: { type: Sequelize.CHAR(36), allowNull: false, unique: true },
        store_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'stores', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        name: { type: Sequelize.STRING(255), allowNull: false },
        document: { type: Sequelize.STRING(32), allowNull: true },
        email: { type: Sequelize.STRING(255), allowNull: true },
        phone: { type: Sequelize.STRING(32), allowNull: true },
        bank_info: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction: t });

      await queryInterface.addIndex('contasap_vendors', ['store_id'], { transaction: t });
      await queryInterface.addIndex('contasap_vendors', ['document'], { transaction: t });
      await queryInterface.addIndex('contasap_vendors', ['id_code'], { transaction: t });
      await queryInterface.addIndex('contasap_vendors', ['name'], { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('contasap_vendors');
  }
};

