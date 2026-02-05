const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireModule } = require('../middlewares/auth');
const { FinCategory } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// GET /api/v1/financial/categories
router.get('/', authenticateToken, requireModule('financial'), async (req, res) => {
  try {
    const { store_id, type, status } = req.query;
    const where = {};
    
    if (store_id) where.store_id = store_id;
    if (type) where.type = type;
    if (status) where.status = status;
    else where.status = 'active'; // Default active

    const categories = await FinCategory.findAll({
      where,
      order: [['name', 'ASC']],
      attributes: { exclude: ['id'] }
    });

    const response = categories.map(cat => {
      const json = cat.toJSON();
      json.id = json.id_code;
      return json;
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// POST /api/v1/financial/categories
router.post('/', [
  authenticateToken,
  requireModule('financial'),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('store_id').notEmpty().withMessage('ID da loja é obrigatório'),
  body('type').isIn(['payable', 'receivable']).withMessage('Tipo inválido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, store_id, type, color, icon } = req.body;

    const category = await FinCategory.create({
      name,
      store_id,
      type,
      color,
      icon
    });

    await category.reload();
    const response = category.toJSON();
    response.id = response.id_code;
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// PUT /api/v1/financial/categories/:id_code
router.put('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const category = await FinCategory.findOne({ where: { id_code } });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const { name, type, color, icon, status } = req.body;

    await category.update({
      name,
      type,
      color,
      icon,
      status
    });

    const response = category.toJSON();
    response.id = response.id_code;
    res.json(response);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// DELETE /api/v1/financial/categories/:id_code
router.delete('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const category = await FinCategory.findOne({ where: { id_code } });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Soft delete by setting status to inactive or actually delete?
    // Let's set to inactive to preserve history
    await category.update({ status: 'inactive' });

    res.json({ message: 'Categoria removida com sucesso' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Erro ao remover categoria' });
  }
});

module.exports = router;
