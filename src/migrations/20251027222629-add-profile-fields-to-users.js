'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'google_id', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('users', 'avatar_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'birth_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_street', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_complement', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_neighborhood', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_city', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_state', {
      type: Sequelize.STRING(2),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'address_zip_code', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'email_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'pending_verification', 'banned'),
      allowNull: false,
      defaultValue: 'active',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'google_id');
    await queryInterface.removeColumn('users', 'avatar_url');
    await queryInterface.removeColumn('users', 'birth_date');
    await queryInterface.removeColumn('users', 'address_street');
    await queryInterface.removeColumn('users', 'address_number');
    await queryInterface.removeColumn('users', 'address_complement');
    await queryInterface.removeColumn('users', 'address_neighborhood');
    await queryInterface.removeColumn('users', 'address_city');
    await queryInterface.removeColumn('users', 'address_state');
    await queryInterface.removeColumn('users', 'address_zip_code');
    await queryInterface.removeColumn('users', 'email_verified');
    await queryInterface.removeColumn('users', 'status');
  }
};
