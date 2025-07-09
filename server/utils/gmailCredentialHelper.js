import { google } from 'googleapis';
import winston from 'winston';

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

/**
 * Helper function to test Gmail API credentials
 */
export async function testGmailCredentials() {
  try {
    logger.info('Testing Gmail API credentials...');
    
    // Check required environment variables
    const requiredVars = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN,
    });
    
    // Test token refresh
    logger.info('Attempting to refresh access token...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to obtain access token');
    }
    
    logger.info('✅ Access token obtained successfully');
    
    // Test Gmail API access
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    logger.info('Testing Gmail API access...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    logger.info(`✅ Gmail API test successful! Email: ${profile.data.emailAddress}`);
    
    return {
      success: true,
      message: 'Gmail API credentials are valid',
      emailAddress: profile.data.emailAddress,
      accessToken: credentials.access_token.substring(0, 20) + '...'
    };
    
  } catch (error) {
    logger.error('❌ Gmail API test failed:', error.message);
    
    let hint = '';
    if (error.message.includes('invalid_grant')) {
      hint = 'Your refresh token has expired. Please generate a new one using the OAuth2 Playground.';
    } else if (error.message.includes('invalid_client')) {
      hint = 'Your CLIENT_ID or CLIENT_SECRET is incorrect. Please check your Google Cloud Console credentials.';
    } else if (error.message.includes('Missing environment variables')) {
      hint = 'Please set all required environment variables in your .env file.';
    }
    
    return {
      success: false,
      error: error.message,
      hint
    };
  }
}

/**
 * Generate authorization URL for getting new refresh token
 */
export function generateAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send'
  ];
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  return url;
}

/**
 * Instructions for setting up Gmail API credentials
 */
export function getSetupInstructions() {
  return {
    title: "Gmail API Setup Instructions",
    steps: [
      {
        step: 1,
        title: "Google Cloud Console Setup",
        instructions: [
          "Go to https://console.cloud.google.com",
          "Create a new project or select an existing one",
          "Enable the Gmail API for your project",
          "Go to 'Credentials' → 'Create Credentials' → 'OAuth 2.0 Client IDs'",
          "Choose 'Web application' as the application type",
          "Add 'https://developers.google.com/oauthplayground' to authorized redirect URIs",
          "Save your CLIENT_ID and CLIENT_SECRET"
        ]
      },
      {
        step: 2,
        title: "Get Refresh Token",
        instructions: [
          "Go to https://developers.google.com/oauthplayground",
          "Click the settings gear icon (⚙️) in the top right",
          "Check 'Use your own OAuth credentials'",
          "Enter your CLIENT_ID and CLIENT_SECRET",
          "In the left panel, find 'Gmail API v1'",
          "Select 'https://www.googleapis.com/auth/gmail.send'",
          "Click 'Authorize APIs'",
          "Sign in with your Gmail account",
          "Click 'Exchange authorization code for tokens'",
          "Copy the 'Refresh token' value"
        ]
      },
      {
        step: 3,
        title: "Update Environment Variables",
        instructions: [
          "Create or update your .env file with:",
          "CLIENT_ID=your_client_id_here",
          "CLIENT_SECRET=your_client_secret_here", 
          "REFRESH_TOKEN=your_refresh_token_here",
          "TO_EMAIL=your_destination_email@gmail.com",
          "Restart your server after updating the .env file"
        ]
      }
    ],
    troubleshooting: [
      "If you get 'invalid_grant' error, your refresh token has expired - generate a new one",
      "If you get 'invalid_client' error, check your CLIENT_ID and CLIENT_SECRET",
      "Make sure your Gmail account has 2-factor authentication enabled",
      "The TO_EMAIL should be a Gmail address you have access to"
    ]
  };
}