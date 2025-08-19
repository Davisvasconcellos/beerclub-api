const express = require('express');
const { body, validationResult } = require('express-validator');
const { Store, User, Product, StoreUser } = require('../models');
const { requireRole } = require('../middlewares/auth');

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
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = { [require('sequelize').Op.like]: `%${search}%` };
    }

    // Se não for admin, mostrar apenas as lojas do usuário
    if (req.user.role !== 'admin') {
      const storeUsers = await StoreUser.findAll({
        where: { user_id: req.user.id },
        include: [{ model: Store, as: 'store' }]
      });
      const storeIds = storeUsers.map(su => su.store_id);
      where.id = { [require('sequelize').Op.in]: storeIds };
    }

    const { count, rows: stores } = await Store.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'role'],
          through: { attributes: ['role'] }
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        stores,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
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
 * /api/v1/stores/{id}:
 *   get:
 *     summary: Obter loja por ID
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dados da loja
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const store = await Store.findByPk(id, {
      include: [
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'email', 'role'],
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
 *               - email
 *               - cnpj
 *     responses:
 *       201:
 *         description: Loja criada com sucesso
 */
router.post('/', 
  requireRole(['admin']),
  [
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Nome deve ter entre 2 e 255 caracteres'),
    body('legal_responsible').trim().isLength({ min: 2, max: 255 }).withMessage('Responsável legal deve ter entre 2 e 255 caracteres'),
    body('email').isEmail().withMessage('Email inválido'),
    body('cnpj').isLength({ min: 14, max: 18 }).withMessage('CNPJ inválido'),
    body('logo_url').optional().isURL().withMessage('URL do logo inválida'),
    body('instagram_handle').optional().trim().isLength({ max: 100 }).withMessage('Instagram deve ter no máximo 100 caracteres'),
    body('facebook_handle').optional().trim().isLength({ max: 100 }).withMessage('Facebook deve ter no máximo 100 caracteres')
  ],
  async (req, res) => {
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
        legal_responsible,
        email,
        cnpj,
        logo_url,
        instagram_handle,
        facebook_handle
      } = req.body;

      // Verificar se CNPJ já existe
      const existingStore = await Store.findOne({ where: { cnpj } });
      if (existingStore) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'CNPJ já cadastrado'
        });
      }

      const store = await Store.create({
        name,
        legal_responsible,
        email,
        cnpj,
        logo_url,
        instagram_handle,
        facebook_handle
      });

      res.status(201).json({
        success: true,
        message: 'Loja criada com sucesso',
        data: store
      });

    } catch (error) {
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
 * /api/v1/stores/{id}:
 *   put:
 *     summary: Atualizar loja
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
router.put('/:id',
  requireRole(['admin', 'manager']),
  [
    body('name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Nome deve ter entre 2 e 255 caracteres'),
    body('legal_responsible').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Responsável legal deve ter entre 2 e 255 caracteres'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('logo_url').optional().isURL().withMessage('URL do logo inválida'),
    body('instagram_handle').optional().trim().isLength({ max: 100 }).withMessage('Instagram deve ter no máximo 100 caracteres'),
    body('facebook_handle').optional().trim().isLength({ max: 100 }).withMessage('Facebook deve ter no máximo 100 caracteres')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Dados inválidos',
          details: errors.array()
        });
      }

      const store = await Store.findByPk(id);
      if (!store) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Loja não encontrada'
        });
      }

      // Verificar permissão (apenas admin pode editar qualquer loja)
      if (req.user.role !== 'admin') {
        const storeUser = await StoreUser.findOne({
          where: { user_id: req.user.id, store_id: id }
        });
        if (!storeUser) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Sem permissão para editar esta loja'
          });
        }
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
 * /api/v1/stores/{id}:
 *   delete:
 *     summary: Deletar loja
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Loja deletada com sucesso
 */
router.delete('/:id',
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;

      const store = await Store.findByPk(id);
      if (!store) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Loja não encontrada'
        });
      }

      // Verificar se há produtos associados
      const productCount = await Product.count({ where: { store_id: id } });
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

module.exports = router; 