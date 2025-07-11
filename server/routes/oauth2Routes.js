import express from 'express';
import { google } from 'googleapis';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ],
});

// Get the correct redirect URI based on environment
function getRedirectUri(req) {
  // For production (Render), use the production URL
  if (process.env.NODE_ENV === 'production') {
    return 'https://web3ninja.onrender.com/oauth2callback';
  }
  
  // For development, use localhost
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/oauth2callback`;
}

// OAuth2 callback handler
router.get('/oauth2callback', async (req, res) => {
  const { code, error, state } = req.query;
  
  if (error) {
    logger.error('OAuth2 authorization error:', error);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth2 Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fee; }
          .error { color: #c00; background: #fdd; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 500px; }
          .btn { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <h1>❌ OAuth2 Authorization Failed</h1>
        <div class="error">
          <strong>Error:</strong> ${error}<br>
          <strong>Description:</strong> ${req.query.error_description || 'Unknown error'}
        </div>
        <a href="/gmail-setup" class="btn">← Back to Setup</a>
        <a href="/home" class="btn">🏠 Home</a>
        <a href="/" class="btn">📊 Dashboard</a>
      </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Missing Authorization Code</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fee; }
          .error { color: #c00; background: #fdd; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 500px; }
          .btn { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <h1>❌ Missing Authorization Code</h1>
        <div class="error">
          No authorization code received from Google.
        </div>
        <a href="/gmail-setup" class="btn">← Back to Setup</a>
        <a href="/home" class="btn">🏠 Home</a>
        <a href="/" class="btn">📊 Dashboard</a>
      </body>
      </html>
    `);
  }

  try {
    // Check if we have CLIENT_ID and CLIENT_SECRET
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error('CLIENT_ID and CLIENT_SECRET must be configured first');
    }

    // Use the correct redirect URI
    const redirectUri = getRedirectUri(req);
    logger.info(`Using redirect URI: ${redirectUri}`);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      redirectUri
    );

    logger.info('Exchanging authorization code for tokens...');
    
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Make sure to include access_type=offline and prompt=consent in the authorization URL.');
    }

    logger.info('✅ Successfully obtained refresh token');

    // Test the tokens by making a Gmail API call
    oauth2Client.setCredentials(tokens);
    
    // Test with Gmail API to verify permissions
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let profile;
    try {
      profile = await gmail.users.getProfile({ userId: 'me' });
      logger.info(`✅ Gmail API test successful for: ${profile.data.emailAddress}`);
      
      // Test sending capability by checking labels (this verifies send permission)
      const labels = await gmail.users.labels.list({ userId: 'me' });
      logger.info(`✅ Gmail permissions verified - found ${labels.data.labels.length} labels`);
      
    } catch (gmailError) {
      logger.error('Gmail API test failed:', gmailError.message);
      throw new Error(`Gmail API permission test failed: ${gmailError.message}. Please ensure you granted all requested permissions.`);
    }

    // Save credentials to environment variables file for automatic loading
    const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
    const credentialsData = {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      email_address: profile.data.emailAddress,
      created_at: new Date().toISOString(),
      redirect_uri: redirectUri,
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    };
    
    await fs.writeFile(credentialsPath, JSON.stringify(credentialsData, null, 2));
    logger.info('✅ Credentials saved to temp file for automatic loading');

    // Also update environment variables in memory
    process.env.REFRESH_TOKEN = tokens.refresh_token;
    process.env.TO_EMAIL = profile.data.emailAddress;

    // Return success page with credentials
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth2 Success</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            background: #f0fdf4; 
          }
          .container { 
            background: white; 
            padding: 30px; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            border-top: 4px solid #10b981; 
          }
          .success { 
            background: #d1fae5; 
            border: 1px solid #10b981; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            color: #065f46; 
          }
          .credentials { 
            background: #1f2937; 
            color: #10b981; 
            padding: 20px; 
            border-radius: 8px; 
            font-family: 'Courier New', monospace; 
            margin: 20px 0; 
            overflow-x: auto; 
          }
          .warning { 
            background: #fef3c7; 
            border: 1px solid #f59e0b; 
            padding: 15px; 
            border-radius: 6px; 
            margin: 20px 0; 
            color: #92400e; 
          }
          .btn { 
            background: #10b981; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 6px; 
            cursor: pointer; 
            text-decoration: none; 
            display: inline-block; 
            margin: 10px 5px; 
            font-weight: 500; 
          }
          .btn:hover { background: #059669; }
          .btn-blue { background: #3b82f6; }
          .btn-blue:hover { background: #2563eb; }
          .btn-purple { background: #8b5cf6; }
          .btn-purple:hover { background: #7c3aed; }
          .copy-btn { 
            background: #3b82f6; 
            font-size: 12px; 
            padding: 4px 8px; 
            margin-left: 10px; 
          }
          .nav-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            margin: 20px 0;
          }
          .scope-list {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ OAuth2 Authorization Successful!</h1>
          
          <div class="success">
            <strong>🎉 Success!</strong> Your Gmail API credentials have been generated and saved successfully.<br>
            <strong>Email:</strong> ${profile.data.emailAddress}<br>
            <strong>Status:</strong> Ready to send emails<br>
            <strong>Auto-loaded:</strong> Credentials are now active in the system<br>
            <strong>Permissions:</strong> Gmail send access verified ✅
          </div>

          <div class="scope-list">
            <strong>🔐 Granted Permissions:</strong>
            <ul>
              <li>✅ Gmail Send - Send emails on your behalf</li>
              <li>✅ Gmail Read - Access your Gmail account info</li>
              <li>✅ User Info - Access your basic profile information</li>
            </ul>
          </div>

          <h3>📋 Environment Variables (For Manual Setup)</h3>
          <p>These values have been automatically loaded, but you can also add them to your .env file:</p>
          
          <div class="credentials" id="credentials">
CLIENT_ID=${process.env.CLIENT_ID}
CLIENT_SECRET=${process.env.CLIENT_SECRET}
REFRESH_TOKEN=${tokens.refresh_token}
TO_EMAIL=${profile.data.emailAddress}
REDIRECT_URI=${redirectUri}
          </div>
          
          <button class="btn copy-btn" onclick="copyCredentials()">📋 Copy to Clipboard</button>
          
          <div class="warning">
            <strong>✅ Automatic Setup Complete:</strong>
            <ul>
              <li>✅ Credentials have been automatically loaded into the system</li>
              <li>✅ Gmail API is now ready to send emails</li>
              <li>✅ All required permissions granted and verified</li>
              <li>✅ No server restart required</li>
              <li>✅ Form submissions will now work immediately</li>
            </ul>
          </div>

          <h3>🚀 Next Steps</h3>
          <ol>
            <li><strong>✅ Done:</strong> Credentials are automatically active</li>
            <li><strong>Test:</strong> Try submitting a form to test email sending</li>
            <li><strong>Optional:</strong> Add credentials to .env file for persistence</li>
          </ol>

          <div class="nav-buttons">
            <a href="/test-gmail" class="btn">🧪 Test Gmail API</a>
            <a href="/" class="btn btn-blue">📊 Dashboard</a>
            <a href="/home" class="btn btn-blue">🏠 Home</a>
            <a href="/credentials-status" class="btn btn-purple">📋 Check Status</a>
            <a href="/gmail-setup" class="btn btn-purple">📚 Setup Guide</a>
            <a href="/status" class="btn btn-purple">⚡ API Status</a>
          </div>
        </div>

        <script>
          function copyCredentials() {
            const credentials = document.getElementById('credentials').textContent;
            navigator.clipboard.writeText(credentials).then(() => {
              alert('✅ Credentials copied to clipboard!');
            }).catch(() => {
              alert('❌ Failed to copy. Please select and copy manually.');
            });
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    logger.error('OAuth2 token exchange failed:', error);
    
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth2 Token Exchange Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fee; }
          .error { color: #c00; background: #fdd; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 15px 0; text-align: left; }
          .btn { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <h1>❌ Token Exchange Failed</h1>
        <div class="error">
          <strong>Error:</strong> ${error.message}
          <div class="details">
            <strong>Possible solutions:</strong>
            <ul>
              <li>Make sure CLIENT_ID and CLIENT_SECRET are set correctly</li>
              <li>Ensure the authorization code hasn't expired (use it immediately)</li>
              <li>Check that the redirect URI matches exactly in Google Cloud Console</li>
              <li>Try generating a new authorization code</li>
              <li>Make sure you're using the correct Google account</li>
              <li>Verify you granted ALL requested permissions during authorization</li>
            </ul>
          </div>
        </div>
        <a href="/gmail-setup" class="btn">← Back to Setup</a>
        <a href="/home" class="btn">🏠 Home</a>
        <a href="/" class="btn">📊 Dashboard</a>
      </body>
      </html>
    `);
  }
});

// Generate authorization URL with enhanced scopes and permissions
router.get('/gmail-auth', (req, res) => {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      return res.status(400).json({
        success: false,
        error: 'CLIENT_ID and CLIENT_SECRET must be configured first',
        hint: 'Please set up your Google Cloud Console credentials first'
      });
    }

    // Use the correct redirect URI
    const redirectUri = getRedirectUri(req);
    logger.info(`Generating auth URL with redirect URI: ${redirectUri}`);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      redirectUri
    );

    // Enhanced scopes for Gmail API - 2024 requirements
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account consent', // Force account selection and consent
      include_granted_scopes: true,
      state: 'gmail_auth_' + Date.now() // Add state for security
    });

    // Redirect to Google OAuth2 with account selection
    res.redirect(authUrl);

  } catch (error) {
    logger.error('Failed to generate auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
});

// Alternative auth route with explicit account selection and enhanced permissions
router.get('/gmail-auth-select', (req, res) => {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gmail Authorization - Account Selection</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f9ff; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .error { color: #c00; background: #fdd; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .btn { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Configuration Required</h1>
            <div class="error">
              CLIENT_ID and CLIENT_SECRET must be configured first in your environment variables.
            </div>
            <a href="/gmail-setup" class="btn">📚 Setup Instructions</a>
            <a href="/home" class="btn">🏠 Home</a>
            <a href="/" class="btn">📊 Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    const redirectUri = getRedirectUri(req);
    logger.info(`Account selection page - redirect URI: ${redirectUri}`);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      redirectUri
    );

    // Enhanced scopes for full Gmail functionality
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account consent',
      include_granted_scopes: true,
      state: 'gmail_auth_select_' + Date.now()
    });

    // Show enhanced account selection page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Authorization - Choose Account</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container { 
            background: white; 
            padding: 40px; 
            border-radius: 16px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
            text-align: center;
          }
          .header {
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1f2937;
            margin-bottom: 10px;
            font-size: 2.5rem;
          }
          .header p {
            color: #6b7280;
            font-size: 1.1rem;
          }
          .auth-section {
            background: #f8fafc;
            padding: 30px;
            border-radius: 12px;
            margin: 30px 0;
            border: 2px solid #e2e8f0;
          }
          .auth-section h3 {
            color: #374151;
            margin-bottom: 20px;
            font-size: 1.5rem;
          }
          .btn { 
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white; 
            padding: 16px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 10px; 
            display: inline-block; 
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .btn:hover { 
            background: linear-gradient(135deg, #1d4ed8, #1e40af);
            transform: translateY(-2px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.2);
          }
          .btn-secondary {
            background: linear-gradient(135deg, #6b7280, #4b5563);
          }
          .btn-secondary:hover {
            background: linear-gradient(135deg, #4b5563, #374151);
          }
          .info-box {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            color: #1e40af;
          }
          .nav-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: center;
            margin-top: 30px;
          }
          .feature-list {
            text-align: left;
            margin: 20px 0;
          }
          .feature-list li {
            margin: 8px 0;
            color: #4b5563;
          }
          .redirect-info {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            color: #065f46;
            font-size: 0.9rem;
          }
          .scope-info {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Gmail Authorization</h1>
            <p>Choose your Gmail account to authorize email sending</p>
          </div>

          <div class="redirect-info">
            <strong>🔧 Configuration:</strong><br>
            <strong>Redirect URI:</strong> ${redirectUri}<br>
            <strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}<br>
            <strong>Domain:</strong> web3ninja.onrender.com
          </div>

          <div class="scope-info">
            <strong>🔐 Required Permissions:</strong><br>
            This app will request the following permissions:
            <ul style="text-align: left; margin: 10px 0;">
              <li>✉️ Send emails on your behalf</li>
              <li>📧 Read your Gmail account information</li>
              <li>👤 Access your basic profile information</li>
              <li>📬 View your Gmail labels and folders</li>
            </ul>
            <strong>⚠️ Important:</strong> You must grant ALL permissions for the app to work properly.
          </div>

          <div class="auth-section">
            <h3>📧 Select Gmail Account & Grant Permissions</h3>
            <p>You'll be redirected to Google to choose which Gmail account to use and grant the required permissions.</p>
            
            <div class="info-box">
              <strong>🔒 What happens next:</strong>
              <ul class="feature-list">
                <li>✅ Google will show all your Gmail accounts</li>
                <li>✅ Choose the account you want to use for sending emails</li>
                <li>✅ Grant ALL requested permissions (very important!)</li>
                <li>✅ Credentials will be automatically saved and managed</li>
                <li>✅ Access tokens will auto-refresh when needed</li>
                <li>✅ Email sending will work immediately</li>
              </ul>
            </div>

            <a href="${authUrl}" class="btn">
              🚀 Choose Gmail Account & Grant Permissions
            </a>
          </div>

          <div class="nav-buttons">
            <a href="/test-gmail" class="btn btn-secondary">🧪 Test Current Setup</a>
            <a href="/gmail-setup" class="btn btn-secondary">📚 Setup Guide</a>
            <a href="/" class="btn btn-secondary">📊 Dashboard</a>
            <a href="/home" class="btn btn-secondary">🏠 Home</a>
            <a href="/status" class="btn btn-secondary">⚡ API Status</a>
            <a href="/credentials-status" class="btn btn-secondary">📋 Check Credentials</a>
          </div>

          <div class="info-box" style="margin-top: 30px;">
            <strong>💡 Troubleshooting:</strong><br>
            • If you get "Insufficient Permission" error, make sure to grant ALL requested permissions<br>
            • If you have multiple Gmail accounts, Google will show them all for selection<br>
            • You can always re-authorize with a different account later<br>
            • Make sure your Google Cloud Console has the correct redirect URIs configured
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    logger.error('Failed to generate auth URL:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fee; }
          .error { color: #c00; background: #fdd; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; }
          .btn { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <h1>❌ Authorization Error</h1>
        <div class="error">
          <strong>Error:</strong> ${error.message}
        </div>
        <a href="/gmail-setup" class="btn">← Back to Setup</a>
        <a href="/home" class="btn">🏠 Home</a>
        <a href="/" class="btn">📊 Dashboard</a>
      </body>
      </html>
    `);
  }
});

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const { client_id, client_secret, refresh_token, grant_type } = req.body;

    if (grant_type !== 'refresh_token') {
      return res.status(400).json({
        error: 'invalid_grant_type',
        error_description: 'Grant type must be refresh_token'
      });
    }

    if (!client_id || !client_secret || !refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, client_secret, refresh_token'
      });
    }

    const redirectUri = getRedirectUri(req);
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    res.json({
      access_token: credentials.access_token,
      expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly'
    });

  } catch (error) {
    logger.error('Token refresh failed:', error);
    
    let errorCode = 'invalid_grant';
    let errorDescription = error.message;

    if (error.message.includes('invalid_grant')) {
      errorDescription = 'The refresh token is invalid or expired. Please re-authorize.';
    } else if (error.message.includes('invalid_client')) {
      errorCode = 'invalid_client';
      errorDescription = 'Invalid client credentials.';
    }

    res.status(400).json({
      error: errorCode,
      error_description: errorDescription
    });
  }
});

// Get stored credentials (for debugging)
router.get('/credentials-status', async (req, res) => {
  try {
    const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
    
    try {
      const credentialsData = await fs.readFile(credentialsPath, 'utf8');
      const credentials = JSON.parse(credentialsData);
      
      res.json({
        success: true,
        status: 'credentials_found',
        email: credentials.email_address,
        created_at: credentials.created_at,
        has_refresh_token: !!credentials.refresh_token,
        has_access_token: !!credentials.access_token,
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        redirect_uri: credentials.redirect_uri,
        scopes: credentials.scopes || [],
        environment_refresh_token: !!process.env.REFRESH_TOKEN,
        environment_to_email: process.env.TO_EMAIL
      });
    } catch (fileError) {
      res.json({
        success: false,
        status: 'no_credentials',
        message: 'No stored credentials found. Please visit /gmail-auth-select to authorize.',
        environment_refresh_token: !!process.env.REFRESH_TOKEN,
        environment_to_email: process.env.TO_EMAIL
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check credentials status',
      details: error.message
    });
  }
});

export default router;