import { google } from 'googleapis';
import fs from 'fs';
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

// Initialize OAuth2 client
function initializeOAuth2Client() {
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    throw new Error('CLIENT_ID and CLIENT_SECRET must be configured');
  }

  oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI || 'https://developers.google.com/oauthplayground'
  );

  if (process.env.REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN,
    });
  }

  gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  logger.info('OAuth2 client initialized successfully');
}

// Auto-refresh access token if needed
async function ensureValidAccessToken() {
  const now = Date.now();
  
  // Check if we need to refresh the token
  if (!oauth2Client) {
    initializeOAuth2Client();
  }

  // If we don't have a refresh token, try to load from stored credentials
  if (!process.env.REFRESH_TOKEN) {
    await loadStoredCredentials();
  }

  // Check if token needs refresh (every 50 minutes or if no access token)
  const needsRefresh = (
    now - lastTokenRefresh > TOKEN_REFRESH_INTERVAL ||
    !oauth2Client.credentials.access_token ||
    (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date <= now + 60000) // 1 minute buffer
  );

  if (needsRefresh) {
    logger.info('Access token expired or missing, refreshing...');
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      lastTokenRefresh = now;
      
      logger.info('✅ Access token refreshed successfully', {
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'unknown'
      });
      
      return credentials.access_token;
    } catch (error) {
      logger.error('❌ Failed to refresh access token:', error.message);
      
      // If refresh fails, try to load stored credentials as fallback
      const storedToken = await loadStoredCredentials();
      if (storedToken) {
        return storedToken;
      }
      
      throw new Error(`Token refresh failed: ${error.message}. Please re-authorize at /gmail-auth`);
    }
  }

  return oauth2Client.credentials.access_token;
}

// Load stored credentials from file (fallback)
async function loadStoredCredentials() {
  try {
    const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
    const credentialsData = await fs.readFile(credentialsPath, 'utf8');
    const credentials = JSON.parse(credentialsData);
    
    if (credentials.refresh_token) {
      logger.info('Loading stored credentials from temp file');
      
      oauth2Client.setCredentials({
        refresh_token: credentials.refresh_token,
        access_token: credentials.access_token
      });
      
      // Try to refresh the token
      const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newCredentials);
      lastTokenRefresh = Date.now();
      
      logger.info('✅ Successfully loaded and refreshed stored credentials');
      return newCredentials.access_token;
    }
  } catch (error) {
    logger.warn('Could not load stored credentials:', error.message);
  }
  
  return null;
}

// Helper function to load and compile templates
function loadTemplate(templateId) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.html`);
    
    if (!fs.existsSync(templatePath)) {
      logger.warn(`Template not found: ${templateId}, falling back to default`);
      const defaultPath = path.join(__dirname, '..', 'templates', 'default.html');
      
      if (!fs.existsSync(defaultPath)) {
        throw new Error('Default template not found');
      }
      
      const defaultTemplate = fs.readFileSync(defaultPath, 'utf-8');
      return handlebars.compile(defaultTemplate);
    }
    
    const template = fs.readFileSync(templatePath, 'utf-8');
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
    logger.info('Starting email send process', {
      emailId,
      submissionId: formData.submissionId,
      template: formData.template_id,
      to: process.env.TO_EMAIL
    });

    // Validate required environment variables (REFRESH_TOKEN is optional if we have stored credentials)
    const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'TO_EMAIL'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      logger.error('Missing environment variables', { missingEnvVars });
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}. Please visit /gmail-auth for setup.`);
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
        hint: 'Your credentials may have expired. Visit /gmail-auth to re-authorize.'
      });
      throw new Error(`Gmail authentication failed: ${authError.message}. Please visit /gmail-auth to re-authorize.`);
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
      const template = loadTemplate(formData.template_id);
      htmlContent = template(templateData);
      textContent = htmlToText(htmlContent);
      logger.info('Email template processed successfully', { emailId, template: formData.template_id });
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
      logger.info('Gmail API send successful', { emailId, messageId: result.data.id });
    } catch (gmailError) {
      logger.error('Gmail API send failed', { 
        emailId, 
        error: gmailError.message,
        code: gmailError.code,
        hint: 'Check Gmail API permissions and TO_EMAIL address'
      });
      throw new Error(`Gmail send failed: ${gmailError.message}. Please check Gmail API permissions.`);
    }

    logger.info('Email sent successfully', {
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
    logger.error('Email sending failed', {
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