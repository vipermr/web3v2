import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import handlebars from 'handlebars';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gmail-sender-custom' },
  transports: [
    new winston.transports.File({ filename: 'email-custom.log' }),
    new winston.transports.Console()
  ],
});

// Global OAuth2 client and credentials (reuse from main gmail sender)
let oauth2Client = null;
let gmail = null;
let cachedCredentials = null;
let lastTokenRefresh = 0;
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes

// Get the correct redirect URI based on environment
function getRedirectUri() {
  if (process.env.NODE_ENV === 'production') {
    return 'https://web3ninja.onrender.com/oauth2callback';
  }
  return 'http://localhost:3000/oauth2callback';
}

// Load credentials from stored file or environment
async function loadCredentials() {
  try {
    // First try to load from stored file
    const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
    
    try {
      const credentialsData = await fs.readFile(credentialsPath, 'utf8');
      const storedCredentials = JSON.parse(credentialsData);
      
      if (storedCredentials.refresh_token) {
        logger.info('✅ Loading credentials from stored file for custom sender');
        
        return {
          refresh_token: storedCredentials.refresh_token,
          access_token: storedCredentials.access_token,
          expiry_date: storedCredentials.expiry_date,
          email_address: storedCredentials.email_address
        };
      }
    } catch (fileError) {
      logger.info('No stored credentials file found, using environment variables for custom sender');
    }

    // Fallback to environment variables
    if (process.env.REFRESH_TOKEN) {
      return {
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: null,
        expiry_date: null,
        email_address: process.env.TO_EMAIL
      };
    }

    throw new Error('No credentials found in stored file or environment variables');
  } catch (error) {
    logger.error('Failed to load credentials for custom sender:', error.message);
    throw error;
  }
}

// Initialize OAuth2 client
async function initializeOAuth2Client() {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error('CLIENT_ID and CLIENT_SECRET must be configured');
    }

    const redirectUri = getRedirectUri();
    oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      redirectUri
    );

    // Load credentials
    cachedCredentials = await loadCredentials();
    
    // Set credentials in OAuth2 client
    oauth2Client.setCredentials({
      refresh_token: cachedCredentials.refresh_token,
      access_token: cachedCredentials.access_token,
      expiry_date: cachedCredentials.expiry_date
    });

    gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    logger.info(`✅ Custom OAuth2 client initialized with redirect URI: ${redirectUri}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize custom OAuth2 client:', error.message);
    throw error;
  }
}

// Refresh access token
async function refreshAccessToken() {
  try {
    logger.info('🔄 Refreshing access token for custom sender...');
    
    if (!oauth2Client) {
      await initializeOAuth2Client();
    }

    if (!oauth2Client.credentials.refresh_token) {
      throw new Error('No refresh token available. Please visit /gmail-auth-select to re-authorize.');
    }

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to obtain new access token');
    }

    // Update cached credentials
    cachedCredentials.access_token = credentials.access_token;
    cachedCredentials.expiry_date = credentials.expiry_date;
    
    // Update OAuth2 client
    oauth2Client.setCredentials({
      refresh_token: cachedCredentials.refresh_token,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date
    });

    lastTokenRefresh = Date.now();
    
    const expiresIn = credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000 / 60) : 60;
    logger.info(`✅ Custom access token refreshed successfully, expires in ${expiresIn} minutes`);
    
    return credentials.access_token;
  } catch (error) {
    logger.error('❌ Failed to refresh custom access token:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      throw new Error('Refresh token is invalid or expired. Please visit /gmail-auth-select to re-authorize.');
    }
    
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

// Ensure valid access token
async function ensureValidAccessToken() {
  try {
    const now = Date.now();
    
    // Initialize client if not already done
    if (!oauth2Client) {
      await initializeOAuth2Client();
    }

    // Check if we need to refresh the token
    const needsRefresh = (
      !oauth2Client.credentials.access_token ||
      (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date <= now + 5 * 60 * 1000) ||
      (now - lastTokenRefresh > TOKEN_REFRESH_INTERVAL)
    );

    if (needsRefresh) {
      const accessToken = await refreshAccessToken();
      return accessToken;
    }

    const expiresIn = oauth2Client.credentials.expiry_date ? 
      Math.floor((oauth2Client.credentials.expiry_date - now) / 1000 / 60) : 'unknown';
    logger.info(`✅ Using existing custom access token, expires in ${expiresIn} minutes`);
    
    return oauth2Client.credentials.access_token;
  } catch (error) {
    logger.error('❌ Failed to ensure valid custom access token:', error.message);
    throw error;
  }
}

// Helper function to check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Simple email template (fallback)
const simpleEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>New Form-To Submission</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .field { margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-top: 5px; }
        .footer { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666; }
        .custom-destination { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h2>📧 New Form-To Submission</h2>
        <p>Received on {{submissionDate}} at {{submissionTime}}</p>
        <div class="custom-destination">
            <strong>📍 Custom Destination:</strong> This email was sent to a custom destination address via Form-To feature
        </div>
    </div>
    
    <div class="content">
        <div class="field">
            <div class="label">Name:</div>
            <div class="value">{{name}}</div>
        </div>
        
        <div class="field">
            <div class="label">Email:</div>
            <div class="value">{{email}}</div>
        </div>
        
        <div class="field">
            <div class="label">Subject:</div>
            <div class="value">{{subject}}</div>
        </div>
        
        {{#if phone}}
        <div class="field">
            <div class="label">Phone:</div>
            <div class="value">{{phone}}</div>
        </div>
        {{/if}}
        
        {{#if company}}
        <div class="field">
            <div class="label">Company:</div>
            <div class="value">{{company}}</div>
        </div>
        {{/if}}
        
        <div class="field">
            <div class="label">Message:</div>
            <div class="value" style="white-space: pre-wrap;">{{message}}</div>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>Submission ID:</strong> {{submissionId}}</p>
        <p><strong>IP Address:</strong> {{ipAddress}}</p>
        <p><strong>Timestamp:</strong> {{timestamp}}</p>
        <p><strong>Route:</strong> Form-To (Custom Destinations)</p>
        <p>This email was generated automatically by your form-to submission system.</p>
    </div>
</body>
</html>
`;

// Load and compile templates
async function loadTemplate(templateId) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.html`);
    
    const templateExists = await fileExists(templatePath);
    if (!templateExists) {
      logger.warn(`Template not found: ${templateId}, using simple template for custom sender`);
      return handlebars.compile(simpleEmailTemplate);
    }
    
    const template = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(template);
  } catch (error) {
    logger.warn('Template loading error for custom sender, using simple template', { templateId, error: error.message });
    return handlebars.compile(simpleEmailTemplate);
  }
}

// Create email message
function createEmailMessage(to, subject, htmlContent, textContent, fromEmail = null) {
  const from = fromEmail || cachedCredentials?.email_address || process.env.TO_EMAIL || 'noreply@example.com';
  const replyTo = fromEmail || cachedCredentials?.email_address || process.env.TO_EMAIL || 'noreply@example.com';
  
  const messageParts = [
    `To: ${to}`,
    `From: ${from}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary123"',
    '',
    '--boundary123',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    textContent,
    '',
    '--boundary123',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlContent,
    '',
    '--boundary123--'
  ];

  return messageParts.join('\n');
}

