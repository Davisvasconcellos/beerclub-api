const express = require('express');
const { SysModule } = require('../models');
const { authenticateToken, requireRole } = require('../middlewares/auth');

const router = express.Router();

// Listar todos os módulos (para o Admin montar os checkboxes)
router.get('/', authenticateToken, requireRole('admin', 'master', 'masteradmin'), async (req, res) => {
  try {
    const modules = await SysModule.findAll({
      where: { active: true },
      attributes: ['id', 'id_code', 'name', 'slug', 'description']
    });

    res.json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('List modules error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;