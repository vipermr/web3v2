import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import xss from 'xss';
import dotenv from 'dotenv';
import winston from 'winston';
import formRoutes from './routes/formRoutes.js';
import aboutRoutes from './routes/aboutRoutes.js';

// Load environment variables first
dotenv.config();

// Load environment variables
const ENABLE_RATE_LIMITING = process.env.ENABLE_RATE_LIMITING !== 'false';
const ENABLE_STRICT_CORS = process.env.ENABLE_STRICT_CORS !== 'false';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const FORM_RATE_LIMIT_MAX = parseInt(process.env.FORM_RATE_LIMIT_MAX_REQUESTS) || 5;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const FORM_RATE_LIMIT_WINDOW = parseInt(process.env.FORM_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000;

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'express-form-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
if (ENABLE_RATE_LIMITING && RATE_LIMIT_MAX > 0) {
  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use(limiter);
  logger.info(`Rate limiting enabled: ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW}ms`);
}

// Stricter rate limiting for form submissions  
if (ENABLE_RATE_LIMITING && FORM_RATE_LIMIT_MAX > 0) {
  const formLimiter = rateLimit({
    windowMs: FORM_RATE_LIMIT_WINDOW,
    max: FORM_RATE_LIMIT_MAX,
    message: {
      error: 'Too many form submissions from this IP, please try again later.',
      code: 'FORM_RATE_LIMIT_EXCEEDED'
    },
    skip: (req) => req.path !== '/submit-form',
  });
  
  app.use('/submit-form', formLimiter);
  logger.info(`Form rate limiting enabled: ${FORM_RATE_LIMIT_MAX} submissions per ${FORM_RATE_LIMIT_WINDOW}ms`);
} else {
  logger.info('Rate limiting disabled - unlimited access enabled');
}

// CORS configuration - Simplified for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // If strict CORS is disabled or FRONTEND_DOMAIN is *, allow all origins
    if (!ENABLE_STRICT_CORS || process.env.FRONTEND_DOMAIN === '*') {
      return callback(null, true);
    }
    
    // Define allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_DOMAIN,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:10000',
      'https://web3pro.onrender.com',
      'http://127.0.0.1:5173'
    ].filter(Boolean);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// XSS protection middleware
app.use((req, res, next) => {
  if (req.body) {
    const sanitizeObject = (obj) => {
      const sanitized = {};
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          sanitized[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
      return sanitized;
    };
    req.body = sanitizeObject(req.body);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Status endpoint with API information
app.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Express.js Form Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      submit: '/submit-form',
      stats: '/stats',
      status: '/status'
    },
    documentation: 'https://github.com/yourusername/yourrepo#readme',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - Simple welcome message
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Form Backend API is running',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      status: '/status',
      health: '/health',
      submit: '/submit-form'
    },
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/', formRoutes);
app.use('/', aboutRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      code: 'CORS_ERROR'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  
  // Check if Gmail API is configured
  const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN', 'TO_EMAIL'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    logger.warn(`⚠️  Missing Gmail API configuration: ${missingEnvVars.join(', ')}`);
    logger.warn(`📝 Please update your .env file with the missing variables`);
    logger.warn(`📚 See USERGUIDE.md for setup instructions`);
  } else {
    logger.info(`📧 Gmail API configured and ready`);
  }
  
  logger.info(`🛡️ Security features: ${ENABLE_RATE_LIMITING ? 'Rate limiting enabled' : 'Rate limiting disabled'}`);
  logger.info(`🌐 CORS: ${ENABLE_STRICT_CORS ? `Restricted to ${process.env.FRONTEND_DOMAIN || 'localhost'}` : 'Open to all origins'}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📋 API endpoint: http://localhost:${PORT}/submit-form`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
