const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middlewares/auth');
const { FinancialTransaction, User } = require('../models');
const { Op, Sequelize } = require('sequelize');

const router = express.Router();

const VALID_TYPES = ['PAYABLE', 'RECEIVABLE', 'TRANSFER', 'ADJUSTMENT'];
const VALID_STATUS = ['pending', 'approved', 'scheduled', 'paid', 'overdue', 'canceled'];
const VALID_PAYMENT_METHODS = ['cash', 'pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto'];
const BANK_MOVEMENT_METHODS = ['pix', 'bank_transfer', 'boleto'];

router.get(
  '/transactions',
  authenticateToken,
  requireRole('admin', 'manager', 'master'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 2000 }).toInt(),
    query('kpi_linked').optional().isBoolean().toBoolean(),
    query('type').optional().isIn(VALID_TYPES),
    query('status').optional().isIn(VALID_STATUS),
    query('store_id').optional().isString(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        page = 1,
        limit = 20,
        kpi_linked = true,
        type,
        status,
        store_id,
        start_date,
        end_date
      } = req.query;

      // Ensure reasonable limits for pagination
      const pageNumber = Math.max(Number(page) || 1, 1);
      let limitNumber = limit;
      if (limitNumber < 1) limitNumber = 1;
      if (limitNumber > 2000) limitNumber = 2000;

      const offset = (pageNumber - 1) * limitNumber;
      const where = {};

      if (type) where.type = type;
      if (status) where.status = status;
      if (store_id) where.store_id = store_id;
      where.is_deleted = false;
      
      if (start_date || end_date) {
        where.due_date = {};
        if (start_date) where.due_date[Op.gte] = start_date;
        if (end_date) where.due_date[Op.lte] = end_date;
      }

      // Calculate summary/KPIs based on filters
      // If kpi_linked is false, we keep ONLY the store_id filter and ignore others (dates, type, status)
      // This provides a global store view as requested
      const kpiWhere = {};
      if (kpi_linked === false) {
        if (store_id) kpiWhere.store_id = store_id;
        kpiWhere.is_deleted = false;
      } else {
        Object.assign(kpiWhere, where);
      }

      const { count, rows: transactions } = await FinancialTransaction.findAndCountAll({
        where,
        limit: limitNumber,
        offset,
        order: [['due_date', 'ASC']],
        attributes: [
          'id_code', 'type', 'nf', 'description', 'amount', 'currency',
          'due_date', 'paid_at', 'status', 'party_id',
          'cost_center', 'category', 'is_paid', 'payment_method',
          'bank_account_id', 'attachment_url', 'store_id', 'approved_by',
          'created_at'
        ]
      });

      // Group by type and status to aggregate amounts
      const kpiData = await FinancialTransaction.findAll({
        where: kpiWhere,
        attributes: [
          'type',
          'status',
          [Sequelize.fn('SUM', Sequelize.col('amount')), 'total_amount']
        ],
        group: ['type', 'status'],
        raw: true
      });

      // Initialize summary structure
      const summary = {
        payable: {
          pending: 0,
          paid: 0
        },
        receivable: {
          pending: 0,
          paid: 0
        },
        overdue: 0,
        total_paid: 0
      };

      // Process aggregation results
      kpiData.forEach(row => {
        const amount = parseFloat(row.total_amount || 0);
        const { type, status } = row;

        if (status === 'canceled') {
          return;
        }

        // Populate payable/receivable pending/paid
        if (type === 'PAYABLE') {
          if (status === 'pending' || status === 'scheduled' || status === 'approved') {
            summary.payable.pending += amount;
          } else if (status === 'paid') {
            summary.payable.paid += amount;
            summary.total_paid += amount; // Assuming total_paid sums outgoing payments too? Or should it separate?
            // Usually "total paid" in a financial context might mean "Total Payments Made" (outflow)
            // But if we include RECEIVABLE paid, it would be "Total Receipts"
            // The user example had total_paid = 3789.10 which was 3000 (rec.paid) + 789.10 (pay.paid)
            // So it seems to be the sum of all settled transactions, regardless of direction.
          }
        } else if (type === 'RECEIVABLE') {
          if (status === 'pending' || status === 'scheduled' || status === 'approved') {
            summary.receivable.pending += amount;
          } else if (status === 'paid') {
            summary.receivable.paid += amount;
            summary.total_paid += amount;
          }
        }

        // Calculate overdue
        // Assuming 'overdue' status is explicitly set by a background job or logic
        if (status === 'overdue') {
          summary.overdue += amount;
          // Also add to pending payable/receivable? 
          // Usually overdue is a state of pending.
          if (type === 'PAYABLE') summary.payable.pending += amount;
          if (type === 'RECEIVABLE') summary.receivable.pending += amount;
        }
      });

      // Fix rounding issues
      summary.payable.pending = parseFloat(summary.payable.pending.toFixed(2));
      summary.payable.paid = parseFloat(summary.payable.paid.toFixed(2));
      summary.receivable.pending = parseFloat(summary.receivable.pending.toFixed(2));
      summary.receivable.paid = parseFloat(summary.receivable.paid.toFixed(2));
      summary.overdue = parseFloat(summary.overdue.toFixed(2));
      summary.total_paid = parseFloat(summary.total_paid.toFixed(2));

      return res.json({
        success: true,
        meta: {
          total: count,
          page: pageNumber,
          limit: limitNumber,
          pages: Math.ceil(count / limitNumber)
        },
        data: {
          transactions,
          summary
        }
      });
    } catch (error) {
      console.error('List transactions error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Erro ao listar transações'
      });
    }
  }
);

