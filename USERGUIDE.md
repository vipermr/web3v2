# 📚 Express.js Form Backend API - User Guide

## 🚀 Quick Start

This API allows you to submit forms from any website and receive emails via Gmail. It's designed to be simple, secure, and production-ready.

### Base URL
```
https://your-render-app.onrender.com
```

### API Status
```bash
GET /status
```
Returns detailed API information, version, and available endpoints.

### Health Check
```bash
GET /health
```
Returns server status and uptime information.

## 📤 Form Submission

### Endpoint
```
POST /submit-form
```

### Required Headers
```
Content-Type: application/json
```

### Request Body

#### Required Fields
- `name` (string, 1-100 chars): Sender's full name
- `email` (string, valid email): Sender's email address  
- `subject` (string, 1-200 chars): Email subject line
- `message` (string, 1-5000 chars): Email message content

#### Optional Fields
- `phone` (string, max 20 chars): Phone number
- `company` (string, max 100 chars): Company name
- `template_id` (string): Email template to use
  - `default` - Basic template (default)
  - `contact` - Contact form template
  - `inquiry` - Business inquiry template
  - `support` - Support request template

#### Anti-Spam Field
- `_honey` (string): Leave empty - used for spam detection

### Example Request

#### JavaScript/Fetch
```javascript
const response = await fetch('https://your-api-url.com/submit-form', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Website Contact Form',
    message: 'Hello! I would like to get in touch about your services.',
    phone: '+1 (555) 123-4567',
    company: 'Acme Corp',
    template_id: 'contact'
  })
});

const data = await response.json();
console.log(data);
```

#### jQuery/AJAX
```javascript
$.ajax({
  url: 'https://your-api-url.com/submit-form',
  method: 'POST',
  contentType: 'application/json',
  data: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Contact Form',
    message: 'Your message here'
  }),
  success: function(data) {
    console.log('Success:', data);
  },
  error: function(xhr, status, error) {
    console.error('Error:', error);
  }
});
```

#### cURL
```bash
curl -X POST https://your-api-url.com/submit-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Test Message",
    "message": "This is a test message from the API",
    "template_id": "default"
  }'
```

#### HTML Form with JavaScript
```html
<form id="contactForm">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <input type="text" name="subject" placeholder="Subject" required>
  <textarea name="message" placeholder="Your Message" required></textarea>
  <input type="hidden" name="_honey" value="">
  <button type="submit">Send Message</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  try {
    const response = await fetch('https://your-api-url.com/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Message sent successfully!');
      e.target.reset();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  }
});
</script>
```

## 📬 Response Format

### Success Response
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

### Error Response
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ],
  "submissionId": "sub_1234567890_abc123def"
}
```

## 🛡️ Security & Rate Limiting

### CORS Policy
- **Development**: Allows all origins (`*`)
- **Production**: Configure `FRONTEND_DOMAIN` in environment variables

### Rate Limiting (Configurable)
- **General API**: 100 requests per 15 minutes per IP (default)
- **Form Submissions**: 5 submissions per 10 minutes per IP (default)
- **Unlimited Mode**: Set `ENABLE_RATE_LIMITING=false` in environment

### Input Validation
- All inputs are sanitized against XSS attacks
- Field length limits enforced
- Email format validation
- Phone number format validation

### Spam Protection
- Honeypot field detection (`_honey`)
- IP-based rate limiting
- Input pattern validation

## 🎨 Email Templates

### Available Templates

#### 1. Default Template (`default`)
- Clean, professional design
- Shows all form fields
- Includes submission metadata
- Mobile responsive

#### 2. Contact Template (`contact`)
- Optimized for contact forms
- Prominent contact information
- Call-to-action buttons
- Business-focused design

#### 3. Inquiry Template (`inquiry`)
- Designed for business inquiries
- Priority indicators
- Professional styling
- Action-oriented layout

#### 4. Support Template (`support`)
- Support ticket formatting
- SLA information
- Urgency indicators
- Customer service focused

### Template Variables
All templates support these dynamic variables:
- `{{name}}` - Submitter's name
- `{{email}}` - Submitter's email
- `{{subject}}` - Form subject
- `{{message}}` - Form message
- `{{phone}}` - Phone number (if provided)
- `{{company}}` - Company name (if provided)
- `{{submissionId}}` - Unique submission ID
- `{{submissionDate}}` - Submission date
- `{{submissionTime}}` - Submission time
- `{{currentYear}}` - Current year
- `{{ipAddress}}` - Submitter's IP
- `{{browserInfo}}` - User agent string

## 🔧 Configuration

### Environment Variables

#### Required
```env
CLIENT_ID=your-google-oauth2-client-id
CLIENT_SECRET=your-google-oauth2-client-secret
REFRESH_TOKEN=your-gmail-api-refresh-token
TO_EMAIL=destination@email.com
```

#### Optional
```env
FRONTEND_DOMAIN=*                    # CORS origin (* for unlimited)
PORT=3000                           # Server port
NODE_ENV=production                 # Environment mode
LOG_LEVEL=info                      # Logging level
ENABLE_RATE_LIMITING=false          # Enable/disable rate limiting
ENABLE_STRICT_CORS=false            # Enable/disable strict CORS
```

### Gmail API Setup

1. **Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Gmail API

2. **OAuth2 Credentials**
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Add authorized redirect URI: `https://developers.google.com/oauthplayground`

