const express = require('express');
const { body, validationResult } = require('express-validator');
const { sequelize, Store, User, Product, StoreUser, StoreSchedule, ApVendor, ApPayable, ApPayment } = require('../models');
const { authenticateToken, requireRole } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /api/v1/stores:
 *   get:
 *     summary: Listar lojas
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de lojas
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = { [require('sequelize').Op.like]: `%${search}%` };
    }

    // Se não for 'master', filtra as lojas para mostrar apenas as que o usuário é proprietário
    if (req.user.role !== 'master') {
      where.owner_id = req.user.userId;
    }

    // Calcula o total de lojas que o usuário pode ver
    let totalPlatformStores;
    if (req.user.role === 'master') {
      // Para master, conta todas as lojas da plataforma.
      totalPlatformStores = await Store.count();
    } else {
      // Para outros usuários, conta apenas as lojas que eles possuem.
      // O `where` já contém o filtro de owner_id.
      totalPlatformStores = await Store.count({ where });
    }

    const { count, rows: stores } = await Store.findAndCountAll({
      where,
      // Os campos novos já são retornados por padrão, pois não há `attributes` limitando a busca principal.
      include: [
        {
          model: User, as: 'owner', attributes: ['id_code', 'name', 'email']
        }, {
          model: User,
          as: 'users',
          attributes: ['id_code', 'name', 'role'],
          through: { attributes: ['role'] }
        },
        {
          model: StoreSchedule,
          as: 'schedules',
          attributes: { exclude: ['id', 'store_id', 'created_at', 'updated_at'] }
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        ['created_at', 'DESC'],
        // Garante que os horários dentro de cada loja venham ordenados por dia da semana
        [{ model: StoreSchedule, as: 'schedules' }, 'day_of_week', 'ASC']
      ]
    });

    const responseData = {
      stores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    };    responseData.totalPlatformStores = totalPlatformStores;

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('List stores error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/stores/{id_code}:
 *   get:
 *     summary: Obter loja por ID Code
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados da loja
 */
router.get('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;

    const store = await Store.findOne({
      where: { id_code },
      // Os campos novos já são retornados por padrão, pois não há `attributes` limitando a busca principal.
      include: [
        {
          model: User, as: 'owner', attributes: ['id_code', 'name', 'email']
        },
        {
          model: User,
          as: 'users',
          attributes: ['id_code', 'name', 'email', 'role'],
          through: { attributes: ['role'] }
        },
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name', 'normal_price', 'price_plan_1', 'price_plan_2', 'price_plan_3']
        }
      ]
    });

    if (!store) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Loja não encontrada'
      });
    }

    // Adiciona o include dos horários aqui também
    store.dataValues.schedules = await StoreSchedule.findAll({
      where: { store_id: store.id },
      order: [['day_of_week', 'ASC']],
      attributes: { exclude: ['id', 'store_id', 'created_at', 'updated_at'] }
    });

    res.json({
      success: true,
      data: store
    });

  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/stores:
 *   post:
 *     summary: Criar nova loja
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - legal_responsible
 *               - cnpj
 *               - description
 *     responses:
 *       201:
 *         description: Loja criada com sucesso
 */
