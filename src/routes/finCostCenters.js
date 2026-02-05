const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireModule } = require('../middlewares/auth');
const { FinCostCenter } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// GET /api/v1/financial/cost-centers
router.get('/', authenticateToken, requireModule('financial'), async (req, res) => {
  try {
    const { store_id, status } = req.query;
    const where = {};
    
    if (store_id) where.store_id = store_id;
    if (status) where.status = status;
    else where.status = 'active';

    const costCenters = await FinCostCenter.findAll({
      where,
      order: [['name', 'ASC']],
      attributes: { exclude: ['id'] }
    });

    const response = costCenters.map(cc => {
      const json = cc.toJSON();
      json.id = json.id_code;
      return json;
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    res.status(500).json({ error: 'Erro ao buscar centros de custo' });
  }
});

// POST /api/v1/financial/cost-centers
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
    const { name, store_id, code, description } = req.body;

    const costCenter = await FinCostCenter.create({
      name,
      store_id,
      code,
      description
    });

    await costCenter.reload();
    const response = costCenter.toJSON();
    response.id = response.id_code;
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating cost center:', error);
    res.status(500).json({ error: 'Erro ao criar centro de custo' });
  }
});

// PUT /api/v1/financial/cost-centers/:id_code
router.put('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const costCenter = await FinCostCenter.findOne({ where: { id_code } });

    if (!costCenter) {
      return res.status(404).json({ error: 'Centro de custo não encontrado' });
    }

    const { name, code, description, status } = req.body;

    await costCenter.update({
      name,
      code,
      description,
      status
    });

    const response = costCenter.toJSON();
    response.id = response.id_code;
    res.json(response);
  } catch (error) {
    console.error('Error updating cost center:', error);
    res.status(500).json({ error: 'Erro ao atualizar centro de custo' });
  }
});

// DELETE /api/v1/financial/cost-centers/:id_code
router.delete('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const costCenter = await FinCostCenter.findOne({ where: { id_code } });

    if (!costCenter) {
      return res.status(404).json({ error: 'Centro de custo não encontrado' });
    }

    await costCenter.update({ status: 'inactive' });

    res.json({ message: 'Centro de custo removido com sucesso' });
  } catch (error) {
    console.error('Error deleting cost center:', error);
    res.status(500).json({ error: 'Erro ao remover centro de custo' });
  }
});

module.exports = router;
