'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Fin Categories
      await queryInterface.createTable('fin_categories', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        id_code: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        store_id: { type: Sequelize.STRING(255), allowNull: false },
        name: { type: Sequelize.STRING(255), allowNull: false },
        type: { type: Sequelize.ENUM('payable', 'receivable'), allowNull: false },
        color: { type: Sequelize.STRING(20), allowNull: true },
        icon: { type: Sequelize.STRING(50), allowNull: true },
        status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction });
      
      await queryInterface.addIndex('fin_categories', ['store_id'], { transaction });
      await queryInterface.addIndex('fin_categories', ['type'], { transaction });
      await queryInterface.addIndex('fin_categories', ['id_code'], { transaction });

      // Fin Cost Centers
      await queryInterface.createTable('fin_cost_centers', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        id_code: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        store_id: { type: Sequelize.STRING(255), allowNull: false },
        name: { type: Sequelize.STRING(255), allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction });

      await queryInterface.addIndex('fin_cost_centers', ['store_id'], { transaction });
      await queryInterface.addIndex('fin_cost_centers', ['id_code'], { transaction });

      // Fin Tags
      await queryInterface.createTable('fin_tags', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        id_code: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        store_id: { type: Sequelize.STRING(255), allowNull: false },
        name: { type: Sequelize.STRING(255), allowNull: false },
        color: { type: Sequelize.STRING(20), allowNull: true },
        status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
      }, { transaction });

      await queryInterface.addIndex('fin_tags', ['store_id'], { transaction });
      await queryInterface.addIndex('fin_tags', ['id_code'], { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('fin_tags', { transaction });
      await queryInterface.dropTable('fin_cost_centers', { transaction });
      await queryInterface.dropTable('fin_categories', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
