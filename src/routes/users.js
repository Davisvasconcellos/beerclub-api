const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { sequelize, User, Plan, Store, StoreUser, Order, FootballTeam } = require('../models');
const { requireRole, authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Rota teste - antes da rota dinâmica
router.get('/teste', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  console.log('Rota /teste chamada');
  console.log('Usuário do token:', req.user);

  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] }
    });
    console.log(`Encontrados ${users.length} usuários`);

    res.json({
      success: true,
      tokenUserRole: req.user.role,
      users
    });
  } catch (error) {
    console.error('Erro no /teste:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});



// Lista usuários que fizeram pedidos em uma store específica
router.get('/store-users/:storeId', authenticateToken, async (req, res) => {
  const { storeId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const user = req.user;
    console.log('Usuário autenticado:', user);

    // Se não for master, verifica se é admin/manager/waiter da loja
    if (user.role !== 'master') {
      const storeUser = await StoreUser.findOne({
        where: {
          store_id: storeId,
          user_id: user.id,
          role: ['admin', 'manager', 'waiter']
        }
      });

      if (!storeUser) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
    }

    // Buscar usuários distintos que fizeram pedidos nessa store
    const users = await User.findAndCountAll({
      include: [{
        model: Order,
        as: 'orders',          // **importante**: usar o alias correto da associação
        where: { store_id: storeId },
        attributes: []
      }],
      distinct: true,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: ['id', 'id_code', 'name', 'email', 'phone', 'role', 'plan_id', 'plan_start', 'plan_end', 'created_at']
    });

    return res.json({
      success: true,
      total: users.count,
      page: parseInt(page),
      pages: Math.ceil(users.count / limit),
      users: users.rows
    });

  } catch (error) {
    console.error('Erro ao buscar usuários da loja:', error);
    return res.status(500).json({ message: 'Erro interno' });
  }
});



// Obter usuário por ID (rota dinâmica)
router.get('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [
        {
          model: Plan,
          as: 'plan',
          attributes: ['id', 'name', 'description', 'price']
        },
        {
          model: Store,
          as: 'stores',
          through: { attributes: ['role'] },
          attributes: ['id', 'name']
        },
        {
          model: FootballTeam,
          as: 'team',
          attributes: ['id', 'short_name', 'abbreviation', 'shield']
        }
      ],
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuário não encontrado'
      });
    }

    if (!['admin', 'master', 'masteradmin'].includes(req.user.role)) {
      const userStores = await StoreUser.findAll({
        where: { user_id: req.user.id },
        attributes: ['store_id']
      });
      const storeIds = userStores.map(su => su.store_id);

      const userStoreAccess = await StoreUser.findOne({
        where: { 
          user_id: id,
          store_id: storeIds
        }
      });

      if (!userStoreAccess) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Acesso negado'
        });
      }
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Criar novo usuário
router.post('/', authenticateToken, requireRole('admin'), [
  body('name').isLength({ min: 2, max: 255 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'manager', 'waiter', 'customer']),
  body('phone').optional().isLength({ min: 10, max: 20 }),
  body('plan_id').optional().isInt(),
  body('team_user').optional().isInt()
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

    const { name, email, password, role, phone, plan_id, team_user } = req.body;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'Email já está em uso'
      });
    }

    if (team_user) {
      const team = await sequelize.models.FootballTeam.findByPk(team_user);
      if (!team) {
        return res.status(400).json({
          error: 'Invalid team',
          message: 'Time de futebol inválido'
        });
      }
    }

    const user = await User.create({
      name,
      email,
      phone,
      password_hash: password,
      role,
      plan_id,
      team_user
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/me:
 *   put:
 *     summary: Atualizar os dados do próprio usuário logado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               team_user:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 */
router.put('/me', authenticateToken, [
  body('name').optional().isLength({ min: 2, max: 255 }).trim().withMessage('O nome deve ter entre 2 e 255 caracteres.'),
  body('phone').optional().isLength({ min: 10, max: 20 }).withMessage('O telefone deve ter entre 10 e 20 caracteres.'),
  body('team_user').optional({ nullable: true }).isInt().withMessage('O ID do time deve ser um número inteiro.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation error', message: 'Dados inválidos', details: errors.array() });
    }

    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found', message: 'Usuário não encontrado.' });
    }

    // Apenas campos permitidos são atualizados
    const { name, phone, team_user } = req.body;
    await user.update({ name, phone, team_user });

    res.json({ success: true, message: 'Seu perfil foi atualizado com sucesso.', data: { user: user.toJSON() } });
  } catch (error) {
    console.error('Update self error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

// Atualizar usuário
router.put('/:id_code', authenticateToken, requireRole('master', 'admin'), [
  body('name').optional().isLength({ min: 2, max: 255 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'manager', 'waiter', 'customer']),
  body('phone').optional().isLength({ min: 10, max: 20 }),
  body('plan_id').optional().isInt(),
  body('team_user').optional().isInt()
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

    const { id_code } = req.params;
    const { name, email, role, phone, plan_id, team_user } = req.body;

    const user = await User.findOne({ where: { id_code } });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuário não encontrado'
      });
    }

    // Apenas 'master' pode definir outros como 'admin' ou 'master'
    if (role && ['master', 'admin'].includes(role) && req.user.role !== 'master') {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Permissões insuficientes para definir esta role.'
      });
    }

    if (team_user) {
      const team = await sequelize.models.FootballTeam.findByPk(team_user);
      if (!team) {
        return res.status(400).json({
          error: 'Invalid team',
          message: 'Time de futebol inválido'
        });
      }
    }

    await user.update({ name, email, role, phone, plan_id, team_user });

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @swagger
 * /api/v1/users/{id_code}/reset-password:
 *   post:
 *     summary: Resetar a senha de um usuário (Admin/Master)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_code
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Code do usuário a ter a senha resetada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: A nova senha para o usuário
 *     responses:
 *       200:
 *         description: Senha atualizada com sucesso
 *       400:
 *         description: Dados inválidos (e.g., senha muito curta)
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Usuário não encontrado
 */
router.post('/:id_code/reset-password', authenticateToken, requireRole('master', 'admin'), [
  body('password').isLength({ min: 6 }).withMessage('A nova senha deve ter no mínimo 6 caracteres.')
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

    const { id_code } = req.params;
    const { password } = req.body;

    const user = await User.findOne({ where: { id_code } });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuário não encontrado'
      });
    }

    // O hook beforeUpdate no modelo User irá criptografar a senha
    await user.update({ password });

    res.json({
      success: true,
      message: 'Senha do usuário atualizada com sucesso'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

// Deletar usuário
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Usuário não encontrado'
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        error: 'Cannot delete self',
        message: 'Não é possível deletar sua própria conta'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
