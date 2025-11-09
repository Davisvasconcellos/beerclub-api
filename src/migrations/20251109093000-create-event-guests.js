'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Cria tabela event_guests
    await queryInterface.createTable('event_guests', {
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      guest_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      guest_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      guest_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      guest_document_type: {
        type: Sequelize.ENUM('rg', 'cpf', 'passport'),
        allowNull: true
      },
      guest_document_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('normal', 'vip', 'premium'),
        allowNull: false,
        defaultValue: 'normal'
      },
      source: {
        type: Sequelize.ENUM('invited', 'walk_in'),
        allowNull: false,
        defaultValue: 'invited'
      },
      rsvp_confirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      rsvp_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      invited_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      invited_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      check_in_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      check_in_method: {
        type: Sequelize.ENUM('google', 'staff_manual', 'invited_qr'),
        allowNull: true
      },
      authorized_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
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
      }
    });

    // Índices e constraints
    await queryInterface.addConstraint('event_guests', {
      fields: ['event_id', 'user_id'],
      type: 'unique',
      name: 'uniq_event_user_guest'
    });
    await queryInterface.addConstraint('event_guests', {
      fields: ['event_id', 'guest_email'],
      type: 'unique',
      name: 'uniq_event_email_guest'
    });
    await queryInterface.addConstraint('event_guests', {
      fields: ['event_id', 'guest_document_number'],
      type: 'unique',
      name: 'uniq_event_document_guest'
    });
    await queryInterface.addIndex('event_guests', ['event_id'], { name: 'idx_event_guests_event_id' });
    await queryInterface.addIndex('event_guests', ['event_id', 'check_in_at'], { name: 'idx_event_guests_event_checkin' });

    // Seeds: 20 convidados variados para o evento id=22
    const now = new Date();
    const mkDate = (d) => d ? new Date(d) : null;

    await queryInterface.bulkInsert('event_guests', [
      // Pré-lista VIP (alguns confirmados, alguns pendentes)
      { event_id: 22, user_id: null, guest_name: 'Ana Vip 1', guest_email: 'ana.vip1@example.com', guest_phone: '11999990001', guest_document_type: 'cpf', guest_document_number: '12345678901', type: 'vip', source: 'invited', rsvp_confirmed: true, rsvp_at: mkDate('2025-11-01T10:00:00Z'), invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:01:00Z'), check_in_method: 'invited_qr', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Bruno Vip 2', guest_email: 'bruno.vip2@example.com', guest_phone: '11999990002', guest_document_type: 'rg', guest_document_number: 'MG1234567', type: 'vip', source: 'invited', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: null, check_in_method: null, authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Carla Vip 3', guest_email: 'carla.vip3@example.com', guest_phone: '11999990003', guest_document_type: 'cpf', guest_document_number: '98765432100', type: 'vip', source: 'invited', rsvp_confirmed: true, rsvp_at: mkDate('2025-11-02T09:30:00Z'), invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:05:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },

      // Pré-lista Premium
      { event_id: 22, user_id: null, guest_name: 'Diego Premium 1', guest_email: 'diego.p1@example.com', guest_phone: '21988880001', guest_document_type: 'passport', guest_document_number: 'P1234567', type: 'premium', source: 'invited', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: null, check_in_method: null, authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Elisa Premium 2', guest_email: 'elisa.p2@example.com', guest_phone: '21988880002', guest_document_type: 'cpf', guest_document_number: '55566677788', type: 'premium', source: 'invited', rsvp_confirmed: true, rsvp_at: mkDate('2025-11-03T12:00:00Z'), invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:10:00Z'), check_in_method: 'invited_qr', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Fabio Premium 3', guest_email: 'fabio.p3@example.com', guest_phone: '21988880003', guest_document_type: 'rg', guest_document_number: 'SP7654321', type: 'premium', source: 'invited', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: null, check_in_method: null, authorized_by_user_id: null, created_at: now, updated_at: now },

      // Pré-lista Normal
      { event_id: 22, user_id: null, guest_name: 'Gustavo Normal 1', guest_email: 'gustavo.n1@example.com', guest_phone: '11977770001', guest_document_type: 'cpf', guest_document_number: '10101010101', type: 'normal', source: 'invited', rsvp_confirmed: true, rsvp_at: mkDate('2025-11-04T08:15:00Z'), invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:12:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Helena Normal 2', guest_email: 'helena.n2@example.com', guest_phone: '11977770002', guest_document_type: 'rg', guest_document_number: 'RJ3344556', type: 'normal', source: 'invited', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: null, check_in_method: null, authorized_by_user_id: null, created_at: now, updated_at: now },

      // Open event com login (walk_in + google)
      { event_id: 22, user_id: null, guest_name: 'Igor Open 1', guest_email: 'igor.open1@example.com', guest_phone: '11966660001', guest_document_type: null, guest_document_number: null, type: 'normal', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:20:00Z'), check_in_method: 'google', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Julia Open 2', guest_email: 'julia.open2@example.com', guest_phone: '11966660002', guest_document_type: null, guest_document_number: null, type: 'normal', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:22:00Z'), check_in_method: 'google', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Karen Open 3', guest_email: 'karen.open3@example.com', guest_phone: '11966660003', guest_document_type: null, guest_document_number: null, type: 'premium', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:24:00Z'), check_in_method: 'google', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Leo Open 4', guest_email: 'leo.open4@example.com', guest_phone: '11966660004', guest_document_type: null, guest_document_number: null, type: 'vip', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:26:00Z'), check_in_method: 'google', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Marina Open 5', guest_email: 'marina.open5@example.com', guest_phone: '11966660005', guest_document_type: null, guest_document_number: null, type: 'normal', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:28:00Z'), check_in_method: 'google', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Nina Open 6', guest_email: 'nina.open6@example.com', guest_phone: '11966660006', guest_document_type: null, guest_document_number: null, type: 'normal', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:30:00Z'), check_in_method: 'google', authorized_by_user_id: null, created_at: now, updated_at: now },

      // Portaria cadastro rápido (walk_in + staff_manual)
      { event_id: 22, user_id: null, guest_name: 'Otavio Portaria 1', guest_email: null, guest_phone: '11955550001', guest_document_type: 'cpf', guest_document_number: '22233344455', type: 'normal', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:32:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Paula Portaria 2', guest_email: null, guest_phone: '11955550002', guest_document_type: 'rg', guest_document_number: 'RS9988776', type: 'premium', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:34:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Quintino Portaria 3', guest_email: null, guest_phone: '11955550003', guest_document_type: 'cpf', guest_document_number: '33344455566', type: 'vip', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:36:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Rafa Portaria 4', guest_email: null, guest_phone: '11955550004', guest_document_type: 'passport', guest_document_number: 'P7654321', type: 'normal', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:38:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Sofia Portaria 5', guest_email: null, guest_phone: '11955550005', guest_document_type: 'rg', guest_document_number: 'SP2233445', type: 'premium', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:40:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now },
      { event_id: 22, user_id: null, guest_name: 'Tereza Portaria 6', guest_email: null, guest_phone: '11955550006', guest_document_type: 'cpf', guest_document_number: '44455566677', type: 'vip', source: 'walk_in', rsvp_confirmed: false, rsvp_at: null, invited_at: now, invited_by_user_id: null, check_in_at: mkDate('2025-11-09T18:42:00Z'), check_in_method: 'staff_manual', authorized_by_user_id: null, created_at: now, updated_at: now }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('event_guests');
  }
};