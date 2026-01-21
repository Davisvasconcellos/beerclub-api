const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middlewares/auth');
const { BankAccount, FinancialTransaction, sequelize } = require('../models');

const router = express.Router();

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
router.get('/', authenticateToken, async (req, res) => {
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
      
      return {
        ...acc,
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

    res.json(account);
  } catch (error) {
    console.error('Error fetching bank account:', error);
    res.status(500).json({ error: 'Erro ao buscar conta bancária' });
  }
});

// POST /api/v1/financial/bank-accounts
router.post('/', [
  authenticateToken,
  body('name').notEmpty().withMessage('Nome da conta é obrigatório'),
  body('bank_name').notEmpty().withMessage('Nome do banco é obrigatório'),
  body('agency').notEmpty().withMessage('Agência é obrigatória'),
  body('account_number').notEmpty().withMessage('Número da conta é obrigatório'),
  body('type').isIn(['checking', 'savings', 'investment', 'payment', 'other']).withMessage('Tipo de conta inválido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      name, bank_name, bank_code, agency, account_number, account_digit, 
      type, initial_balance, store_id, is_active, is_default 
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
  body('type').optional().isIn(['checking', 'savings', 'investment', 'payment', 'other']).withMessage('Tipo de conta inválido')
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
      type, initial_balance, store_id, is_active, is_default 
    } = req.body;

    await account.update({
      name: name !== undefined ? name : account.name,
      bank_name: bank_name !== undefined ? bank_name : account.bank_name,
      bank_code: bank_code !== undefined ? bank_code : account.bank_code,
      agency: agency !== undefined ? agency : account.agency,
      account_number: account_number !== undefined ? account_number : account.account_number,
      account_digit: account_digit !== undefined ? account_digit : account.account_digit,
      type: type !== undefined ? type : account.type,
      initial_balance: initial_balance !== undefined ? initial_balance : account.initial_balance,
      store_id: store_id !== undefined ? store_id : account.store_id,
      is_active: is_active !== undefined ? is_active : account.is_active,
      is_default: is_default !== undefined ? is_default : account.is_default,
    });

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
