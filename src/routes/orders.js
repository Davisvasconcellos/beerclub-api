const express = require('express');
const { body, validationResult } = require('express-validator');
const { Order, OrderItem, Product, User, Bar } = require('../models');
const { requireRole, authenticateToken, requireModule } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Listar pedidos
 *     tags: [Orders]
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de pedidos
 */
router.get('/', authenticateToken, requireModule('pub'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;

    // Filtrar por usuário ou bar
    if (req.user.role === 'cliente') {
      where.userId = req.user.id;
    } else if (req.user.role !== 'masteradmin') {
      where.barId = req.user.barId;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Bar,
          as: 'bar',
          attributes: ['id', 'name']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'image']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Obter pedido por ID
 *     tags: [Orders]
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
 *         description: Dados do pedido
 */
router.get('/:id', authenticateToken, requireModule('pub'), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Bar,
          as: 'bar',
          attributes: ['id', 'name']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'image']
            }
          ]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Pedido não encontrado'
      });
    }

    // Verificar permissão
    if (req.user.role === 'cliente' && order.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Acesso negado'
      });
    }

    if (req.user.role !== 'masteradmin' && req.user.role !== 'cliente' && order.barId !== req.user.barId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Acesso negado'
      });
    }

    res.json({
      success: true,
      data: { order }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Criar novo pedido
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     quantity:
 *                       type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 */
router.post('/', [
  authenticateToken,
  requireModule('pub'),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isInt(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('notes').optional().isLength({ max: 500 })
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

    const { items, notes } = req.body;

    // Verificar se todos os produtos existem e estão disponíveis
    const productIds = items.map(item => item.productId);
    const products = await Product.findAll({
      where: { id: productIds, available: true }
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        error: 'Invalid products',
        message: 'Alguns produtos não estão disponíveis'
      });
    }

    // Calcular total
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal
      });
    }

    // Criar pedido
    const order = await Order.create({
      userId: req.user.id,
      barId: products[0].barId, // Assumindo que todos os produtos são do mesmo bar
      total,
      notes,
      status: 'pending'
    });

    // Criar itens do pedido
    await OrderItem.bulkCreate(
      orderItems.map(item => ({
        ...item,
        orderId: order.id
      }))
    );

    // Buscar pedido com relacionamentos
    const createdOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'image']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Pedido criado com sucesso',
      data: { order: createdOrder }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/orders/{id}/status:
 *   put:
 *     summary: Atualizar status do pedido
 *     tags: [Orders]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, preparing, ready, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 */
router.put('/:id/status', requireRole('admin', 'gerente', 'garcom'), requireModule('pub'), [
  body('status').isIn(['pending', 'preparing', 'ready', 'delivered', 'cancelled'])
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
    const { status } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Pedido não encontrado'
      });
    }

    // Verificar se o pedido pertence ao bar do usuário
    if (order.barId !== req.user.barId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Acesso negado'
      });
    }

    await order.update({ status });

    res.json({
      success: true,
      message: 'Status do pedido atualizado com sucesso',
      data: { order }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router; 