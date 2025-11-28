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

// Import middleware
const errorHandler = require('./middlewares/errorHandler');

// Import database connection
const { sequelize, testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 4000;

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
app.use(helmet());

// CORS configuration with support for multiple origins and localhost ranges in dev
const parseOrigins = (value) => (value || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const whitelist = parseOrigins(process.env.CORS_ORIGIN);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (no origin)
    if (!origin) return callback(null, true);

    // Whitelist from env (supports comma-separated)
    if (whitelist.includes(origin)) return callback(null, true);

    // In development, allow localhost ports in ranges 4200-4299 and 4300-4399
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      const localhostRange = /^http:\/\/localhost:(42|43)\d{2}$/;
      if (localhostRange.test(origin)) return callback(null, true);
    }

    // Otherwise, block
    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Compression with SSE-safe filter
const shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) return false;
  const accept = req.headers['accept'] || '';
  if (accept.includes('text/event-stream')) return false;
  return compression.filter(req, res);
};
app.use(compression({ filter: shouldCompress }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Muitas requisições. Tente novamente mais tarde.'
  }
});

// Slow down
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
  validate: { delayMs: false }
});

app.use('/api/', limiter);
app.use('/api/', speedLimiter);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// ROTA RAIZ (para teste rápido no Render)
app.get('/', (req, res) => {
  res.json({
    message: 'BeerClub API - OK',
    environment: process.env.NODE_ENV || 'development',
    docs: process.env.NODE_ENV === 'development' ? `${process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`}/api-docs` : 'Available only in development',
    health: '/api/v1/health'
  });
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
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
// Aliases públicos versionados
app.use('/api/public/v1/events', eventOpenRoutes);
app.use('/api/v1/events', eventJamsRoutes);
app.use('/api/events', eventJamsRoutes);
app.use('/api/public/v1/events', eventJamsRoutes);

app.get('/api/stream-test', (req, res) => {
  const origin = req.headers.origin;
  if (origin && (origin === 'http://localhost:4200' || origin.endsWith('.seudominio.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const write = () => {
    const payload = { type: 'stream_test', time: new Date().toISOString(), random: Math.floor(Math.random() * 1000000) };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  write();
  write();
  const intervalId = setInterval(write, 2000);
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Swagger documentation (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint não encontrado'
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
let server; // Declarar aqui para uso no SIGTERM

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (server) {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  }
});

// INICIA O SERVIDOR (SEM ASYNC!)
server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`API Documentation: ${process.env.API_PUBLIC_BASE_URL || `http://localhost:${PORT}`}/api-docs`);
  }
});

// CONEXÃO COM BANCO FORA DO LISTEN
(async () => {
  try {
    await testConnection();
    console.log('Database connected successfully');
    console.log('Node Server OK');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
})();

module.exports = app;