// Convert HTML to plain text
function htmlToText(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Main email sending function for custom destinations
export async function sendEmailToCustomDestinations(formData) {
  const emailId = `custom_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('🚀 Starting custom email send process', {
      emailId,
      submissionId: formData.submissionId,
      template: formData.template_id,
      destinationCount: formData.destinationEmails.length
    });

    // Validate required environment variables
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error('CLIENT_ID and CLIENT_SECRET must be configured. Please visit /gmail-auth-select for setup.');
    }

    // Ensure we have a valid access token
    const accessToken = await ensureValidAccessToken();
    if (!accessToken) {
      throw new Error('Failed to obtain valid access token');
    }
    
    logger.info('✅ Valid access token confirmed for custom sender', { emailId });

    // Prepare template data
    const templateData = {
      ...formData,
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      currentYear: new Date().getFullYear(),
      submissionDate: new Date(formData.timestamp).toLocaleDateString(),
      submissionTime: new Date(formData.timestamp).toLocaleTimeString(),
      browserInfo: formData.userAgent,
      ipAddress: formData.ip
    };

    // Load and compile template
    const template = await loadTemplate(formData.template_id);
    const htmlContent = template(templateData);
    const textContent = htmlToText(htmlContent);
    
    logger.info('✅ Email template processed successfully for custom sender', { emailId, template: formData.template_id });

    // Create email subject
    const emailSubject = `New Form-To Submission: ${formData.subject}`;

    // Send emails to custom destinations
    const results = await sendToCustomDestinations(
      emailId,
      formData.destinationEmails,
      emailSubject,
      htmlContent,
      textContent,
      formData
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    logger.info('🎉 Custom email sending process completed', {
      emailId,
      submissionId: formData.submissionId,
      totalEmails: formData.destinationEmails.length,
      successCount,
      failureCount,
      template: formData.template_id
    });

    return {
      success: true,
      results,
      totalSent: successCount,
      totalFailed: failureCount,
      emailId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ Custom email sending failed', {
      emailId,
      submissionId: formData.submissionId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message,
      emailId,
      details: {
        timestamp: new Date().toISOString(),
        submissionId: formData.submissionId,
        hint: 'Check server logs for detailed error information'
      }
    };
  }
}

// Send emails to custom destinations with delays and logging
async function sendToCustomDestinations(emailId, destinationEmails, subject, htmlContent, textContent, formData) {
  const results = [];
  
  for (let i = 0; i < destinationEmails.length; i++) {
    const { key, email } = destinationEmails[i];
    const attemptNumber = i + 1;
    
    try {
      logger.info(`📤 Sending custom email ${attemptNumber}/${destinationEmails.length} to ${key}`, {
        emailId,
        recipient: email,
        envKey: key
      });
      
      // Create email message for this recipient
      const emailMessage = createEmailMessage(
        email,
        subject,
        htmlContent,
        textContent,
        formData.email
      );
      
      // Encode message
      const encodedMessage = Buffer.from(emailMessage).toString('base64url');
      
      // Send email via Gmail API
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      
      logger.info(`✅ ${key} success`, {
        emailId,
        recipient: email,
        messageId: result.data.id,
        envKey: key
      });
      
      results.push({
        success: true,
        envKey: key,
        email,
        messageId: result.data.id,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error(`❌ ${key} failed`, {
        emailId,
        recipient: email,
        envKey: key,
        error: error.message
      });
      
      results.push({
        success: false,
        envKey: key,
        email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add 1 second delay between emails (except for the last one)
    if (i < destinationEmails.length - 1) {
      logger.info(`⏳ Waiting 1 second before next custom email...`, { emailId });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}