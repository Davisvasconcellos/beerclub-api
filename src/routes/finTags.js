const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireModule } = require('../middlewares/auth');
const { FinTag } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// GET /api/v1/financial/tags
router.get('/', authenticateToken, requireModule('financial'), async (req, res) => {
  try {
    const { store_id, status } = req.query;
    const where = {};
    
    if (store_id) where.store_id = store_id;
    if (status) where.status = status;
    else where.status = 'active';

    const tags = await FinTag.findAll({
      where,
      order: [['name', 'ASC']],
      attributes: { exclude: ['id'] }
    });

    const response = tags.map(tag => {
      const json = tag.toJSON();
      json.id = json.id_code;
      return json;
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Erro ao buscar tags' });
  }
});

// POST /api/v1/financial/tags
router.post('/', [
  authenticateToken,
  requireModule('financial'),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('store_id').notEmpty().withMessage('ID da loja é obrigatório')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, store_id, color } = req.body;

    const tag = await FinTag.create({
      name,
      store_id,
      color
    });

    await tag.reload();
    const response = tag.toJSON();
    response.id = response.id_code;
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Erro ao criar tag' });
  }
});

// PUT /api/v1/financial/tags/:id_code
router.put('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const tag = await FinTag.findOne({ where: { id_code } });

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    const { name, color, status } = req.body;

    await tag.update({
      name,
      color,
      status
    });

    const response = tag.toJSON();
    response.id = response.id_code;
    res.json(response);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Erro ao atualizar tag' });
  }
});

// DELETE /api/v1/financial/tags/:id_code
router.delete('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const tag = await FinTag.findOne({ where: { id_code } });

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    await tag.update({ status: 'inactive' });

    res.json({ message: 'Tag removida com sucesso' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Erro ao remover tag' });
  }
});

module.exports = router;
