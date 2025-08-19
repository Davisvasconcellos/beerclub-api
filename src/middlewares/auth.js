// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models'); // ajuste o caminho se necessário

// Middleware para validar token e popular req.user
const authenticateToken = async (req, res, next) => {
  console.log('Authorization header:', req.headers['authorization']);
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('Token não fornecido');
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado:', decoded);

    // Busca usuário no banco
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      console.log('Usuário não encontrado no banco');
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    // Coloca usuário no req
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    console.log('Usuário autenticado:', req.user);
    next();
  } catch (err) {
    console.error('Erro no token:', err.message);
    return res.status(403).json({ message: 'Token inválido ou expirado' });
  }
};

// Middleware para checar roles
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('Requisição sem usuário autenticado');
      return res.status(401).json({ message: 'Não autenticado' });
    }

    // Admin, Master e MasterAdmin têm todos os acessos
    const highPrivilegeRoles = ['admin', 'master', 'masteradmin'];

    if (
      highPrivilegeRoles.includes(req.user.role) ||
      roles.includes(req.user.role)
    ) {
      return next();
    }

    console.log('Acesso negado para role:', req.user.role);
    return res.status(403).json({ message: 'Acesso negado' });
  };
};

module.exports = {
  authenticateToken,
  requireRole
};
