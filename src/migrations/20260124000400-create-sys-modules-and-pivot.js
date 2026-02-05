'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Criar tabela de Módulos
    await queryInterface.createTable('sys_modules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Identificador único para uso no código (ex: financial, events, pub)'
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 2. Criar tabela Pivot (Usuário <-> Módulo)
    await queryInterface.createTable('sys_user_modules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      module_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sys_modules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 3. Adicionar índice único para evitar duplicatas (um usuário não pode ter o mesmo módulo 2x)
    await queryInterface.addConstraint('sys_user_modules', {
      fields: ['user_id', 'module_id'],
      type: 'unique',
      name: 'unique_user_module'
    });

    // 4. Popular com os módulos iniciais
    const now = new Date();
    await queryInterface.bulkInsert('sys_modules', [
      { name: 'Financeiro', slug: 'financial', description: 'Gestão de Contas e Transações', active: true, created_at: now, updated_at: now },
      { name: 'Eventos', slug: 'events', description: 'Gestão de Eventos e Participantes', active: true, created_at: now, updated_at: now },
      { name: 'Pub', slug: 'pub', description: 'Gestão de Comandas e Pedidos', active: true, created_at: now, updated_at: now }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('sys_user_modules');
    await queryInterface.dropTable('sys_modules');
  }
};