router.post('/', 
  authenticateToken,
  requireRole(['admin']),
  [
    // Validações existentes
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Nome deve ter entre 2 e 255 caracteres'),
    body('email').isEmail().withMessage('Email inválido'),
    body('cnpj').isLength({ min: 14, max: 18 }).withMessage('CNPJ inválido'),
    body('logo_url').optional().isURL({ require_tld: false }).withMessage('URL do logo inválida'),
    body('instagram_handle').optional().trim().isLength({ max: 100 }).withMessage('Instagram deve ter no máximo 100 caracteres'),
    body('facebook_handle').optional().trim().isLength({ max: 100 }).withMessage('Facebook deve ter no máximo 100 caracteres'),
    // Novas validações
    body('capacity').optional().isInt({ min: 0 }).withMessage('Capacidade deve ser um número inteiro positivo'),
    body('type').optional().isIn(['bar', 'restaurante', 'pub', 'cervejaria', 'casa noturna', 'distribuidora']).withMessage('Tipo de estabelecimento inválido'),
    body('legal_name').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('address_street').optional().isString().trim(),
    body('address_neighborhood').optional().isString().trim(),
    body('address_state').optional().isString().trim().isLength({ min: 2, max: 2 }).withMessage('UF deve ter 2 caracteres'),
    body('address_number').optional().isString().trim(),
    body('address_complement').optional().isString().trim(),
    body('banner_url').optional().isURL({ require_tld: false }).withMessage('URL do banner inválida'),
    body('website').optional().isURL({ require_tld: false }).withMessage('URL do site inválida'),
    body('latitude').optional().isDecimal().withMessage('Latitude inválida'),
    body('longitude').optional().isDecimal().withMessage('Longitude inválida'),
    body('zip_code').optional().isString().trim(), // Movido para manter a ordem
    body('description').optional().isString().trim().escape().withMessage('Descrição inválida')
  ],
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Dados inválidos',
          details: errors.array()
        });
      }

      const {
        name,
        email,
        cnpj,
        logo_url,
        instagram_handle,
        facebook_handle,
        // Novos campos
        capacity,
        type,
        legal_name,
        phone,
        address_street,
        address_neighborhood,
        address_state,
        address_number,
        address_complement,
        banner_url,
        website,
        latitude,
        longitude,
        zip_code,
        description
      } = req.body;

      // Verificar se CNPJ já existe
      const existingStore = await Store.findOne({ where: { cnpj } });
      if (existingStore) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'CNPJ já utilizado'
        });
      }

      const store = await Store.create(
        {
          name,
          owner_id: req.user.userId, // Atribui o usuário logado como dono
          email,
          cnpj,
          logo_url,
          instagram_handle,
          facebook_handle,
          // Novos campos
          capacity,
          type,
          legal_name,
          phone,
          zip_code,
          address_street,
          address_neighborhood,
          address_state,
          address_number,
          address_complement,
          banner_url,
          website,
          latitude,
          longitude,
          description
        },
        { transaction }
      );

      // Criar os 7 dias de horário padrão (fechado)
      const schedules = [];
      for (let i = 0; i < 7; i++) {
        schedules.push({
          store_id: store.id,
          day_of_week: i,
          is_open: false
        });
      }
      await StoreSchedule.bulkCreate(schedules, { transaction });

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: 'Loja criada com sucesso',
        data: store // O hook afterCreate do id_code ainda funcionará
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Create store error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/stores/{id_code}:
 *   put:
 *     summary: Atualizar loja
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Loja atualizada com sucesso
 */
