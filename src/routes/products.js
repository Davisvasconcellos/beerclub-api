const express = require('express');
const { body, validationResult } = require('express-validator');
const { Product, Category, Bar } = require('../models');
const { requireRole, authenticateToken, requireModule } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Listar produtos
 *     tags: [Products]
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
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de produtos
 */
router.get('/', authenticateToken, requireModule('pub'), async (req, res) => {
  try {
    const { page = 1, limit = 10, categoryId, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.name = { [require('sequelize').Op.like]: `%${search}%` };
    }

    // Filtrar por bar se não for masteradmin
    if (req.user.role !== 'masteradmin') {
      where.barId = req.user.barId;
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Bar,
          as: 'bar',
          attributes: ['id', 'name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Obter produto por ID
 *     tags: [Products]
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
 *         description: Dados do produto
 */
router.get('/:id', authenticateToken, requireModule('pub'), async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Bar,
          as: 'bar',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      data: { product }
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Criar novo produto
 *     tags: [Products]
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
 *               - price
 *               - categoryId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: integer
 *               image:
 *                 type: string
 *               available:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 */
router.post('/', requireRole('admin', 'gerente'), requireModule('pub'), [
  body('name').isLength({ min: 2, max: 100 }).trim().withMessage('O nome deve ter entre 2 e 100 caracteres'),
  body('description').optional().isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres'),
  body('price').isFloat({ min: 0 }).withMessage('O preço deve ser um número válido'),
  body('categoryId').isInt().withMessage('O ID da categoria deve ser um número inteiro'),
  body('image').optional().isURL().withMessage('A URL da imagem é inválida'),
  body('available').optional().isBoolean().withMessage('O valor de "available" deve ser booleano')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Dados inválidos',
        details: errors.array()
      });
    }

    const { name, description, price, categoryId, image, available = true } = req.body;

    const product = await Product.create({
      name,
      description,
      price,
      categoryId,
      image,
      available,
      barId: req.user.barId
    });

    res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      data: { product }
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     summary: Atualizar produto
 *     tags: [Products]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: integer
 *               image:
 *                 type: string
 *               available:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 */
router.put('/:id', requireRole('admin', 'gerente'), [
  body('name').optional().isLength({ min: 2, max: 100 }).trim().withMessage('O nome deve ter entre 2 e 100 caracteres'),
  body('description').optional().isLength({ max: 500 }).withMessage('A descrição não pode exceder 500 caracteres'),
  body('price').optional().isFloat({ min: 0 }).withMessage('O preço deve ser um número válido'),
  body('categoryId').optional().isInt().withMessage('O ID da categoria deve ser um número inteiro'),
  body('image').optional().isURL().withMessage('A URL da imagem é inválida'),
  body('available').optional().isBoolean().withMessage('O valor de "available" deve ser booleano')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Dados inválidos',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o produto pertence ao bar do usuário
    if (product.barId !== req.user.barId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Acesso negado'
      });
    }

    await product.update(updateData);

    res.json({
      success: true,
      message: 'Produto atualizado com sucesso',
      data: { product }
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     summary: Deletar produto
 *     tags: [Products]
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
 *         description: Produto deletado com sucesso
 */
router.delete('/:id', requireRole('admin', 'gerente'), async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o produto pertence ao bar do usuário
    if (product.barId !== req.user.barId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Acesso negado'
      });
    }

    await product.destroy();

    res.json({
      success: true,
      message: 'Produto deletado com sucesso'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router; 