import express from 'express';
import Joi from 'joi';
import winston from 'winston';
import { sendEmail } from '../utils/gmailSender.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'form-routes' },
  transports: [
    new winston.transports.File({ filename: 'form-submissions.log' }),
    new winston.transports.Console()
  ],
});

// Stats tracking
let stats = {
  totalMessages: 0,
  totalUsers: new Set(),
  dailyMessages: {},
  lastUpdated: new Date().toISOString()
};

// Load existing stats
const loadStats = async () => {
  try {
    const statsData = await fs.readFile('stats.json', 'utf8');
    const loadedStats = JSON.parse(statsData);
    stats.totalMessages = loadedStats.totalMessages || 0;
    stats.totalUsers = new Set(loadedStats.totalUsers || []);
    stats.dailyMessages = loadedStats.dailyMessages || {};
    stats.lastUpdated = loadedStats.lastUpdated || new Date().toISOString();
  } catch (error) {
    // File doesn't exist or is corrupted, use defaults
    logger.info('Stats file not found, starting with fresh stats');
  }
};

// Save stats
const saveStats = async () => {
  try {
    const statsToSave = {
      totalMessages: stats.totalMessages,
      totalUsers: Array.from(stats.totalUsers),
      dailyMessages: stats.dailyMessages,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile('stats.json', JSON.stringify(statsToSave, null, 2));
  } catch (error) {
    logger.error('Failed to save stats', { error: error.message });
  }
};

// Initialize stats on startup
loadStats();

// Validation schema
const formSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Name is required',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  email: Joi.string()
    .email()
    .max(254)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email cannot exceed 254 characters'
    }),
  
  subject: Joi.string()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Subject is required',
      'string.max': 'Subject cannot exceed 200 characters'
    }),
  
  message: Joi.string()
    .min(1)
    .max(5000)
    .required()
    .messages({
      'string.min': 'Message is required',
      'string.max': 'Message cannot exceed 5000 characters'
    }),
  
  template_id: Joi.string()
    .valid('default', 'contact', 'inquiry', 'support')
    .optional()
    .default('default'),
  
  phone: Joi.string()
    .pattern(/^[\+]?[0-9\s\-\(\)\.]+$/)
    .max(20)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.max': 'Phone number cannot exceed 20 characters'
    }),
  
  company: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Company name cannot exceed 100 characters'
    }),
  
  _honey: Joi.string()
    .optional()
    .allow('')
});

// Form submission endpoint
router.post('/submit-form', async (req, res) => {
  const startTime = Date.now();
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('Form submission received', {
      submissionId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Honeypot check (spam detection)
    if (req.body._honey && req.body._honey.trim() !== '') {
      logger.warn('Spam detected via honeypot', {
        submissionId,
        ip: req.ip,
        honeypotValue: req.body._honey
      });
      
      return res.status(400).json({
        success: false,
        error: 'Submission rejected',
        code: 'SPAM_DETECTED',
        submissionId
      });
    }

    // Validate form data
    const { error, value } = formSchema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Form validation failed', {
        submissionId,
        errors: validationErrors,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors,
        submissionId
      });
    }

    // Extract sanitized data
    const formData = {
      ...value,
      submissionId,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Update stats
    stats.totalMessages++;
    stats.totalUsers.add(formData.email);
    const today = new Date().toISOString().split('T')[0];
    stats.dailyMessages[today] = (stats.dailyMessages[today] || 0) + 1;
    
    // Save stats asynchronously
    saveStats().catch(err => logger.error('Failed to save stats', { error: err.message }));

    // Log the sanitized form data
    logger.info('Form data validated successfully', {
      submissionId,
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      template_id: formData.template_id,
      hasPhone: !!formData.phone,
      hasCompany: !!formData.company,
      messageLength: formData.message.length
    });

    // Send email
    const emailResult = await sendEmail(formData);

    if (!emailResult.success) {
      logger.error('Email sending failed', {
        submissionId,
        error: emailResult.error,
        details: emailResult.details
      });

      return res.status(500).json({
        success: false,
        error: emailResult.error || 'Failed to send email',
        code: 'EMAIL_SEND_ERROR',
        submissionId,
        details: process.env.NODE_ENV === 'production' ? undefined : emailResult.details,
        hint: 'Please check your Gmail API configuration in the .env file'
      });
    }

    // Success response
    const processingTime = Date.now() - startTime;
    logger.info('Form submission processed successfully', {
      submissionId,
      messageId: emailResult.messageId,
      processingTime,
      template: formData.template_id
    });

    res.json({
      success: true,
      message: 'Form submitted and email sent successfully!',
      submissionId,
      messageId: emailResult.messageId,
      processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Unexpected error in form submission', {
      submissionId,
      error: error.message,
      stack: error.stack,
      processingTime
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      submissionId,
      timestamp: new Date().toISOString(),
      hint: 'Please check server logs for detailed error information'
    });
  }
});

// Get submission status (optional endpoint for tracking)
router.get('/submission/:id', (req, res) => {
  const submissionId = req.params.id;
  
  if (!submissionId || !submissionId.startsWith('sub_')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid submission ID',
      code: 'INVALID_SUBMISSION_ID'
    });
  }

  // In a real application, you would check a database
  // For now, just return a generic response
  res.json({
    success: true,
    submissionId,
    status: 'processed',
    timestamp: new Date().toISOString()
  });
});

// Get stats endpoint
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const weeklyData = last7Days.map(date => ({
    date,
    messages: stats.dailyMessages[date] || 0
  }));

  res.json({
    success: true,
    stats: {
      totalMessages: stats.totalMessages,
      totalUsers: stats.totalUsers.size,
      todayMessages: stats.dailyMessages[today] || 0,
      weeklyData,
      lastUpdated: stats.lastUpdated
    }
  });
});

export default router;