router.put('/:id_code',
  authenticateToken,
  requireRole(['admin', 'manager']),
  [
    // Campos originais
    body('name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Nome deve ter entre 2 e 255 caracteres'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('cnpj').optional().isLength({ min: 14, max: 18 }).withMessage('CNPJ inválido'),
    body('logo_url').optional().isURL({ require_tld: false }).withMessage('URL do logo inválida'),
    body('instagram_handle').optional().trim().isLength({ max: 100 }).withMessage('Instagram deve ter no máximo 100 caracteres'),
    body('facebook_handle').optional().trim().isLength({ max: 100 }).withMessage('Facebook deve ter no máximo 100 caracteres'),
    // Novos campos
    body('capacity').optional().isInt({ min: 0 }).withMessage('Capacidade deve ser um número inteiro positivo'),
    body('type').optional().isIn(['bar', 'restaurante', 'pub', 'cervejaria', 'casa noturna', 'distribuidora']).withMessage('Tipo de estabelecimento inválido'),
    body('legal_name').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('address_street').optional().isString().trim(),
    body('address_neighborhood').optional().isString().trim(),
    body('address_state').optional().isString().trim().isLength({ min: 2, max: 2 }).withMessage('UF deve ter 2 caracteres'),
    body('address_number').optional().isString().trim(),
    body('address_complement').optional().isString().trim(),
    body('banner_url').optional().isURL({ require_tld: false }).withMessage('URL do banner inválida'),
    body('website').optional().isURL({ require_tld: false }).withMessage('URL do site inválida'),
    body('latitude').optional().isDecimal().withMessage('Latitude inválida'),
    body('longitude').optional().isDecimal().withMessage('Longitude inválida'),
    body('zip_code').optional().isString().trim(), // Movido para manter a ordem
    body('description').optional().isString().trim().escape().withMessage('Descrição inválida')
  ],
  async (req, res) => {
    try {
      const { id_code } = req.params;
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Dados inválidos',
          details: errors.array()
        });
      }

      const store = await Store.findOne({ where: { id_code } });
      if (!store) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Loja não encontrada'
        });
      }

      // Verificar permissão
      // O proprietário da loja (owner) ou um 'master' podem editar.
      // Um 'manager' associado à loja também pode editar.
      const isOwner = store.owner_id === req.user.userId;
      const isMaster = req.user.role === 'master';

      if (!isOwner && !isMaster && req.user.role !== 'admin') {
        const storeUser = await StoreUser.findOne({
          where: { user_id: req.user.id, store_id: store.id }
        });
        if (!storeUser) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Sem permissão para editar esta loja'
          });
        }
      }

      // Regra especial para atualização de CNPJ
      const isCnpjUpdateAttempt = req.body.cnpj && req.body.cnpj !== store.cnpj;

      if (isCnpjUpdateAttempt) {
        // REGRA 1: Apenas 'master' pode TENTAR alterar o CNPJ.
        if (req.user.role !== 'master') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Apenas um usuário master pode alterar o CNPJ.'
          });
        }

        // REGRA 2: Se for master, verificar se o NOVO CNPJ já existe em outra loja.
        const existingStore = await Store.findOne({ where: { cnpj: req.body.cnpj } });
        if (existingStore) {
          return res.status(400).json({ error: 'Validation error', message: 'CNPJ já utilizado por outra loja.' });
        }
      }

      // Se não for master, remove o campo CNPJ do corpo da requisição para garantir que ele não seja atualizado.
      if (req.user.role !== 'master') {
        delete req.body.cnpj;
      }

      await store.update(req.body);

      res.json({
        success: true,
        message: 'Loja atualizada com sucesso',
        data: store
      });

    } catch (error) {
      console.error('Update store error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/stores/{id_code}:
 *   delete:
 *     summary: Deletar loja
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loja deletada com sucesso
 */
router.delete('/:id_code',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { id_code } = req.params;

      const store = await Store.findOne({ where: { id_code } });
      if (!store) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Loja não encontrada'
        });
      }

      // Verificar se há produtos associados
      const productCount = await Product.count({ where: { store_id: store.id } });
      if (productCount > 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Não é possível deletar uma loja que possui produtos'
        });
      }

      await store.destroy();

      res.json({
        success: true,
        message: 'Loja deletada com sucesso'
      });

    } catch (error) {
      console.error('Delete store error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/stores/{id_code}/schedule:
 *   put:
 *     summary: Atualizar os horários de funcionamento de uma loja
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_code
 *         required: true
 *         schema:
 *           type: string
 *         description: O ID Code da loja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 day_of_week:
 *                   type: integer
 *                   example: 1
 *                 is_open:
 *                   type: boolean
 *                   example: true
 *                 opening_time:
 *                   type: string
 *                   example: "09:00"
 *                 closing_time:
 *                   type: string
 *                   example: "22:00"
 *     responses:
 *       200:
 *         description: Horários atualizados com sucesso
 */
router.put('/:id_code/schedule',
  authenticateToken,
  requireRole(['admin', 'manager']),
  [
    body().isArray({ min: 1, max: 7 }).withMessage('O corpo da requisição deve ser um array com 1 a 7 dias.'),
    body('*.day_of_week').isInt({ min: 0, max: 6 }).withMessage('day_of_week deve ser um número entre 0 e 6.'),
    body('*.is_open').isBoolean().withMessage('is_open deve ser um valor booleano.'),
    body('*.opening_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional({ nullable: true }).withMessage('opening_time deve estar no formato HH:MM.'),
    body('*.closing_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional({ nullable: true }).withMessage('closing_time deve estar no formato HH:MM.')
  ],
  async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { id_code } = req.params;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', details: errors.array() });
      }

      const store = await Store.findOne({ where: { id_code } });
      if (!store) {
        return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
      }

      // Verificar permissão (proprietário, master, admin ou manager da loja)
      const isOwner = store.owner_id === req.user.userId;
      const isMaster = req.user.role === 'master';
      if (!isOwner && !isMaster && req.user.role !== 'admin') {
        const storeUser = await StoreUser.findOne({ where: { user_id: req.user.userId, store_id: store.id } });
        if (!storeUser) {
          return res.status(403).json({ error: 'Forbidden', message: 'Sem permissão para editar os horários desta loja' });
        }
      }

      const schedules = req.body;

      for (const schedule of schedules) {
        await StoreSchedule.update(
          {
            is_open: schedule.is_open,
            opening_time: schedule.is_open ? schedule.opening_time : null,
            closing_time: schedule.is_open ? schedule.closing_time : null,
          },
          {
            where: { store_id: store.id, day_of_week: schedule.day_of_week },
            transaction
          }
        );
      }

      await transaction.commit();

      // Após o commit, busca e retorna todos os horários atualizados da loja
      const updatedSchedules = await StoreSchedule.findAll({
        where: { store_id: store.id },
        order: [['day_of_week', 'ASC']],
        attributes: { exclude: ['id', 'store_id', 'created_at', 'updated_at'] }
      });

      res.json({
        success: true,
        message: 'Horários de funcionamento atualizados com sucesso.',
        data: updatedSchedules
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Update schedule error:', error);
      res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
    }
  }
);

/**
 * @swagger
 * /api/v1/stores/{storeId}/vendors:
 *   get:
 *     summary: Listar fornecedores da loja
 *     tags: [Accounts Payable]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de fornecedores
 */
router.get('/:storeId/vendors', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
    if (req.user.role !== 'master' && store.owner_id !== req.user.userId) return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    const where = { store_id: store.id };
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { document: { [Op.like]: `%${search}%` } }
      ];
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await ApVendor.findAndCountAll({ where, order: [['name', 'ASC']], limit: parseInt(limit), offset });
    return res.json({ success: true, data: rows, meta: { page: parseInt(page), limit: parseInt(limit), total: count } });
  } catch (error) {
    console.error('List vendors error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/vendors:
 *   post:
 *     summary: Criar fornecedor
 *     tags: [Accounts Payable]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               document: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               bank_info: { type: object }
 *     responses:
 *       201:
 *         description: Fornecedor criado
 */
router.post('/:storeId/vendors', authenticateToken, requireRole('admin', 'master'), [
  body('name').isLength({ min: 2 }),
  body('document').optional().isString(),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('bank_info').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  try {
    const { storeId } = req.params;
    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
    if (req.user.role !== 'master' && store.owner_id !== req.user.userId) return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    const { name, document, email, phone, bank_info } = req.body || {};
    const vendor = await ApVendor.create({ store_id: store.id, name, document, email, phone, bank_info });
    return res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    console.error('Create vendor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/payables:
 *   get:
 *     summary: Listar contas a pagar
 *     tags: [Accounts Payable]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, scheduled, paid, overdue, canceled] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Lista de títulos
 */
router.get('/:storeId/payables', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 20, status, from, to, order = 'asc' } = req.query;
    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
    if (req.user.role !== 'master' && store.owner_id !== req.user.userId) return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    const { Op } = require('sequelize');
    const where = { store_id: store.id };
    if (status) where.status = status;
    if (from || to) {
      where.due_date = {};
      if (from) where.due_date[Op.gte] = from;
      if (to) where.due_date[Op.lte] = to;
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await ApPayable.findAndCountAll({ where, include: [{ model: ApVendor, as: 'vendor', attributes: ['id', 'id_code', 'name'] }], order: [['due_date', order.toLowerCase() === 'desc' ? 'DESC' : 'ASC']], limit: parseInt(limit), offset });
    return res.json({ success: true, data: rows, meta: { page: parseInt(page), limit: parseInt(limit), total: count } });
  } catch (error) {
    console.error('List payables error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/payables:
 *   post:
 *     summary: Criar título a pagar
 *     tags: [Accounts Payable]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendor_id, amount, due_date]
 *             properties:
 *               vendor_id: { type: integer }
 *               amount: { type: number }
 *               currency: { type: string, default: BRL }
 *               issue_date: { type: string, format: date }
 *               due_date: { type: string, format: date }
 *               invoice_number: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               cost_center: { type: string }
 *               attachment_url: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Título criado
 */
router.post('/:storeId/payables', authenticateToken, requireRole('admin', 'master'), [
  body('vendor_id').isInt({ min: 1 }),
  body('amount').isFloat({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('issue_date').optional().isISO8601(),
  body('due_date').isISO8601(),
  body('invoice_number').optional().isString(),
  body('description').optional().isString(),
  body('category').optional().isString(),
  body('cost_center').optional().isString(),
  body('attachment_url').optional().isURL()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  try {
    const { storeId } = req.params;
    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
    if (req.user.role !== 'master' && store.owner_id !== req.user.userId) return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    const { vendor_id, amount, currency = 'BRL', issue_date, due_date, invoice_number, description, category, cost_center, attachment_url } = req.body || {};
    const existsVendor = await ApVendor.findOne({ where: { id: vendor_id, store_id: store.id } });
    if (!existsVendor) return res.status(404).json({ error: 'Not Found', message: 'Fornecedor não encontrado na loja' });
    const payable = await ApPayable.create({ store_id: store.id, vendor_id, amount, currency, issue_date, due_date, invoice_number, description, category, cost_center, attachment_url, created_by_user_id: req.user.userId });
    return res.status(201).json({ success: true, data: payable });
  } catch (error) {
    console.error('Create payable error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/payables/{id}/status:
 *   patch:
 *     summary: Atualizar status do título
 *     tags: [Accounts Payable]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, approved, scheduled, paid, overdue, canceled] }
 *               paid_at: { type: string, format: date-time }
 *               conciliated_by: { type: string, enum: [system, manual, gpt] }
 *               conciliated_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Título atualizado
 */
router.patch('/:storeId/payables/:id/status', authenticateToken, requireRole('admin', 'master'), [
  body('status').isIn(['pending','approved','scheduled','paid','overdue','canceled']),
  body('paid_at').optional().isISO8601(),
  body('conciliated_by').optional().isIn(['system','manual','gpt']),
  body('conciliated_at').optional().isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  try {
    const { storeId, id } = req.params;
    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
    if (req.user.role !== 'master' && store.owner_id !== req.user.userId) return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    const payable = await ApPayable.findOne({ where: { id, store_id: store.id } });
    if (!payable) return res.status(404).json({ error: 'Not Found', message: 'Título não encontrado' });
    const { status, paid_at, conciliated_by, conciliated_at } = req.body || {};
    const update = { status };
    if (status === 'paid' && !paid_at) update.paid_at = new Date();
    if (paid_at) update.paid_at = new Date(paid_at);
    if (conciliated_by) update.conciliated_by = conciliated_by;
    if (conciliated_at) update.conciliated_at = new Date(conciliated_at);
    await payable.update(update);
    return res.json({ success: true, data: payable });
  } catch (error) {
    console.error('Update payable status error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/stores/{storeId}/payables/{id}/payments:
 *   post:
 *     summary: Registrar pagamento do título
 *     tags: [Accounts Payable]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, paid_at, method]
 *             properties:
 *               amount: { type: number }
 *               paid_at: { type: string, format: date-time }
 *               method: { type: string, enum: [pix, bank_transfer, cash, card] }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Pagamento registrado
 */
router.post('/:storeId/payables/:id/payments', authenticateToken, requireRole('admin', 'master'), [
  body('amount').isFloat({ min: 0 }),
  body('paid_at').isISO8601(),
  body('method').isIn(['pix','bank_transfer','cash','card']),
  body('notes').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  try {
    const { storeId, id } = req.params;
    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ error: 'Not Found', message: 'Loja não encontrada' });
    if (req.user.role !== 'master' && store.owner_id !== req.user.userId) return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    const payable = await ApPayable.findOne({ where: { id, store_id: store.id } });
    if (!payable) return res.status(404).json({ error: 'Not Found', message: 'Título não encontrado' });
    const { amount, paid_at, method, notes } = req.body || {};
    const payment = await ApPayment.create({ payable_id: payable.id, amount, paid_at: new Date(paid_at), method, notes, created_by_user_id: req.user.userId });
    const totalPaid = await ApPayment.sum('amount', { where: { payable_id: payable.id } });
    if (totalPaid >= Number(payable.amount)) {
      await payable.update({ status: 'paid', paid_at: payable.paid_at || new Date(paid_at) });
    }
    return res.status(201).json({ success: true, data: { payment, payable_status: payable.status, total_paid: totalPaid } });
  } catch (error) {
    console.error('Register payment error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

module.exports = router; 
