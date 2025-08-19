module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'id_code', {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true
    });
    await queryInterface.changeColumn('users', 'team_user', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'football_teams',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'id_code', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.changeColumn('users', 'team_user', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  }
};