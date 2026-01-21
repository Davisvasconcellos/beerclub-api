const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middlewares/auth');
const { Party, FinancialTransaction, sequelize } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// GET /api/v1/financial/parties
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      store_id, 
      type, // customer, supplier, employee, salesperson
      search,
      page = 1, 
      limit = 20
    } = req.query;

    const where = {};
    
    if (store_id) {
      where.store_id = store_id;
    }

    if (type) {
      if (type === 'customer') where.is_customer = true;
      if (type === 'supplier') where.is_supplier = true;
      if (type === 'employee') where.is_employee = true;
      if (type === 'salesperson') where.is_salesperson = true;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { trade_name: { [Op.like]: `%${search}%` } },
        { document: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // Default active only unless specified? 
    // Usually lists show active. Let's add status filter or default to active.
    // User might want to see all. Let's keep it simple for now.
    if (req.query.status) {
        where.status = req.query.status;
    } else {
        where.status = { [Op.ne]: 'blocked' }; // Show active and inactive by default? Or just active?
        // Let's show all except blocked/deleted if we had soft delete.
        // For now, let's show all.
        delete where.status; 
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Party.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: rows
    });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({ error: 'Erro ao buscar parceiros' });
  }
});

// GET /api/v1/financial/parties/:id_code
router.get('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const party = await Party.findOne({ where: { id_code } });

    if (!party) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    res.json(party);
  } catch (error) {
    console.error('Error fetching party:', error);
    res.status(500).json({ error: 'Erro ao buscar parceiro' });
  }
});

// POST /api/v1/financial/parties
router.post('/', [
  authenticateToken,
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('store_id').notEmpty().withMessage('ID da loja é obrigatório'),
  body('type').optional().isArray().withMessage('Type deve ser um array de roles [customer, supplier, etc] ou use flags individuais')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      name, trade_name, document, email, phone, mobile,
      is_customer, is_supplier, is_employee, is_salesperson,
      zip_code, address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state,
      notes, store_id
    } = req.body;

    // Validate that at least one role is selected? Not strictly necessary but good practice.
    // If user sends 'type' array from frontend, we map to flags.
    let flags = { is_customer, is_supplier, is_employee, is_salesperson };
    if (req.body.type && Array.isArray(req.body.type)) {
        if (req.body.type.includes('customer')) flags.is_customer = true;
        if (req.body.type.includes('supplier')) flags.is_supplier = true;
        if (req.body.type.includes('employee')) flags.is_employee = true;
        if (req.body.type.includes('salesperson')) flags.is_salesperson = true;
    }

    const newParty = await Party.create({
      name, trade_name, document, email, phone, mobile,
      ...flags,
      zip_code, address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state,
      notes, store_id,
      created_by: req.user.userId
    });

    res.status(201).json(newParty);
  } catch (error) {
    console.error('Error creating party:', error);
    res.status(500).json({ error: 'Erro ao criar parceiro' });
  }
});

// PUT /api/v1/financial/parties/:id_code
router.put('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const party = await Party.findOne({ where: { id_code } });

    if (!party) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    const { 
      name, trade_name, document, email, phone, mobile,
      is_customer, is_supplier, is_employee, is_salesperson,
      zip_code, address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state,
      notes, status
    } = req.body;

    // Map type array if provided
    let flags = {};
    if (is_customer !== undefined) flags.is_customer = is_customer;
    if (is_supplier !== undefined) flags.is_supplier = is_supplier;
    if (is_employee !== undefined) flags.is_employee = is_employee;
    if (is_salesperson !== undefined) flags.is_salesperson = is_salesperson;

    if (req.body.type && Array.isArray(req.body.type)) {
        flags.is_customer = req.body.type.includes('customer');
        flags.is_supplier = req.body.type.includes('supplier');
        flags.is_employee = req.body.type.includes('employee');
        flags.is_salesperson = req.body.type.includes('salesperson');
    }

    await party.update({
      name, trade_name, document, email, phone, mobile,
      ...flags,
      zip_code, address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state,
      notes, status
    });

    res.json(party);
  } catch (error) {
    console.error('Error updating party:', error);
    res.status(500).json({ error: 'Erro ao atualizar parceiro' });
  }
});

// DELETE /api/v1/financial/parties/:id_code
router.delete('/:id_code', authenticateToken, async (req, res) => {
  try {
    const { id_code } = req.params;
    const party = await Party.findOne({ where: { id_code } });

    if (!party) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    // Check for transactions
    const transactionCount = await FinancialTransaction.count({
        where: { party_id: id_code }
    });

    if (transactionCount > 0) {
        // Soft delete (block)
        await party.update({ status: 'inactive' }); // or blocked
        return res.json({ message: 'Parceiro inativado pois possui transações vinculadas' });
    }

    await party.destroy();
    res.json({ message: 'Parceiro removido com sucesso' });
  } catch (error) {
    console.error('Error deleting party:', error);
    res.status(500).json({ error: 'Erro ao remover parceiro' });
  }
});

module.exports = router;
