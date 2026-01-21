const request = require('supertest');

// MOCK MIDDLEWARE
jest.mock('../middlewares/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 1, role: 'admin' };
    next();
  },
  requireRole: (...roles) => (req, res, next) => {
    next();
  }
}));

// MOCK MODELS
jest.mock('../models', () => {
  const Sequelize = require('sequelize');
  return {
    sequelize: {
      define: jest.fn(),
      authenticate: jest.fn(),
      close: jest.fn(),
      transaction: jest.fn((callback) => callback({ commit: jest.fn(), rollback: jest.fn() }))
    },
    User: {
      findByPk: jest.fn().mockResolvedValue({ id: 1, name: 'Admin' })
    },
    BankAccount: {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn()
    },
    FinancialTransaction: {
      create: jest.fn(),
      count: jest.fn(),
      findAll: jest.fn()
    },
    // Include others to avoid crash if server imports them
    Store: {},
    Plan: {},
    StoreUser: {},
    Product: {},
    Order: {},
    OrderItem: {},
    PixPayment: {},
    Message: {},
    FootballTeam: {},
    TokenBlocklist: {},
    StoreSchedule: {},
    Event: {},
    EventQuestion: {},
    EventResponse: {},
    EventAnswer: {},
    EventGuest: {},
    EventJam: {},
    EventJamSong: {},
    EventJamSongInstrumentSlot: {},
    EventJamSongCandidate: {},
    EventJamSongRating: {}
  };
});

const app = require('../server');
const { BankAccount, FinancialTransaction } = require('../models');

describe('Bank Accounts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list bank accounts with calculated balance', async () => {
    const mockAccounts = [
      { 
        id: 1, 
        name: 'Conta Teste', 
        bank_name: 'Banco Teste',
        initial_balance: 0,
        toJSON: () => ({
            id: 1, 
            name: 'Conta Teste', 
            bank_name: 'Banco Teste',
            initial_balance: 0,
            transactions: [
                { type: 'ADJUSTMENT', amount: '100.00' }, // +100
                { type: 'RECEIVABLE', amount: '50.00' },  // +50
                { type: 'PAYABLE', amount: '30.00' }      // -30
            ]
        }),
        transactions: [
            { type: 'ADJUSTMENT', amount: '100.00' },
            { type: 'RECEIVABLE', amount: '50.00' },
            { type: 'PAYABLE', amount: '30.00' }
        ]
      }
    ];

    BankAccount.findAll.mockResolvedValue(mockAccounts);

    const res = await request(app).get('/api/v1/financial/bank-accounts');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Conta Teste');
    // Balance should be 100 + 50 - 30 = 120
    expect(res.body[0].current_balance).toBe(120.00);
  });

  it('should create a bank account with initial balance transaction', async () => {
    const newAccountData = {
        name: 'Minha Conta',
        bank_name: 'Nubank',
        agency: '0001',
        account_number: '123456',
        type: 'checking',
        initial_balance: 4000
    };

    BankAccount.create.mockResolvedValue({
        ...newAccountData,
        id: 1,
        id_code: 'bk-uuid',
        created_by: 1,
        initial_balance: 0 // stored as 0
    });

    FinancialTransaction.create.mockResolvedValue({
        id: 1,
        amount: 4000,
        type: 'ADJUSTMENT'
    });

    const res = await request(app)
      .post('/api/v1/financial/bank-accounts')
      .send(newAccountData);
      
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Minha Conta');
    
    // Check if BankAccount.create was called
    expect(BankAccount.create).toHaveBeenCalled();
    
    // Check if FinancialTransaction.create was called for initial balance
    expect(FinancialTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
            amount: 4000,
            type: 'ADJUSTMENT',
            description: 'Saldo Inicial',
            payment_method: null,
            created_by_user_id: 1
        }),
        expect.anything()
    );
  });
});