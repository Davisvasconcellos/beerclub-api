module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('football_teams', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      short_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      abbreviation: {
        type: Sequelize.CHAR(3),
        allowNull: false
      },
      shield: {
        type: Sequelize.STRING(255),
        allowNull: false
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('football_teams');
  }
};