const express = require('express');
const { body, validationResult } = require('express-validator');
const { sequelize, Store, User, Product, StoreUser, StoreSchedule } = require('../models');
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
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
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
    body('logo_url').optional().isURL().withMessage('URL do logo inválida'),
    body('instagram_handle').optional().trim().isLength({ max: 100 }).withMessage('Instagram deve ter no máximo 100 caracteres'),
    body('facebook_handle').optional().trim().isLength({ max: 100 }).withMessage('Facebook deve ter no máximo 100 caracteres'),
    // Novas validações
    body('capacity').optional().isInt({ min: 0 }).withMessage('Capacidade deve ser um número inteiro positivo'),
    body('type').optional().isIn(['bar', 'restaurante', 'pub', 'cervejaria', 'casa noturna']).withMessage('Tipo de estabelecimento inválido'),
    body('legal_name').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('zip_code').optional().isString().trim(),
    body('address_street').optional().isString().trim(),
    body('address_neighborhood').optional().isString().trim(),
    body('address_state').optional().isString().trim().isLength({ min: 2, max: 2 }).withMessage('UF deve ter 2 caracteres'),
    body('address_number').optional().isString().trim(),
    body('address_complement').optional().isString().trim(),
    body('banner_url').optional().isURL().withMessage('URL do banner inválida'),
    body('website').optional().isURL().withMessage('URL do site inválida'),
    body('latitude').optional().isDecimal().withMessage('Latitude inválida'),
    body('longitude').optional().isDecimal().withMessage('Longitude inválida')
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
        zip_code,
        address_street,
        address_neighborhood,
        address_state,
        address_number,
        address_complement,
        banner_url,
        website,
        latitude,
        longitude
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
          longitude
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
    body('logo_url').optional().isURL().withMessage('URL do logo inválida'),
    body('instagram_handle').optional().trim().isLength({ max: 100 }).withMessage('Instagram deve ter no máximo 100 caracteres'),
    body('facebook_handle').optional().trim().isLength({ max: 100 }).withMessage('Facebook deve ter no máximo 100 caracteres'),
    // Novos campos
    body('capacity').optional().isInt({ min: 0 }).withMessage('Capacidade deve ser um número inteiro positivo'),
    body('type').optional().isIn(['bar', 'restaurante', 'pub', 'cervejaria', 'casa noturna']).withMessage('Tipo de estabelecimento inválido'),
    body('legal_name').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('zip_code').optional().isString().trim(),
    body('address_street').optional().isString().trim(),
    body('address_neighborhood').optional().isString().trim(),
    body('address_state').optional().isString().trim().isLength({ min: 2, max: 2 }).withMessage('UF deve ter 2 caracteres'),
    body('address_number').optional().isString().trim(),
    body('address_complement').optional().isString().trim(),
    body('banner_url').optional().isURL().withMessage('URL do banner inválida'),
    body('website').optional().isURL().withMessage('URL do site inválida'),
    body('latitude').optional().isDecimal().withMessage('Latitude inválida'),
    body('longitude').optional().isDecimal().withMessage('Longitude inválida')
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

module.exports = router; 