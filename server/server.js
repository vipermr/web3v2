import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import xss from 'xss';
import dotenv from 'dotenv';
import winston from 'winston';
import formRoutes from './routes/formRoutes.js';
import aboutRoutes from './routes/aboutRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https:"],
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
      'http://127.0.0.1:5173',
      'https://reliable-speculoos-5a84f6.netlify.app'
    ].filter(Boolean);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || process.env.FRONTEND_DOMAIN === '*') {
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

// Check if React build exists and serve static files
const buildPath = path.join(__dirname, '..', 'dist');
const indexPath = path.join(buildPath, 'index.html');
const publicPath = path.join(__dirname, 'public');
const homePath = path.join(publicPath, 'home.html');

if (fs.existsSync(indexPath)) {
  // Serve static files from the React app build directory
  app.use(express.static(buildPath, {
    maxAge: '1d',
    etag: true
  }));
  logger.info('React build found - serving frontend from /dist');
} else {
  logger.warn('React build not found - frontend routes will show fallback message');
}

// Serve static files from public directory
app.use('/public', express.static(publicPath, {
  maxAge: '1d',
  etag: true
}));

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

// API routes (must come before frontend routes)
app.use('/', formRoutes);
app.use('/', aboutRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    frontend: fs.existsSync(indexPath) ? 'available' : 'not_built'
  });
});

// Status endpoint with API information
app.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Express.js Form Backend API',
    version: '1.0.0',
    status: 'running',
    frontend: fs.existsSync(indexPath) ? 'available' : 'not_built',
    endpoints: {
      frontend: '/ and /home',
      health: '/health',
      submit: '/submit-form',
      stats: '/stats',
      status: '/status',
      about: '/nafij'
    },
    documentation: 'https://github.com/yourusername/yourrepo#readme',
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Form Backend API is running',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      status: '/status',
      health: '/health',
      submit: '/submit-form',
      stats: '/stats',
      about: '/nafij'
    },
    timestamp: new Date().toISOString()
  });
});

// Frontend route handler
const serveFrontend = (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if React build doesn't exist
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Express.js Form Backend</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .status { color: #28a745; font-size: 18px; margin-bottom: 20px; }
          .endpoints { text-align: left; background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .endpoint { margin: 10px 0; font-family: monospace; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Express.js Form Backend</h1>
          <div class="status">✅ API Server Running</div>
          <p>The backend API is running successfully. The React frontend will be available once built.</p>
          
          <div class="endpoints">
            <h3>Available Endpoints:</h3>
            <div class="endpoint">📊 <a href="/status">/status</a> - API status and info</div>
            <div class="endpoint">❤️ <a href="/health">/health</a> - Health check</div>
            <div class="endpoint">📝 <a href="/submit-form">/submit-form</a> - Form submission (POST)</div>
            <div class="endpoint">📈 <a href="/stats">/stats</a> - Statistics</div>
            <div class="endpoint">👨‍💻 <a href="/nafij">/nafij</a> - About developer</div>
          </div>
          
          <p><strong>Note:</strong> Run <code>npm run build</code> in the root directory to build the React frontend.</p>
        </div>
      </body>
      </html>
    `);
  }
};

// Root endpoint - Serve React frontend
app.get('/', serveFrontend);

// Home route - Duplicate of root route for guaranteed frontend access
app.get('/home', (req, res) => {
  if (fs.existsSync(homePath)) {
    res.sendFile(homePath);
  } else {
    serveFrontend(req, res);
  }
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Skip API routes - they should return JSON responses
  if (req.path.startsWith('/submit-form') || 
      req.path.startsWith('/health') || 
      req.path.startsWith('/status') || 
      req.path.startsWith('/stats') ||
      req.path.startsWith('/nafij') ||
      req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      code: 'NOT_FOUND',
      availableEndpoints: ['/health', '/status', '/submit-form', '/stats', '/nafij']
    });
  }
  
  // For all other routes, serve the React app
  serveFrontend(req, res);
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
  logger.info(`🏠 Frontend: http://localhost:${PORT}/ and http://localhost:${PORT}/home`);
  
  // Check if React build exists
  if (fs.existsSync(indexPath)) {
    logger.info(`✅ React frontend ready at / and /home`);
  } else {
    logger.warn(`⚠️  React build not found - run 'npm run build' to build frontend`);
  }
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