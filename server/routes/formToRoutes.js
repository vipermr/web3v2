import express from 'express';
import Joi from 'joi';
import winston from 'winston';
import { sendEmailToCustomDestinations } from '../utils/gmailSenderCustom.js';
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
  defaultMeta: { service: 'form-to-routes' },
  transports: [
    new winston.transports.File({ filename: 'form-to-submissions.log' }),
    new winston.transports.Console()
  ],
});

// Stats tracking for form-to
let formToStats = {
  totalMessages: 0,
  totalUsers: new Set(),
  dailyMessages: {},
  lastUpdated: new Date().toISOString()
};

// Load existing stats
const loadFormToStats = async () => {
  try {
    const statsData = await fs.readFile('form-to-stats.json', 'utf8');
    const loadedStats = JSON.parse(statsData);
    formToStats.totalMessages = loadedStats.totalMessages || 0;
    formToStats.totalUsers = new Set(loadedStats.totalUsers || []);
    formToStats.dailyMessages = loadedStats.dailyMessages || {};
    formToStats.lastUpdated = loadedStats.lastUpdated || new Date().toISOString();
  } catch (error) {
    logger.info('Form-to stats file not found, starting with fresh stats');
  }
};

// Save stats
const saveFormToStats = async () => {
  try {
    const statsToSave = {
      totalMessages: formToStats.totalMessages,
      totalUsers: Array.from(formToStats.totalUsers),
      dailyMessages: formToStats.dailyMessages,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile('form-to-stats.json', JSON.stringify(statsToSave, null, 2));
  } catch (error) {
    logger.error('Failed to save form-to stats', { error: error.message });
  }
};

// Initialize stats on startup
loadFormToStats();

// Validation schema for form-to
const formToSchema = Joi.object({
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
    .valid('default', 'contact', 'inquiry', 'support', 'newsletter', 'quote', 'booking', 'feedback', 'partnership', 'job', 'event', 'dark-pro', 'dark-elite', 'premium', 'executive')
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

  // Dynamic destination emails FROM_TO1 to FROM_TO10
  FROM_TO1: Joi.string().email().optional().allow(''),
  FROM_TO2: Joi.string().email().optional().allow(''),
  FROM_TO3: Joi.string().email().optional().allow(''),
  FROM_TO4: Joi.string().email().optional().allow(''),
  FROM_TO5: Joi.string().email().optional().allow(''),
  FROM_TO6: Joi.string().email().optional().allow(''),
  FROM_TO7: Joi.string().email().optional().allow(''),
  FROM_TO8: Joi.string().email().optional().allow(''),
  FROM_TO9: Joi.string().email().optional().allow(''),
  FROM_TO10: Joi.string().email().optional().allow(''),
  
  _honey: Joi.string()
    .optional()
    .allow('')
});

// Form-to submission endpoint
router.post('/form-to', async (req, res) => {
  const startTime = Date.now();
  const submissionId = `form_to_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('Form-to submission received', {
      submissionId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Honeypot check (spam detection)
    if (req.body._honey && req.body._honey.trim() !== '') {
      logger.warn('Spam detected via honeypot in form-to', {
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
    const { error, value } = formToSchema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Form-to validation failed', {
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

    // Extract destination emails from FROM_TO1 to FROM_TO10
    const destinationEmails = [];
    for (let i = 1; i <= 10; i++) {
      const emailKey = `FROM_TO${i}`;
      const email = value[emailKey];
      if (email && email.trim()) {
        destinationEmails.push({
          key: emailKey,
          email: email.trim()
        });
      }
    }

    if (destinationEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one destination email (FROM_TO1-FROM_TO10) must be provided',
        code: 'NO_DESTINATION_EMAILS',
        submissionId
      });
    }

    // Extract sanitized data
    const formData = {
      ...value,
      submissionId,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      destinationEmails
    };

    // Update stats
    formToStats.totalMessages++;
    formToStats.totalUsers.add(formData.email);
    const today = new Date().toISOString().split('T')[0];
    formToStats.dailyMessages[today] = (formToStats.dailyMessages[today] || 0) + 1;
    
    // Save stats asynchronously
    saveFormToStats().catch(err => logger.error('Failed to save form-to stats', { error: err.message }));

    // Log the sanitized form data
    logger.info('Form-to data validated successfully', {
      submissionId,
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      template_id: formData.template_id,
      destinationCount: destinationEmails.length,
      destinations: destinationEmails.map(d => d.email),
      hasPhone: !!formData.phone,
      hasCompany: !!formData.company,
      messageLength: formData.message.length
    });

    // Send email to custom destinations
    const emailResult = await sendEmailToCustomDestinations(formData);

    if (!emailResult.success) {
      logger.error('Form-to email sending failed', {
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
        hint: 'Please check your Gmail API configuration'
      });
    }

    // Success response
    const processingTime = Date.now() - startTime;
    logger.info('Form-to submission processed successfully', {
      submissionId,
      totalSent: emailResult.totalSent,
      totalFailed: emailResult.totalFailed,
      processingTime,
      template: formData.template_id,
      destinationCount: destinationEmails.length
    });

    res.json({
      success: true,
      message: 'Form submitted and emails sent to custom destinations successfully!',
      submissionId,
      emailResults: emailResult.results,
      totalSent: emailResult.totalSent,
      totalFailed: emailResult.totalFailed,
      destinationCount: destinationEmails.length,
      processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Unexpected error in form-to submission', {
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

// Get form-to stats endpoint
router.get('/form-to-stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const weeklyData = last7Days.map(date => ({
    date,
    messages: formToStats.dailyMessages[date] || 0
  }));

  res.json({
    success: true,
    stats: {
      totalMessages: formToStats.totalMessages,
      totalUsers: formToStats.totalUsers.size,
      todayMessages: formToStats.dailyMessages[today] || 0,
      weeklyData,
      lastUpdated: formToStats.lastUpdated
    }
  });
});

export default router;