router.post(
  '/transactions',
  authenticateToken,
  requireRole('admin', 'manager', 'master'),
  [
    body('type')
      .isIn(VALID_TYPES),
    body('description')
      .isString()
      .isLength({ min: 1 }),
    body('amount')
      .isFloat({ gt: 0 }),
    body('due_date')
      .isISO8601(),
    body('status')
      .isIn(VALID_STATUS),
    body('is_paid')
      .isBoolean(),
    body('nf')
      .optional({ nullable: true })
      .isString(),
    body('paid_at')
      .optional({ nullable: true })
      .isISO8601(),
    body('party_id')
      .optional({ nullable: true })
      .isString(),
    body('cost_center')
      .optional({ nullable: true })
      .isString(),
    body('category')
      .optional({ nullable: true })
      .isString(),
    body('payment_method')
      .optional({ nullable: true })
      .isIn(VALID_PAYMENT_METHODS),
    body('bank_account_id')
      .optional({ nullable: true })
      .isString(),
    body('attachment_url')
      .optional({ nullable: true })
      .isString(),
    body('store_id')
      .optional({ nullable: true })
      .isString(),
    body('approved_by')
      .optional({ nullable: true })
      .isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      const logicErrors = [];

      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Dados inválidos',
          details: errors.array()
        });
      }

      const {
        type,
        nf,
        description,
        amount,
        due_date,
        paid_at,
        party_id,
        cost_center,
        category,
        is_paid,
        status,
        payment_method,
        bank_account_id,
        attachment_url,
        store_id,
        approved_by
      } = req.body;

      if (is_paid && status !== 'paid') {
        logicErrors.push({
          param: 'status',
          msg: 'Quando is_paid é true, status deve ser "paid".'
        });
      }

      if (!is_paid && !['pending', 'canceled'].includes(status)) {
        logicErrors.push({
          param: 'status',
          msg: 'Quando is_paid é false, status deve ser "pending" ou "canceled".'
        });
      }

      if (status === 'paid') {
        if (!paid_at) {
          logicErrors.push({
            param: 'paid_at',
            msg: 'paid_at é obrigatório quando status é "paid".'
          });
        }
        if (!payment_method) {
          logicErrors.push({
            param: 'payment_method',
            msg: 'payment_method é obrigatório quando status é "paid".'
          });
        }
        if (payment_method && BANK_MOVEMENT_METHODS.includes(payment_method) && !bank_account_id) {
          logicErrors.push({
            param: 'bank_account_id',
            msg: 'bank_account_id é obrigatório para métodos que movimentam conta bancária.'
          });
        }
      } else {
        if (paid_at) {
          logicErrors.push({
            param: 'paid_at',
            msg: 'paid_at deve ser nulo ou ausente quando status não é "paid".'
          });
        }
        if (payment_method) {
          logicErrors.push({
            param: 'payment_method',
            msg: 'payment_method deve ser nulo ou ausente quando status não é "paid".'
          });
        }
        if (bank_account_id) {
          logicErrors.push({
            param: 'bank_account_id',
            msg: 'bank_account_id deve ser nulo ou ausente quando status não é "paid".'
          });
        }
      }

      if (logicErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Regras de negócio violadas',
          details: logicErrors
        });
      }

      const user = await User.findByPk(req.user.userId, {
        attributes: ['id', 'id_code']
      });

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Usuário não encontrado.'
        });
      }

      const payload = {
        type,
        nf: nf || null,
        description,
        amount,
        currency: 'BRL',
        due_date,
        paid_at: status === 'paid' ? paid_at : null,
        party_id: party_id || null,
        cost_center: cost_center || null,
        category: category || null,
        is_paid,
        status,
        payment_method: status === 'paid' ? payment_method : null,
        bank_account_id: status === 'paid' ? bank_account_id || null : null,
        attachment_url: attachment_url || null,
        store_id: store_id || null,
        approved_by: approved_by || null,
        created_by_user_id: user.id,
        updated_by_user_id: null,
        is_deleted: false
      };

      const transaction = await FinancialTransaction.create(payload);

      return res.status(201).json({
        success: true,
        data: {
          id_code: transaction.id_code,
          type: transaction.type,
          nf: transaction.nf,
          description: transaction.description,
          amount: parseFloat(transaction.amount),
          currency: transaction.currency,
          issue_date: transaction.created_at.toISOString(),
          due_date: transaction.due_date,
          paid_at: transaction.paid_at,
          status: transaction.status,
          party_id: transaction.party_id,
          cost_center: transaction.cost_center,
          category: transaction.category,
          is_paid: transaction.is_paid,
          payment_method: transaction.payment_method,
          bank_account_id: transaction.bank_account_id,
          attachment_url: transaction.attachment_url,
          store_id: transaction.store_id,
          approved_by: transaction.approved_by,
          created_by: user.id_code
        }
      });
    } catch (error) {
      console.error('Create financial transaction error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Erro interno do servidor'
      });
    }
  }
);

