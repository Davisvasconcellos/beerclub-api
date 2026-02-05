// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { User, TokenBlocklist } = require('../models'); // ajuste o caminho se necessário

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
    // Verificar se o token está na blocklist
    const isBlocked = await TokenBlocklist.findByPk(token);
    if (isBlocked) {
      console.log('Token na blocklist');
      return res.status(401).json({ message: 'Token inválido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado:', decoded);

    // Busca usuário no banco
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      console.log('Usuário não encontrado no banco');
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    // Anexa o payload decodificado do token ao req.user
    req.user = decoded;

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
    return res.status(403).json({ 
      error: 'Forbidden',
      message: `Acesso negado. Seu perfil (${req.user.role}) não possui permissão para este recurso.`,
      required_roles: [...roles, ...highPrivilegeRoles]
    });
  };
};

// Middleware para verificar acesso a módulos
const requireModule = (moduleSlug) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // Master/Admin sempre acessa tudo
      const highPrivilegeRoles = ['admin', 'master', 'masteradmin'];
      if (highPrivilegeRoles.includes(req.user.role)) {
        return next();
      }

      const user = await User.findByPk(req.user.userId, {
        include: [{ 
          model: require('../models').SysModule,
          as: 'modules',
          where: { slug: moduleSlug, active: true },
          required: false 
        }]
      });

      // Se encontrou o módulo na lista do usuário
      if (user && user.modules && user.modules.length > 0) {
        return next();
      }

      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Acesso negado. Seu usuário (role: ${req.user.role}) não possui o módulo '${moduleSlug}' ativo.` 
      });
    } catch (error) {
      console.error('Erro ao verificar permissão de módulo:', error);
      return res.status(500).json({ message: 'Erro interno de verificação de permissão' });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireModule
};
