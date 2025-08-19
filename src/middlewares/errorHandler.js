/**
 * Middleware para tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Erro de validação do Sequelize
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message
    }));

    return res.status(400).json({
      error: 'Validation error',
      message: 'Erro de validação',
      details: errors
    });
  }

  // Erro de chave única duplicada
  if (err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: `${error.path} já existe`
    }));

    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'Registro duplicado',
      details: errors
    });
  }

  // Erro de chave estrangeira
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      error: 'Foreign key constraint',
      message: 'Referência inválida',
      detail: err.message
    });
  }

  // Erro de validação do Express Validator
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Erro de validação',
      details: err.errors
    });
  }

  // Erro de arquivo não encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      error: 'File not found',
      message: 'Arquivo não encontrado'
    });
  }

  // Erro de limite de tamanho de arquivo
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: 'Arquivo muito grande',
      maxSize: process.env.MAX_FILE_SIZE || '5MB'
    });
  }

  // Erro de tipo de arquivo não permitido
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Tipo de arquivo não permitido'
    });
  }

  // Erro padrão
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
};

module.exports = errorHandler; 