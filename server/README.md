# 🚀 Express.js Form Backend with Gmail API

A production-ready, secure Express.js backend for handling form submissions with Gmail API integration. Built with modern security practices and designed for easy deployment on Render.com.

## ✨ Features

- **🔐 Secure Form Processing**: XSS protection, input validation, and spam prevention
- **📧 Gmail API Integration**: Send emails via Gmail using OAuth2 (no SMTP required)
- **🎨 Beautiful Email Templates**: Multiple responsive HTML templates with dynamic content
- **🛡️ Advanced Security**: Rate limiting, CORS protection, and comprehensive logging
- **📊 Production Ready**: Deployment-ready with proper error handling and monitoring
- **🎯 Anti-Spam**: Honeypot fields and IP-based rate limiting
- **📱 Responsive Design**: Mobile-friendly email templates

## 🏗️ Architecture

```
/server
├── /routes
│   └── formRoutes.js        # API routes and validation
├── /templates
│   ├── default.html         # Default email template
│   ├── contact.html         # Contact form template
│   ├── inquiry.html         # Business inquiry template
│   └── support.html         # Support request template
├── /utils
│   └── gmailSender.js       # Gmail API integration
├── server.js                # Main application server
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variables template
├── render.yaml              # Render.com deployment config
└── README.md                # This file
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd server
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `CLIENT_ID`: Google OAuth2 Client ID
- `CLIENT_SECRET`: Google OAuth2 Client Secret
- `REFRESH_TOKEN`: Gmail API refresh token
- `TO_EMAIL`: Destination email address
- `FRONTEND_DOMAIN`: Your frontend domain for CORS

### 3. Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth2 credentials
5. Use [OAuth2 Playground](https://developers.google.com/oauthplayground) to get refresh token

### 4. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### POST `/submit-form`

Submit a form with the following fields:

**Required Fields:**
- `name`: String (1-100 chars, letters/spaces/hyphens only)
- `email`: Valid email address
- `subject`: String (1-200 chars)
- `message`: String (1-5000 chars)

**Optional Fields:**
- `template_id`: `default|contact|inquiry|support` (default: `default`)
- `phone`: Valid phone number
- `company`: Company name (max 100 chars)
- `_honey`: Honeypot field (leave empty)

**Example Request:**
```bash
curl -X POST http://localhost:3000/submit-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Hello World",
    "message": "This is a test message",
    "template_id": "contact"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "submissionId": "sub_1234567890_abc123def",
  "messageId": "gmail_message_id_here",
  "processingTime": 1247,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET `/health`

Health check endpoint:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

## 🎨 Email Templates

### Default Template (`default.html`)
- Clean, professional design
- Displays all form fields
- Includes submission metadata
- Mobile responsive

### Contact Template (`contact.html`)
- Optimized for contact forms
- Prominent contact information
- Call-to-action buttons
- Business-focused design

### Inquiry Template (`inquiry.html`)
- Designed for business inquiries
- Priority indicators
- Professional styling
- Action-oriented layout

### Support Template (`support.html`)
- Support ticket formatting
- SLA information
- Urgency indicators
- Customer service focused

### Template Variables

All templates support these variables:
- `{{name}}` - Submitter's name
- `{{email}}` - Submitter's email
- `{{subject}}` - Form subject
- `{{message}}` - Form message
- `{{phone}}` - Phone number (optional)
- `{{company}}` - Company name (optional)
- `{{submissionId}}` - Unique submission ID
- `{{submissionDate}}` - Submission date
- `{{submissionTime}}` - Submission time
- `{{currentYear}}` - Current year
- `{{ipAddress}}` - Submitter's IP
- `{{browserInfo}}` - User agent string

## 🛡️ Security Features

### Rate Limiting
- **General**: 100 requests per 15 minutes per IP
- **Form Submissions**: 5 submissions per 10 minutes per IP
- **Headers**: Standard rate limit headers included

### Input Validation
- **Joi Schema**: Comprehensive validation rules
- **XSS Protection**: All inputs sanitized
- **Length Limits**: Prevent oversized submissions
- **Type Validation**: Strict type checking

### CORS Protection
- **Domain Whitelist**: Only allowed origins accepted
- **Credentials**: Secure credential handling
- **Methods**: Limited to necessary HTTP methods

### Spam Prevention
- **Honeypot Fields**: Hidden fields to catch bots
- **IP Tracking**: Rate limiting by IP address
- **Content Validation**: Pattern matching for valid content

## 🚀 Deployment

### Render.com (Recommended)

1. **Fork this repository**
2. **Connect to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New Web Service"
   - Connect your repository

3. **Environment Variables**:
   Set these in Render dashboard:
   ```
   CLIENT_ID=your-google-client-id
   CLIENT_SECRET=your-google-client-secret
   REFRESH_TOKEN=your-refresh-token
   TO_EMAIL=destination@email.com
   FRONTEND_DOMAIN=https://yourfrontend.com
   ```

4. **Deploy**: Render will automatically deploy using `render.yaml`

### Manual Deployment

```bash
# Build and start
npm install
npm start
```

## 📊 Monitoring & Logging

### Winston Logging
- **Error Logs**: `error.log`
- **Combined Logs**: `combined.log`
- **Form Submissions**: `form-submissions.log`
- **Email Logs**: `email.log`

### Log Levels
- **Error**: System errors and failures
- **Warn**: Security issues and validation failures
- **Info**: Successful operations and status updates
- **Debug**: Detailed debugging information

### Monitoring Endpoints
- **Health Check**: `GET /health`
- **Submission Status**: `GET /submission/:id`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `CLIENT_ID` | Google OAuth2 Client ID | Yes | - |
| `CLIENT_SECRET` | Google OAuth2 Client Secret | Yes | - |
| `REFRESH_TOKEN` | Gmail API Refresh Token | Yes | - |
| `REDIRECT_URI` | OAuth2 Redirect URI | No | `https://developers.google.com/oauthplayground` |
| `TO_EMAIL` | Destination email address | Yes | - |
| `FRONTEND_DOMAIN` | Frontend domain for CORS | Yes | - |
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment mode | No | `development` |
| `LOG_LEVEL` | Logging level | No | `info` |

### CORS Configuration

Update the `corsOptions` in `server.js` to match your frontend domains:

```javascript
const allowedOrigins = [
  process.env.FRONTEND_DOMAIN,
  'http://localhost:3000',
  'http://localhost:5173',
  // Add your domains here
];
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the [Issues](https://github.com/yourusername/yourrepo/issues) page
2. Review the logs for error details
3. Ensure all environment variables are set correctly
4. Verify Gmail API credentials and permissions

## 🎯 Roadmap

- [ ] Database integration for form storage
- [ ] Email template editor
- [ ] Advanced spam detection
- [ ] Webhook support
- [ ] Form builder integration
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] File upload handling

---

Built with ❤️ for modern web applications