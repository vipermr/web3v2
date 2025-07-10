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
        </style>
      </head>
      <body>
        <h1>❌ OAuth2 Authorization Failed</h1>
        <div class="error">
          <strong>Error:</strong> ${error}<br>
          <strong>Description:</strong> ${req.query.error_description || 'Unknown error'}
        </div>
        <p><a href="/gmail-setup">← Back to Setup</a></p>
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
        </style>
      </head>
      <body>
        <h1>❌ Missing Authorization Code</h1>
        <div class="error">
          No authorization code received from Google.
        </div>
        <p><a href="/gmail-setup">← Back to Setup</a></p>
      </body>
      </html>
    `);
  }

  try {
    // Check if we have CLIENT_ID and CLIENT_SECRET
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error('CLIENT_ID and CLIENT_SECRET must be configured first');
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      `${req.protocol}://${req.get('host')}/oauth2callback`
    );

    logger.info('Exchanging authorization code for tokens...');
    
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Make sure to include access_type=offline in the authorization URL.');
    }

    logger.info('✅ Successfully obtained refresh token');

    // Test the tokens by making a Gmail API call
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    logger.info(`✅ Gmail API test successful for: ${profile.data.emailAddress}`);

    // Save credentials to a temporary file (in production, you'd save to database)
    const credentialsPath = path.join(__dirname, '..', 'temp_credentials.json');
    await fs.writeFile(credentialsPath, JSON.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      email_address: profile.data.emailAddress,
      created_at: new Date().toISOString()
    }, null, 2));

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
          .copy-btn { 
            background: #3b82f6; 
            font-size: 12px; 
            padding: 4px 8px; 
            margin-left: 10px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ OAuth2 Authorization Successful!</h1>
          
          <div class="success">
            <strong>🎉 Success!</strong> Your Gmail API credentials have been generated successfully.<br>
            <strong>Email:</strong> ${profile.data.emailAddress}<br>
            <strong>Status:</strong> Ready to send emails
          </div>

          <h3>📋 Environment Variables</h3>
          <p>Copy these values to your <code>.env</code> file or Render environment variables:</p>
          
          <div class="credentials" id="credentials">
CLIENT_ID=${process.env.CLIENT_ID}
CLIENT_SECRET=${process.env.CLIENT_SECRET}
REFRESH_TOKEN=${tokens.refresh_token}
TO_EMAIL=${profile.data.emailAddress}
REDIRECT_URI=${req.protocol}://${req.get('host')}/oauth2callback
          </div>
          
          <button class="btn copy-btn" onclick="copyCredentials()">📋 Copy to Clipboard</button>
          
          <div class="warning">
            <strong>⚠️ Important:</strong>
            <ul>
              <li>Save these credentials securely</li>
              <li>Add them to your Render environment variables</li>
              <li>Restart your service after updating</li>
              <li>Never share these credentials publicly</li>
            </ul>
          </div>

          <h3>🚀 Next Steps</h3>
          <ol>
            <li>Copy the environment variables above</li>
            <li>Go to your Render dashboard</li>
            <li>Update your service's environment variables</li>
            <li>Restart your service</li>
            <li>Test the Gmail API using the test button</li>
          </ol>

          <div style="text-align: center; margin-top: 30px;">
            <a href="/test-gmail" class="btn">🧪 Test Gmail API</a>
            <a href="/" class="btn">🏠 Back to Home</a>
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
              <li>Check that the redirect URI matches exactly</li>
              <li>Try generating a new authorization code</li>
            </ul>
          </div>
        </div>
        <p><a href="/gmail-setup">← Back to Setup</a></p>
      </body>
      </html>
    `);
  }
});

// Generate authorization URL
router.get('/gmail-auth', (req, res) => {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      return res.status(400).json({
        success: false,
        error: 'CLIENT_ID and CLIENT_SECRET must be configured first',
        hint: 'Please set up your Google Cloud Console credentials first'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      `${req.protocol}://${req.get('host')}/oauth2callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true
    });

    // Redirect to Google OAuth2
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

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      `${req.protocol}://${req.get('host')}/oauth2callback`
    );

    oauth2Client.setCredentials({
      refresh_token: refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    res.json({
      access_token: credentials.access_token,
      expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.send'
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
        has_refresh_token: !!credentials.refresh_token
      });
    } catch (fileError) {
      res.json({
        success: false,
        status: 'no_credentials',
        message: 'No stored credentials found'
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