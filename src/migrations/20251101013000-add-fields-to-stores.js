'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('stores', 'capacity', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'type', { type: Sequelize.ENUM('bar', 'restaurante', 'pub', 'cervejaria', 'casa noturna'), allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'legal_name', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'phone', { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'zip_code', { type: Sequelize.STRING(10), allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'address_street', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'address_neighborhood', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'address_state', { type: Sequelize.STRING(2), allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'address_number', { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'address_complement', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'banner_url', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'website', { type: Sequelize.STRING, allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'latitude', { type: Sequelize.DECIMAL(10, 8), allowNull: true }, { transaction });
      await queryInterface.addColumn('stores', 'longitude', { type: Sequelize.DECIMAL(11, 8), allowNull: true }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('stores', 'capacity', { transaction });
      await queryInterface.removeColumn('stores', 'type', { transaction });
      await queryInterface.removeColumn('stores', 'legal_name', { transaction });
      await queryInterface.removeColumn('stores', 'phone', { transaction });
      await queryInterface.removeColumn('stores', 'zip_code', { transaction });
      await queryInterface.removeColumn('stores', 'address_street', { transaction });
      await queryInterface.removeColumn('stores', 'address_neighborhood', { transaction });
      await queryInterface.removeColumn('stores', 'address_state', { transaction });
      await queryInterface.removeColumn('stores', 'address_number', { transaction });
      await queryInterface.removeColumn('stores', 'address_complement', { transaction });
      await queryInterface.removeColumn('stores', 'banner_url', { transaction });
      await queryInterface.removeColumn('stores', 'website', { transaction });
      await queryInterface.removeColumn('stores', 'latitude', { transaction });
      await queryInterface.removeColumn('stores', 'longitude', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};