const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { authenticateToken, requireModule } = require('../middlewares/auth');
const { BankAccount, FinancialTransaction, sequelize, FinCategory, FinCostCenter, Party, FinTag } = require('../models');

const router = express.Router();

const VALID_PAYMENT_METHODS = ['cash', 'pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto'];

/**
 * @swagger
 * components:
 *   schemas:
 *     BankAccount:
 *       type: object
 *       properties:
 *         id_code:
 *           type: string
 *         name:
 *           type: string
 *         bank_name:
 *           type: string
 *         agency:
 *           type: string
 *         account_number:
 *           type: string
 *         type:
 *           type: string
 *           enum: [checking, savings, investment, payment, other]
 */

// GET /api/v1/financial/bank-accounts
router.get('/', authenticateToken, requireModule('financial'), async (req, res) => {
  try {
    const { store_id } = req.query;
    const where = {};
    
    if (store_id) {
      where.store_id = store_id;
    }

    const accounts = await BankAccount.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: FinancialTransaction,
          as: 'transactions',
          where: { 
            status: 'paid',
            is_deleted: false 
          },
          attributes: ['amount', 'type'],
          required: false
        }
      ]
    });

    const accountsWithBalance = accounts.map(account => {
      const acc = account.toJSON();
      
      // Calculate current balance based on transactions only
      // Initial balance is now handled via a transaction
      let currentBalance = 0; // Start from 0, initial_balance column is ignored for calculation
      
      if (acc.transactions && acc.transactions.length > 0) {
        acc.transactions.forEach(txn => {
          const amount = parseFloat(txn.amount);
          if (txn.type === 'RECEIVABLE') {
            currentBalance += amount;
          } else if (txn.type === 'PAYABLE') {
            currentBalance -= amount;
          } else if (txn.type === 'ADJUSTMENT') {
            // Adjustments can be positive or negative depending on context, 
            // but usually stored as positive amount. 
            // We need to define convention. Assuming Adjustment adds to balance if positive context?
            // Or maybe we treat Adjustment as Receivable for now.
            // Let's assume ADJUSTMENT adds to balance (like initial balance).
             currentBalance += amount;
          }
        });
      }
      
      // Remove transactions list from response to keep it clean
      delete acc.transactions;
      
      // Ensure allowed_payment_methods is an array
      let allowedMethods = acc.allowed_payment_methods;
      if (typeof allowedMethods === 'string') {
        try {
          allowedMethods = JSON.parse(allowedMethods);
        } catch (e) {
          allowedMethods = [];
        }
      }
      if (!Array.isArray(allowedMethods)) allowedMethods = [];

      const accountNumber = acc.account_digit ? `${acc.account_number}-${acc.account_digit}` : acc.account_number;
      const label = `${acc.name} - ${accountNumber}`;

      return {
        ...acc,
        label,
        allowed_payment_methods: allowedMethods,
        current_balance: parseFloat(currentBalance.toFixed(2))
      };
    });

    res.json(accountsWithBalance);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: 'Erro ao buscar contas bancárias' });
  }
});

// GET /api/v1/financial/bank-accounts/:id_code
router.get('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const account = await BankAccount.findOne({ where: { id_code } });

    if (!account) {
      return res.status(404).json({ error: 'Conta bancária não encontrada' });
    }

    const acc = account.toJSON();
    // Ensure allowed_payment_methods is an array
    let allowedMethods = acc.allowed_payment_methods;
    if (typeof allowedMethods === 'string') {
      try {
        allowedMethods = JSON.parse(allowedMethods);
      } catch (e) {
        allowedMethods = [];
      }
    }
    if (!Array.isArray(allowedMethods)) allowedMethods = [];
    acc.allowed_payment_methods = allowedMethods;

    res.json(acc);
  } catch (error) {
    console.error('Error fetching bank account:', error);
    res.status(500).json({ error: 'Erro ao buscar conta bancária' });
  }
});

// GET /api/v1/financial/bank-accounts/:id_code/transactions
router.get('/:id_code/transactions', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const { 
      start_date, 
      end_date, 
      type, 
      description, 
      category_id, 
      party_id, 
      cost_center_id 
    } = req.query;

    const account = await BankAccount.findOne({ where: { id_code } });

    if (!account) {
      return res.status(404).json({ error: 'Conta bancária não encontrada' });
    }

    const where = {
      bank_account_id: id_code,
      status: 'paid',
      is_deleted: false
    };

    // Date filters
    if (start_date && end_date) {
      where.paid_at = {
        [Op.between]: [start_date, end_date]
      };
    } else if (start_date) {
      where.paid_at = {
        [Op.gte]: start_date
      };
    } else if (end_date) {
      where.paid_at = {
        [Op.lte]: end_date
      };
    }

    // Additional filters
    if (type) {
      where.type = type;
    }

    if (description) {
      where.description = {
        [Op.like]: `%${description}%`
      };
    }

    if (category_id) {
      where.category_id = category_id;
    }

    if (party_id) {
      where.party_id = party_id;
    }

    if (cost_center_id) {
      where.cost_center_id = cost_center_id;
    }

    const transactions = await FinancialTransaction.findAll({
      where,
      order: [['paid_at', 'DESC'], ['created_at', 'DESC']],
      include: [
        {
          model: FinCategory,
          as: 'finCategory',
          attributes: ['id_code', 'name', 'color', 'icon']
        },
        {
          model: Party,
          as: 'party',
          attributes: ['id_code', 'name']
        },
        {
          model: FinCostCenter,
          as: 'finCostCenter',
          attributes: ['id_code', 'name', 'code']
        },
        {
          model: FinTag,
          as: 'tags',
          attributes: ['id_code', 'name', 'color'],
          through: { attributes: [] }
        }
      ]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching bank account transactions:', error);
    res.status(500).json({ error: 'Erro ao buscar lançamentos da conta bancária' });
  }
});

