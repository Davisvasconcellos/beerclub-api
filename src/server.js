// Load base .env first
require('dotenv').config();
// Then load environment-specific .env.<NODE_ENV> to override base values
try {
  const env = process.env.NODE_ENV || 'development';
  const path = require('path');
  const envPath = path.resolve(process.cwd(), `.env.${env}`);
  require('dotenv').config({ path: envPath });
} catch (e) {
  // Silently ignore if env-specific file does not exist
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authMiddleware = require('./middlewares/auth');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const storeRoutes = require('./routes/stores');
const footballTeamsRoutes = require('./routes/footballTeams');
const eventRoutes = require('./routes/events');
const eventOpenRoutes = require('./routes/eventsOpen');
const eventJamsRoutes = require('./routes/eventJams');
const uploadRoutes = require('./routes/upload');
const filesRoutes = require('./routes/files');
const financialRoutes = require('./routes/financial');
const finRecurrenceRoutes = require('./routes/finRecurrences');
const bankAccountRoutes = require('./routes/bankAccounts');
const partyRoutes = require('./routes/parties');
const finCategoryRoutes = require('./routes/finCategories');
const finCostCenterRoutes = require('./routes/finCostCenters');
const finTagRoutes = require('./routes/finTags');

// Import middleware
const errorHandler = require('./middlewares/errorHandler');

// Import database connection
const { sequelize, testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 4000;

// CORREÇÃO OBRIGATÓRIA NO RENDER (resolve o erro do rate-limit + SSE)
app.set('trust proxy', 1); // ou true → essencial!

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BeerClub API',
      version: '1.0.0',
      description: 'API para sistema de bares e restaurantes',
    },
    servers: [
      {
        url: process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(swaggerOptions);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS configuration
const parseOrigins = (value) => (value || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const whitelist = parseOrigins(process.env.CORS_ORIGIN);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (whitelist.includes(origin)) return callback(null, true);

    if ((process.env.NODE_ENV || 'development') !== 'production') {
      const localhostRange = /^http:\/\/localhost:(42|43)\d{2}$/;
      if (localhostRange.test(origin)) return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Compression com proteção para SSE
const shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) return false;
  if (req.headers['accept']?.includes('text/event-stream')) return false;
  return compression.filter(req, res);
};
app.use(compression({ filter: shouldCompress }));

// Rate limiting (agora funciona corretamente com trust proxy)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Muitas requisições. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
});

// Aplica limiter e slowdown em tudo, exceto na rota SSE
app.use('/api/', limiter);
app.use('/api/', speedLimiter);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// ROTA RAIZ
app.get('/', (req, res) => {
  res.json({
    message: 'BeerClub API - OK',
    environment: process.env.NODE_ENV || 'development',
    docs: process.env.NODE_ENV === 'development' 
      ? `${process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`}/api-docs` 
      : 'Available only in development',
    health: '/api/v1/health',
    sse_test: '/api/stream-test'
  });
});

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// === ROTA SSE ESTÁVEL NO RENDER (testada e aprovada) ===
app.get('/api/stream-test', (req, res) => {
  const origin = req.headers.origin;

  // CORS para SSE
  if (origin && whitelist.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Headers obrigatórios para SSE funcionar em qualquer proxy
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Crucial no Render/Nginx/Cloudflare

  // Evita compressão gzip na stream
  req.headers['x-no-compression'] = 'true';

  res.flushHeaders();

  // Envia mensagem inicial
  res.write(`data: ${JSON.stringify({ 
    type: 'connection', 
    message: 'Conectado ao BeerClub SSE', 
    time: new Date().toISOString() 
  })}\n\n`);

  const interval = setInterval(() => {
    const data = {
      time: new Date().toISOString(),
      online: true,
      uptime: process.uptime(),
      random: Math.floor(Math.random() * 1000000)
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 3000);

  // Limpeza ao fechar conexão
  req.on('close', () => {
    clearInterval(interval);
    console.log('SSE desconectado:', req.ip);
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/football-teams', footballTeamsRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/events', eventOpenRoutes);
app.use('/api/public/v1/events', eventOpenRoutes);
app.use('/api/v1/events', eventJamsRoutes);
app.use('/api/events', eventJamsRoutes);
app.use('/api/public/v1/events', eventJamsRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/files', filesRoutes);
app.use('/api/v1/financial/bank-accounts', bankAccountRoutes);
app.use('/api/v1/financial/parties', partyRoutes);
app.use('/api/v1/financial/categories', finCategoryRoutes);
app.use('/api/v1/financial/cost-centers', finCostCenterRoutes);
app.use('/api/v1/financial/tags', finTagRoutes);
app.use('/api/v1/financial/recurrences', finRecurrenceRoutes);
app.use('/api/v1/financial', financialRoutes);

// Swagger (apenas dev)
if (process.env.NODE_ENV === 'development') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint não encontrado'
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown
let server;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  }
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`Docs: ${process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`}/api-docs`);
      console.log(`SSE Test: ${process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`}/api/stream-test`);
    }
  });
}

// Database connection
(async () => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await testConnection();
      console.log('Database connected successfully');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
})();

module.exports = app;