router.patch(
  '/transactions/:id_code',
  authenticateToken,
  requireRole('admin', 'manager', 'master'),
  [
    body('type')
      .optional()
      .isIn(VALID_TYPES),
    body('description')
      .optional()
      .isString()
      .isLength({ min: 1 }),
    body('amount')
      .optional()
      .isFloat({ gt: 0 }),
    body('status')
      .optional()
      .isIn(VALID_STATUS),
    body('is_paid')
      .optional()
      .isBoolean(),
    body('nf')
      .optional({ nullable: true })
      .isString(),
    body('paid_at')
      .optional({ nullable: true })
      .isISO8601(),
    body('party_id')
      .optional({ nullable: true })
      .isString(),
    body('cost_center')
      .optional({ nullable: true })
      .isString(),
    body('category')
      .optional({ nullable: true })
      .isString(),
    body('payment_method')
      .optional({ nullable: true })
      .isIn(VALID_PAYMENT_METHODS),
    body('bank_account_id')
      .optional({ nullable: true })
      .isString(),
    body('attachment_url')
      .optional({ nullable: true })
      .isString(),
    body('store_id')
      .optional({ nullable: true })
      .isString(),
    body('approved_by')
      .optional({ nullable: true })
      .isString(),
    body('is_deleted')
      .optional()
      .isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const logicErrors = [];

    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Dados inválidos',
        details: errors.array()
      });
    }

    try {
      const transaction = await FinancialTransaction.findOne({
        where: { id_code: req.params.id_code }
      });

      if (!transaction) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Transação não encontrada'
        });
      }

      const existing = transaction.toJSON();

      if (existing.status === 'canceled') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Regras de negócio violadas',
          details: [
            {
              param: 'status',
              msg: 'Transações canceladas não podem ser alteradas.'
            }
          ]
        });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'due_date') &&
        req.body.due_date !== existing.due_date) {
        logicErrors.push({
          param: 'due_date',
          msg: 'due_date não pode ser alterada.'
        });
      }

      const type = req.body.type ?? existing.type;
      const nf = Object.prototype.hasOwnProperty.call(req.body, 'nf') ? req.body.nf : existing.nf;
      const description = req.body.description ?? existing.description;
      const amount = Object.prototype.hasOwnProperty.call(req.body, 'amount')
        ? req.body.amount
        : parseFloat(existing.amount);
      const party_id = Object.prototype.hasOwnProperty.call(req.body, 'party_id')
        ? req.body.party_id
        : existing.party_id;
      const cost_center = Object.prototype.hasOwnProperty.call(req.body, 'cost_center')
        ? req.body.cost_center
        : existing.cost_center;
      const category = Object.prototype.hasOwnProperty.call(req.body, 'category')
        ? req.body.category
        : existing.category;
      const status = req.body.status ?? existing.status;
      const is_paid = Object.prototype.hasOwnProperty.call(req.body, 'is_paid')
        ? req.body.is_paid
        : existing.is_paid;
      const payment_method = Object.prototype.hasOwnProperty.call(req.body, 'payment_method')
        ? req.body.payment_method
        : existing.payment_method;
      const bank_account_id = Object.prototype.hasOwnProperty.call(req.body, 'bank_account_id')
        ? req.body.bank_account_id
        : existing.bank_account_id;
      const attachment_url = Object.prototype.hasOwnProperty.call(req.body, 'attachment_url')
        ? req.body.attachment_url
        : existing.attachment_url;
      const store_id = Object.prototype.hasOwnProperty.call(req.body, 'store_id')
        ? req.body.store_id
        : existing.store_id;
      const approved_by = Object.prototype.hasOwnProperty.call(req.body, 'approved_by')
        ? req.body.approved_by
        : existing.approved_by;
      const paid_at = Object.prototype.hasOwnProperty.call(req.body, 'paid_at')
        ? req.body.paid_at
        : existing.paid_at;
      const is_deleted = Object.prototype.hasOwnProperty.call(req.body, 'is_deleted')
        ? req.body.is_deleted
        : existing.is_deleted;

      if (existing.status === 'paid') {
        if (status !== 'canceled') {
          return res.status(400).json({
            error: 'Validation error',
            message: 'Regras de negócio violadas',
            details: [
              {
                param: 'status',
                msg: 'Transações pagas só podem ser canceladas.'
              }
            ]
          });
        }

        const coreChanged =
          type !== existing.type ||
          nf !== existing.nf ||
          description !== existing.description ||
          amount !== parseFloat(existing.amount) ||
          party_id !== existing.party_id ||
          cost_center !== existing.cost_center ||
          category !== existing.category ||
          store_id !== existing.store_id ||
          approved_by !== existing.approved_by ||
          attachment_url !== existing.attachment_url;

        if (coreChanged) {
          return res.status(400).json({
            error: 'Validation error',
            message: 'Regras de negócio violadas',
            details: [
              {
                param: 'status',
                msg: 'Transações pagas não podem ter seus dados alterados; apenas cancelamento é permitido.'
              }
            ]
          });
        }

        if (is_deleted) {
          return res.status(400).json({
            error: 'Validation error',
            message: 'Regras de negócio violadas',
            details: [
              {
                param: 'is_deleted',
                msg: 'Transações pagas não podem ser excluídas; apenas cancelamento é permitido.'
              }
            ]
          });
        }

        await transaction.update({
          type: existing.type,
          nf: existing.nf,
          description: existing.description,
          amount: parseFloat(existing.amount),
          due_date: existing.due_date,
          paid_at: null,
          party_id: existing.party_id,
          cost_center: existing.cost_center,
          category: existing.category,
          is_paid: false,
          status: 'canceled',
          payment_method: null,
          bank_account_id: null,
          attachment_url: existing.attachment_url,
          store_id: existing.store_id,
          approved_by: existing.approved_by,
          is_deleted: false,
          updated_by_user_id: req.user.userId
        });

        await transaction.reload();

        const creator = await User.findByPk(transaction.created_by_user_id, {
          attributes: ['id_code']
        });

        return res.json({
          success: true,
          data: {
            id_code: transaction.id_code,
            type: transaction.type,
            nf: transaction.nf,
            description: transaction.description,
            amount: parseFloat(transaction.amount),
            currency: transaction.currency,
            issue_date: transaction.created_at.toISOString(),
            due_date: transaction.due_date,
            paid_at: transaction.paid_at,
            status: transaction.status,
            party_id: transaction.party_id,
            cost_center: transaction.cost_center,
            category: transaction.category,
            is_paid: transaction.is_paid,
            payment_method: transaction.payment_method,
            bank_account_id: transaction.bank_account_id,
            attachment_url: transaction.attachment_url,
            store_id: transaction.store_id,
            approved_by: transaction.approved_by,
            created_by: creator ? creator.id_code : null
          }
        });
      }

      if (is_paid && status !== 'paid') {
        logicErrors.push({
          param: 'status',
          msg: 'Quando is_paid é true, status deve ser "paid".'
        });
      }

      if (!is_paid && !['pending', 'canceled'].includes(status)) {
        logicErrors.push({
          param: 'status',
          msg: 'Quando is_paid é false, status deve ser "pending" ou "canceled".'
        });
      }

      if (status === 'paid') {
        if (!paid_at) {
          logicErrors.push({
            param: 'paid_at',
            msg: 'paid_at é obrigatório quando status é "paid".'
          });
        }
        if (!payment_method) {
          logicErrors.push({
            param: 'payment_method',
            msg: 'payment_method é obrigatório quando status é "paid".'
          });
        }
        if (payment_method && BANK_MOVEMENT_METHODS.includes(payment_method) && !bank_account_id) {
          logicErrors.push({
            param: 'bank_account_id',
            msg: 'bank_account_id é obrigatório para métodos que movimentam conta bancária.'
          });
        }
      } else {
        if (paid_at) {
          logicErrors.push({
            param: 'paid_at',
            msg: 'paid_at deve ser nulo ou ausente quando status não é "paid".'
          });
        }
        if (payment_method) {
          logicErrors.push({
            param: 'payment_method',
            msg: 'payment_method deve ser nulo ou ausente quando status não é "paid".'
          });
        }
        if (bank_account_id) {
          logicErrors.push({
            param: 'bank_account_id',
            msg: 'bank_account_id deve ser nulo ou ausente quando status não é "paid".'
          });
        }
      }

      if (logicErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Regras de negócio violadas',
          details: logicErrors
        });
      }

      await transaction.update({
        type,
        nf: nf || null,
        description,
        amount,
        due_date: existing.due_date,
        paid_at: status === 'paid' ? paid_at : null,
        party_id: party_id || null,
        cost_center: cost_center || null,
        category: category || null,
        is_paid,
        status,
        payment_method: status === 'paid' ? payment_method : null,
        bank_account_id: status === 'paid' ? bank_account_id || null : null,
        attachment_url: attachment_url || null,
        store_id: store_id || null,
        approved_by: approved_by || null,
        is_deleted,
        updated_by_user_id: req.user.userId
      });

      await transaction.reload();

      const creator = await User.findByPk(transaction.created_by_user_id, {
        attributes: ['id_code']
      });

      return res.json({
        success: true,
        data: {
          id_code: transaction.id_code,
          type: transaction.type,
          nf: transaction.nf,
          description: transaction.description,
          amount: parseFloat(transaction.amount),
          currency: transaction.currency,
          issue_date: transaction.created_at.toISOString(),
          due_date: transaction.due_date,
          paid_at: transaction.paid_at,
          status: transaction.status,
          party_id: transaction.party_id,
          cost_center: transaction.cost_center,
          category: transaction.category,
          is_paid: transaction.is_paid,
          payment_method: transaction.payment_method,
          bank_account_id: transaction.bank_account_id,
          attachment_url: transaction.attachment_url,
          store_id: transaction.store_id,
          approved_by: transaction.approved_by,
          created_by: creator ? creator.id_code : null
        }
      });
    } catch (error) {
      console.error('Update financial transaction error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Erro ao atualizar transação'
      });
    }
  }
);

module.exports = router;