// POST /api/v1/financial/bank-accounts
router.post('/', [
  authenticateToken,
  body('name').notEmpty().withMessage('Nome da conta é obrigatório'),
  body('bank_name').notEmpty().withMessage('Nome do banco é obrigatório'),
  body('agency').notEmpty().withMessage('Agência é obrigatória'),
  body('account_number').notEmpty().withMessage('Número da conta é obrigatório'),
  body('type').isIn(['checking', 'savings', 'investment', 'payment', 'cash', 'credit_card', 'other']).withMessage('Tipo de conta inválido'),
  body('allowed_payment_methods').optional().isArray().withMessage('Métodos de pagamento permitidos deve ser uma lista')
    .custom((value) => {
      if (!value) return true;
      const invalid = value.filter(m => !VALID_PAYMENT_METHODS.includes(m));
      if (invalid.length > 0) throw new Error(`Métodos inválidos: ${invalid.join(', ')}`);
      return true;
    })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      name, bank_name, bank_code, agency, account_number, account_digit, 
      type, initial_balance, store_id, is_active, is_default, allowed_payment_methods 
    } = req.body;

    const result = await sequelize.transaction(async (t) => {
      const newAccount = await BankAccount.create({
        name,
        bank_name,
        bank_code,
        agency,
        account_number,
        account_digit,
        type,
        initial_balance: 0, // Always 0 in column, real balance is a transaction
        store_id,
        is_active: is_active !== undefined ? is_active : true,
        is_default: is_default !== undefined ? is_default : false,
        allowed_payment_methods: allowed_payment_methods || [],
        created_by: req.user.userId
      }, { transaction: t });

      // Create initial balance transaction if value > 0
      if (initial_balance && parseFloat(initial_balance) > 0) {
        await FinancialTransaction.create({
          store_id,
          bank_account_id: newAccount.id_code,
          type: 'ADJUSTMENT', // Using ADJUSTMENT for initial balance
          status: 'paid',
          payment_method: null, // Initial balance is not a payment method
          amount: parseFloat(initial_balance),
          description: 'Saldo Inicial',
          transaction_date: new Date(),
          due_date: new Date(),
          payment_date: new Date(),
          is_paid: true,
          created_by_user_id: req.user.userId
        }, { transaction: t });
      }

      return newAccount;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: 'Erro ao criar conta bancária' });
  }
});

// PUT /api/v1/financial/bank-accounts/:id_code
router.put('/:id_code', [
  authenticateToken,
  body('name').optional().notEmpty().withMessage('Nome da conta não pode ser vazio'),
  body('type').optional().isIn(['checking', 'savings', 'investment', 'payment', 'cash', 'credit_card', 'other']).withMessage('Tipo de conta inválido'),
  body('allowed_payment_methods').optional().isArray().withMessage('Métodos de pagamento permitidos deve ser uma lista')
    .custom((value) => {
      if (!value) return true;
      const invalid = value.filter(m => !VALID_PAYMENT_METHODS.includes(m));
      if (invalid.length > 0) throw new Error(`Métodos inválidos: ${invalid.join(', ')}`);
      return true;
    })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id_code } = req.params;
    const account = await BankAccount.findOne({ where: { id_code } });

    if (!account) {
      return res.status(404).json({ error: 'Conta bancária não encontrada' });
    }

    const { 
      name, bank_name, bank_code, agency, account_number, account_digit, 
      type, initial_balance, store_id, is_active, is_default, allowed_payment_methods 
    } = req.body;

    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (bank_name) updateData.bank_name = bank_name;
    if (bank_code) updateData.bank_code = bank_code;
    if (agency) updateData.agency = agency;
    if (account_number) updateData.account_number = account_number;
    if (account_digit) updateData.account_digit = account_digit;
    if (type) updateData.type = type;
    if (store_id) updateData.store_id = store_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (allowed_payment_methods) updateData.allowed_payment_methods = allowed_payment_methods;

    await account.update(updateData);

    res.json(account);
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Erro ao atualizar conta bancária' });
  }
});

// DELETE /api/v1/financial/bank-accounts/:id_code
router.delete('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const account = await BankAccount.findOne({ where: { id_code } });

    if (!account) {
      return res.status(404).json({ error: 'Conta bancária não encontrada' });
    }

    // Check if there are transactions associated
    const transactionsCount = await FinancialTransaction.count({ 
      where: { 
        bank_account_id: id_code,
        is_deleted: false
      } 
    });

    if (transactionsCount > 0) {
      // Soft delete: just deactive the account
      await account.update({ is_active: false });
      return res.json({ message: 'Conta bancária arquivada com sucesso (possuía transações vinculadas)' });
    }
    
    // Hard delete only if no transactions exist
    await account.destroy();

    res.json({ message: 'Conta bancária removida com sucesso' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ error: 'Erro ao excluir conta bancária' });
  }
});

module.exports = router;