3. **Get Refresh Token**
   - Go to [OAuth2 Playground](https://developers.google.com/oauthplayground)
   - Click settings gear → "Use your own OAuth credentials"
   - Enter your Client ID and Client Secret
   - Select Gmail API v1 scope: `https://www.googleapis.com/auth/gmail.send`
   - Authorize and get refresh token

## 🚨 Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `VALIDATION_ERROR` | Invalid input data | Check required fields and formats |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait before retrying |
| `FORM_RATE_LIMIT_EXCEEDED` | Too many form submissions | Wait before submitting again |
| `SPAM_DETECTED` | Honeypot field filled | Ensure `_honey` field is empty |
| `EMAIL_SEND_ERROR` | Gmail API error | Check Gmail API credentials |
| `CORS_ERROR` | Origin not allowed | Add domain to CORS whitelist |
| `INTERNAL_ERROR` | Server error | Check server logs |

## 🌐 Integration Examples

### React Component
```jsx
import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', subject: '', message: ''
  });
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const response = await fetch('https://your-api-url.com/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
};
```

### WordPress/PHP
```php
<?php
function submit_contact_form() {
    $data = array(
        'name' => sanitize_text_field($_POST['name']),
        'email' => sanitize_email($_POST['email']),
        'subject' => sanitize_text_field($_POST['subject']),
        'message' => sanitize_textarea_field($_POST['message'])
    );

    $response = wp_remote_post('https://your-api-url.com/submit-form', array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($data),
        'timeout' => 30
    ));

    if (is_wp_error($response)) {
        return array('success' => false, 'message' => 'Network error');
    }

    $body = wp_remote_retrieve_body($response);
    return json_decode($body, true);
}
?>
```

### Python/Requests
```python
import requests

def submit_form(name, email, subject, message):
    url = 'https://your-api-url.com/submit-form'
    data = {
        'name': name,
        'email': email,
        'subject': subject,
        'message': message,
        'template_id': 'default'
    }
    
    try:
        response = requests.post(url, json=data, timeout=30)
        return response.json()
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': str(e)}

# Usage
result = submit_form('John Doe', 'john@example.com', 'Hello', 'Test message')
print(result)
```

## 🔍 Testing

### Test Endpoints
```bash
# Health check
curl https://your-api-url.com/health

# Test form submission
curl -X POST https://your-api-url.com/submit-form \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Test message"}'
```

### Common Issues

1. **CORS Errors**
   - Solution: Set `FRONTEND_DOMAIN=*` for unlimited access
   - Or add your domain to the CORS whitelist

2. **Gmail API Errors**
   - Check OAuth2 credentials
   - Verify refresh token is valid
   - Ensure Gmail API is enabled

3. **Rate Limiting**
   - Set `ENABLE_RATE_LIMITING=false` for unlimited access
   - Or increase rate limit values

4. **Validation Errors**
   - Ensure all required fields are provided
   - Check field length limits
   - Verify email format

## 📞 Support

For issues and questions:
1. Check the error response for specific details
2. Review server logs for debugging information
3. Verify all environment variables are set correctly
4. Test with the provided examples

## 🎯 Best Practices

1. **Always validate input** on your frontend before sending
2. **Handle errors gracefully** with user-friendly messages
3. **Use appropriate templates** for different form types
4. **Implement loading states** for better UX
5. **Test thoroughly** before going live
6. **Monitor rate limits** if enabled
7. **Keep credentials secure** and never expose them client-side

---

Built with ❤️ for seamless form handling across the web!