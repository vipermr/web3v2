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

// Global OAuth2 client and Gmail instance
let oauth2Client = null;
let gmail = null;
let lastTokenRefresh = 0;
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes

// Get the correct redirect URI based on environment
function getRedirectUri() {
  if (process.env.NODE_ENV === 'production') {
    return 'https://web3ninja.onrender.com/oauth2callback';
  }
  return 'http://localhost:3000/oauth2callback';
}

// Initialize OAuth2 client with proper credentials
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

    // Try to load credentials from stored file first
    let credentials = null;
    
    try {
      const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
      const credentialsData = await fs.readFile(credentialsPath, 'utf8');
      const storedCredentials = JSON.parse(credentialsData);
      
      if (storedCredentials.refresh_token) {
        logger.info('✅ Loading credentials from stored file');
        credentials = {
          refresh_token: storedCredentials.refresh_token,
          access_token: storedCredentials.access_token,
          expiry_date: storedCredentials.expiry_date
        };
        
        // Update environment variables in memory
        process.env.REFRESH_TOKEN = storedCredentials.refresh_token;
        process.env.TO_EMAIL = storedCredentials.email_address;
      }
    } catch (fileError) {
      logger.info('No stored credentials file found, using environment variables');
    }

    // Fallback to environment variables
    if (!credentials && process.env.REFRESH_TOKEN) {
      credentials = {
        refresh_token: process.env.REFRESH_TOKEN
      };
    }

    if (credentials) {
      oauth2Client.setCredentials(credentials);
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      logger.info(`✅ OAuth2 client initialized with redirect URI: ${redirectUri}`);
      return true;
    } else {
      throw new Error('No refresh token available');
    }
  } catch (error) {
    logger.error('Failed to initialize OAuth2 client:', error.message);
    throw error;
  }
}

// Auto-refresh access token if needed
async function ensureValidAccessToken() {
  const now = Date.now();
  
  // Initialize client if not already done
  if (!oauth2Client) {
    await initializeOAuth2Client();
  }

  // Check if we have a refresh token
  if (!oauth2Client.credentials.refresh_token) {
    throw new Error('No refresh token available. Please visit /gmail-auth-select to authorize.');
  }

  // Check if token needs refresh
  const needsRefresh = (
    now - lastTokenRefresh > TOKEN_REFRESH_INTERVAL ||
    !oauth2Client.credentials.access_token ||
    (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date <= now + 60000) // 1 minute buffer
  );

  if (needsRefresh) {
    logger.info('🔄 Access token expired or missing, refreshing...');
    
    try {
      // Use the refresh token to get a new access token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update the credentials
      oauth2Client.setCredentials({
        ...oauth2Client.credentials,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      });
      
      lastTokenRefresh = now;
      
      logger.info('✅ Access token refreshed successfully', {
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'unknown'
      });
      
      // Update stored credentials file
      try {
        const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
        const existingData = await fs.readFile(credentialsPath, 'utf8');
        const storedCredentials = JSON.parse(existingData);
        
        storedCredentials.access_token = credentials.access_token;
        storedCredentials.expiry_date = credentials.expiry_date;
        
        await fs.writeFile(credentialsPath, JSON.stringify(storedCredentials, null, 2));
        logger.info('✅ Updated stored credentials with new access token');
      } catch (updateError) {
        logger.warn('Could not update stored credentials file:', updateError.message);
      }
      
      return credentials.access_token;
    } catch (error) {
      logger.error('❌ Failed to refresh access token:', error.message);
      
      // If refresh fails, the refresh token might be invalid
      if (error.message.includes('invalid_grant')) {
        throw new Error('Refresh token is invalid or expired. Please visit /gmail-auth-select to re-authorize.');
      }
      
      throw new Error(`Token refresh failed: ${error.message}. Please re-authorize at /gmail-auth-select`);
    }
  }

  return oauth2Client.credentials.access_token;
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

// Helper function to load and compile templates
async function loadTemplate(templateId) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.html`);
    
    const templateExists = await fileExists(templatePath);
    if (!templateExists) {
      logger.warn(`Template not found: ${templateId}, falling back to default`);
      const defaultPath = path.join(__dirname, '..', 'templates', 'default.html');
      
      const defaultExists = await fileExists(defaultPath);
      if (!defaultExists) {
        throw new Error('Default template not found');
      }
      
      const defaultTemplate = await fs.readFile(defaultPath, 'utf-8');
      return handlebars.compile(defaultTemplate);
    }
    
    const template = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(template);
  } catch (error) {
    logger.error('Template loading error', { templateId, error: error.message });
    throw error;
  }
}

// Helper function to create email message
function createEmailMessage(to, subject, htmlContent, textContent, fromEmail = null) {
  const from = fromEmail || process.env.TO_EMAIL;
  const replyTo = fromEmail || process.env.TO_EMAIL;
  
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

// Helper function to convert text to plain text
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
    const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      logger.error('Missing environment variables', { missingEnvVars });
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}. Please visit /gmail-auth-select for setup.`);
    }

    // Ensure we have a valid access token (auto-refresh if needed)
    try {
      const accessToken = await ensureValidAccessToken();
      if (!accessToken) {
        throw new Error('Failed to obtain valid access token');
      }
      logger.info('✅ Valid access token confirmed', { emailId });
    } catch (authError) {
      logger.error('OAuth2 authentication failed', { 
        emailId, 
        error: authError.message,
        hint: 'Your credentials may have expired. Visit /gmail-auth-select to re-authorize.'
      });
      throw new Error(`Gmail authentication failed: ${authError.message}`);
    }

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
    let htmlContent, textContent;
    try {
      const template = await loadTemplate(formData.template_id);
      htmlContent = template(templateData);
      textContent = htmlToText(htmlContent);
      logger.info('✅ Email template processed successfully', { emailId, template: formData.template_id });
    } catch (templateError) {
      logger.error('Template processing failed', { emailId, error: templateError.message });
      throw new Error(`Template processing failed: ${templateError.message}`);
    }

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
    let result;
    try {
      result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      logger.info('✅ Gmail API send successful', { emailId, messageId: result.data.id });
    } catch (gmailError) {
      logger.error('Gmail API send failed', { 
        emailId, 
        error: gmailError.message,
        code: gmailError.code,
        hint: 'Check Gmail API permissions and TO_EMAIL address'
      });
      throw new Error(`Gmail send failed: ${gmailError.message}. Please check Gmail API permissions.`);
    }

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
      stack: error.stack,
      code: error.code
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
      emailId,
      details: {
        timestamp: new Date().toISOString(),
        submissionId: formData.submissionId,
        hint: 'Check server logs for detailed error information'
      }
    };
  }
}

// Test email function for debugging
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