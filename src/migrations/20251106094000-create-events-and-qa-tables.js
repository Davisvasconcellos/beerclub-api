'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. events
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      banner_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      start_datetime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      end_datetime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Extras solicitados
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      public_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      gallery_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      place: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      resp_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      resp_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      resp_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      color_1: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      color_2: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      card_background: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // 2. event_questions
    await queryInterface.createTable('event_questions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      question_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      question_type: {
        type: Sequelize.ENUM('text', 'textarea', 'radio', 'checkbox', 'rating', 'music_preference'),
        allowNull: false,
        defaultValue: 'text'
      },
      options: {
        type: Sequelize.JSON,
        allowNull: true
      },
      is_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      show_results: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 3. event_responses
    await queryInterface.createTable('event_responses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      guest_code: {
        type: Sequelize.STRING(8),
        allowNull: false,
        unique: true
      },
      selfie_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 4. event_answers
    await queryInterface.createTable('event_answers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      response_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'event_responses',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      question_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'event_questions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      answer_text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      answer_json: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Índice único (response_id, question_id)
    await queryInterface.addConstraint('event_answers', {
      fields: ['response_id', 'question_id'],
      type: 'unique',
      name: 'uniq_response_question'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remover ENUM antes de dropar tabela (MySQL mantém tipos)
    await queryInterface.dropTable('event_answers');
    await queryInterface.dropTable('event_responses');
    await queryInterface.dropTable('event_questions');
    await queryInterface.dropTable('events');
  }
};