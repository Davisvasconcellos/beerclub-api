'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Tabela de Sugestões (event_jam_music_suggestions)
      await queryInterface.createTable('event_jam_music_suggestions', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        id_code: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false,
          unique: true
        },
        event_id: { // Opcional por enquanto, se quisermos ligar a um evento específico
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'events', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        song_name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        artist_name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        created_by_user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        status: {
          type: Sequelize.ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'),
          allowNull: false,
          defaultValue: 'DRAFT'
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
      }, { transaction });

      // 2. Tabela de Participantes/Convites (event_jam_music_suggestion_participants)
      await queryInterface.createTable('event_jam_music_suggestion_participants', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        id_code: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false,
          unique: true
        },
        music_suggestion_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'event_jam_music_suggestions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        instrument: {
          type: Sequelize.STRING,
          allowNull: false
        },
        is_creator: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        status: {
          type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
          allowNull: false,
          defaultValue: 'PENDING'
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
      }, { transaction });

      // Adicionar índices para performance
      await queryInterface.addIndex('event_jam_music_suggestions', ['created_by_user_id'], { transaction });
      await queryInterface.addIndex('event_jam_music_suggestion_participants', ['music_suggestion_id'], { transaction });
      await queryInterface.addIndex('event_jam_music_suggestion_participants', ['user_id'], { transaction });
      
      // Índice composto para evitar convites duplicados para o mesmo user na mesma sugestão
      await queryInterface.addIndex('event_jam_music_suggestion_participants', ['music_suggestion_id', 'user_id'], { 
        unique: true,
        name: 'unique_participant_per_jam_suggestion',
        transaction 
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('event_jam_music_suggestion_participants', { transaction });
      await queryInterface.dropTable('event_jam_music_suggestions', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
