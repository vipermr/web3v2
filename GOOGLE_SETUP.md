# 🔑 Google OAuth2 Setup for Render Deployment

## Step 1: Google Cloud Console Configuration

### 1.1 Authorized JavaScript Origins
```
https://web3prov2.onrender.com
```

### 1.2 Authorized Redirect URIs
```
https://web3prov2.onrender.com/oauth2callback
https://developers.google.com/oauthplayground
```

## Step 2: Environment Variables for Render

Set these in your Render dashboard:

```env
CLIENT_ID=your_google_client_id_here
CLIENT_SECRET=your_google_client_secret_here
REDIRECT_URI=https://web3prov2.onrender.com/oauth2callback
TO_EMAIL=nafijrahaman19721@gmail.com
FRONTEND_DOMAIN=*
PORT=10000
NODE_ENV=production
ENABLE_RATE_LIMITING=false
ENABLE_STRICT_CORS=false
```

## Step 3: Authorization Process

### Option A: Automatic (Recommended)
1. Set CLIENT_ID and CLIENT_SECRET in Render
2. Restart your Render service
3. Visit: `https://web3prov2.onrender.com/gmail-auth`
4. Complete Google authorization
5. System automatically handles credentials

### Option B: Manual (OAuth2 Playground)
1. Go to https://developers.google.com/oauthplayground
2. Click settings gear → "Use your own OAuth credentials"
3. Enter your CLIENT_ID and CLIENT_SECRET
4. Select Gmail API v1 scope: `https://www.googleapis.com/auth/gmail.send`
5. Authorize and get refresh token
6. Add REFRESH_TOKEN to Render environment variables

## Step 4: Testing

1. Visit: `https://web3prov2.onrender.com/test-gmail`
2. Should show: "Gmail API credentials are valid"
3. Test form submission to verify email sending

## Troubleshooting

### Common Issues:
- **redirect_uri_mismatch**: Check authorized redirect URIs match exactly
- **invalid_client**: Verify CLIENT_ID and CLIENT_SECRET are correct
- **access_denied**: User denied authorization, try again
- **invalid_grant**: Refresh token expired, re-authorize

### Quick Fixes:
1. Ensure no trailing slashes in URIs
2. Use HTTPS for production URLs
3. Wait a few minutes after updating Google Cloud Console settings
4. Clear browser cache if authorization fails