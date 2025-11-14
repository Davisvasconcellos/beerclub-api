'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Extend ENUM to include 'auto_checkin'
    await queryInterface.sequelize.query(
      "ALTER TABLE event_guests MODIFY check_in_method ENUM('google','staff_manual','invited_qr','auto_checkin') NULL"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revert ENUM to original values
    await queryInterface.sequelize.query(
      "ALTER TABLE event_guests MODIFY check_in_method ENUM('google','staff_manual','invited_qr') NULL"
    );
  }
};