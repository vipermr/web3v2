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
  defaultMeta: { service: 'gmail-sender' },
  transports: [
    new winston.transports.File({ filename: 'email.log' }),
    new winston.transports.Console()
  ],
});

// Global OAuth2 client and credentials
let oauth2Client = null;
let gmail = null;
let cachedCredentials = null;
let lastTokenRefresh = 0;
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes (Google tokens last 1 hour)

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
        logger.info('✅ Loading credentials from stored file');
        
        // Update environment variables in memory
        process.env.REFRESH_TOKEN = storedCredentials.refresh_token;
        process.env.TO_EMAIL = storedCredentials.email_address;
        
        return {
          refresh_token: storedCredentials.refresh_token,
          access_token: storedCredentials.access_token,
          expiry_date: storedCredentials.expiry_date,
          email_address: storedCredentials.email_address
        };
      }
    } catch (fileError) {
      logger.info('No stored credentials file found, using environment variables');
    }

    // Fallback to environment variables
    if (process.env.REFRESH_TOKEN) {
      return {
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: null, // Will be refreshed
        expiry_date: null,
        email_address: process.env.TO_EMAIL
      };
    }

    throw new Error('No credentials found in stored file or environment variables');
  } catch (error) {
    logger.error('Failed to load credentials:', error.message);
    throw error;
  }
}

// Save credentials to file
async function saveCredentials(credentials) {
  try {
    const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
    
    const credentialsData = {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: credentials.refresh_token,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
      email_address: credentials.email_address || process.env.TO_EMAIL,
      created_at: new Date().toISOString(),
      redirect_uri: getRedirectUri(),
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };
    
    await fs.writeFile(credentialsPath, JSON.stringify(credentialsData, null, 2));
    logger.info('✅ Credentials saved to file');
  } catch (error) {
    logger.warn('Could not save credentials to file:', error.message);
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
    logger.info(`✅ OAuth2 client initialized with redirect URI: ${redirectUri}`);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize OAuth2 client:', error.message);
    throw error;
  }
}

// Refresh access token with better error handling
async function refreshAccessToken() {
  try {
    logger.info('🔄 Refreshing access token...');
    
    if (!oauth2Client) {
      await initializeOAuth2Client();
    }

    if (!oauth2Client.credentials.refresh_token) {
      throw new Error('No refresh token available. Please visit /gmail-auth-select to re-authorize.');
    }

    // Use Google's refresh token endpoint directly for better control
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

    // Save updated credentials
    await saveCredentials(cachedCredentials);
    
    lastTokenRefresh = Date.now();
    
    const expiresIn = credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000 / 60) : 60;
    logger.info(`✅ Access token refreshed successfully, expires in ${expiresIn} minutes`);
    
    return credentials.access_token;
  } catch (error) {
    logger.error('❌ Failed to refresh access token:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      throw new Error('Refresh token is invalid or expired. Please visit /gmail-auth-select to re-authorize.');
    }
    
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

// Ensure valid access token with smart refresh logic
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
      (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date <= now + 5 * 60 * 1000) || // 5 minutes buffer
      (now - lastTokenRefresh > TOKEN_REFRESH_INTERVAL)
    );

    if (needsRefresh) {
      const accessToken = await refreshAccessToken();
      return accessToken;
    }

    // Token is still valid
    const expiresIn = oauth2Client.credentials.expiry_date ? 
      Math.floor((oauth2Client.credentials.expiry_date - now) / 1000 / 60) : 'unknown';
    logger.info(`✅ Using existing access token, expires in ${expiresIn} minutes`);
    
    return oauth2Client.credentials.access_token;
  } catch (error) {
    logger.error('❌ Failed to ensure valid access token:', error.message);
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
    <title>New Form Submission</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .field { margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-top: 5px; }
        .footer { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h2>📧 New Form Submission</h2>
        <p>Received on {{submissionDate}} at {{submissionTime}}</p>
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
        <p>This email was generated automatically by your form submission system.</p>
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
      logger.warn(`Template not found: ${templateId}, using simple template`);
      return handlebars.compile(simpleEmailTemplate);
    }
    
    const template = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(template);
  } catch (error) {
    logger.warn('Template loading error, using simple template', { templateId, error: error.message });
    return handlebars.compile(simpleEmailTemplate);
  }
}

// Create email message
function createEmailMessage(to, subject, htmlContent, textContent, fromEmail = null) {
  const from = fromEmail || process.env.TO_EMAIL || 'noreply@example.com';
  const replyTo = fromEmail || process.env.TO_EMAIL || 'noreply@example.com';
  
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

// Main email sending function
export async function sendEmail(formData) {
  const emailId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('🚀 Starting email send process', {
      emailId,
      submissionId: formData.submissionId,
      template: formData.template_id,
      to: process.env.TO_EMAIL
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
    
    logger.info('✅ Valid access token confirmed', { emailId });

    // Check if we have TO_EMAIL
    if (!process.env.TO_EMAIL) {
      throw new Error('TO_EMAIL not configured. Please visit /gmail-auth-select to authorize and set up email destination.');
    }

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
    
    logger.info('✅ Email template processed successfully', { emailId, template: formData.template_id });

    // Create email subject
    const emailSubject = `New Form Submission: ${formData.subject}`;

    // Create email message
    const emailMessage = createEmailMessage(
      process.env.TO_EMAIL,
      emailSubject,
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
    
    logger.info('✅ Gmail API send successful', { emailId, messageId: result.data.id });

    logger.info('🎉 Email sent successfully', {
      emailId,
      submissionId: formData.submissionId,
      messageId: result.data.id,
      to: process.env.TO_EMAIL,
      subject: emailSubject,
      template: formData.template_id
    });

    return {
      success: true,
      messageId: result.data.id,
      emailId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ Email sending failed', {
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

// Test email function
export async function testEmailConnection() {
  try {
    // Ensure valid access token
    await ensureValidAccessToken();

    const testData = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Connection',
      message: 'This is a test message to verify email functionality.',
      template_id: 'default',
      submissionId: 'test_' + Date.now(),
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1',
      userAgent: 'Test Agent'
    };

    const result = await sendEmail(testData);
    return result;

  } catch (error) {
    logger.error('Email connection test failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}