# 📧 Form-To Feature Documentation

## Overview

The **Form-To** feature is a specialized route (`/form-to`) that allows users to send form submissions to custom email destinations. Unlike the standard form submission that uses predefined environment variables (TO_EMAIL, TO_EMAIL1-TO_EMAIL10), Form-To lets users dynamically specify up to 10 custom email addresses where they want to receive the form submission.

## Key Features

### 🎯 Dynamic Email Destinations
- **FROM_TO1** through **FROM_TO10**: Custom input fields for destination email addresses
- **Dynamic UI**: Add/remove email input fields with + and - buttons
- **Validation**: Ensures at least one destination email is provided
- **Flexible**: Send to 1-10 different email addresses per submission

### 🔧 Technical Specifications

#### API Endpoint
```
POST /form-to
```

#### Request Body
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Custom Destination Test",
  "message": "This will be sent to custom email addresses",
  "phone": "+1 (555) 123-4567",
  "company": "Acme Corp",
  "template_id": "contact",
  "FROM_TO1": "recipient1@example.com",
  "FROM_TO2": "recipient2@example.com",
  "FROM_TO3": "recipient3@example.com",
  "_honey": ""
}
```

#### Response Format
```json
{
  "success": true,
  "message": "Form submitted and emails sent to custom destinations successfully!",
  "submissionId": "form_to_1234567890_abc123",
  "emailResults": [
    {
      "success": true,
      "envKey": "FROM_TO1",
      "email": "recipient1@example.com",
      "messageId": "gmail_message_id_1",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    {
      "success": true,
      "envKey": "FROM_TO2", 
      "email": "recipient2@example.com",
      "messageId": "gmail_message_id_2",
      "timestamp": "2024-01-15T10:30:01.000Z"
    }
  ],
  "totalSent": 2,
  "totalFailed": 0,
  "destinationCount": 2,
  "processingTime": 2456,
  "timestamp": "2024-01-15T10:30:02.000Z"
}
```

## 🚀 Usage Examples

### HTML Form with JavaScript
```html
<form id="formToForm">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Your Email" required>
  <input type="text" name="subject" placeholder="Subject" required>
  <textarea name="message" placeholder="Message" required></textarea>
  
  <!-- Custom destination emails -->
  <input type="email" name="FROM_TO1" placeholder="Destination Email 1" required>
  <input type="email" name="FROM_TO2" placeholder="Destination Email 2">
  <input type="email" name="FROM_TO3" placeholder="Destination Email 3">
  
  <input type="hidden" name="_honey" value="">
  <button type="submit">Send to Custom Destinations</button>
</form>

<script>
document.getElementById('formToForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  try {
    const response = await fetch('/form-to', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    console.log('Form-To Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
});
</script>
```

### cURL Example
```bash
curl -X POST https://web3ninja.onrender.com/form-to \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Custom Destination Test",
    "message": "This message will be sent to custom email addresses",
    "FROM_TO1": "recipient1@example.com",
    "FROM_TO2": "recipient2@example.com",
    "FROM_TO3": "recipient3@example.com",
    "template_id": "contact"
  }'
```

### JavaScript/Fetch
```javascript
const formToData = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  subject: 'Partnership Inquiry',
  message: 'I would like to discuss a potential partnership opportunity.',
  company: 'Tech Solutions Inc',
  phone: '+1 (555) 987-6543',
  template_id: 'partnership',
  FROM_TO1: 'partnerships@company1.com',
  FROM_TO2: 'business@company2.com',
  FROM_TO3: 'contact@company3.com'
};

fetch('/form-to', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formToData)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log(`Successfully sent to ${data.totalSent} recipients`);
    console.log('Email Results:', data.emailResults);
  } else {
    console.error('Error:', data.error);
  }
});
```

## 🎨 User Interface Features

### Dynamic Input Management
- **Initial State**: Shows one email input field (FROM_TO1) with a "+" button
- **Add Functionality**: Click "+" to add more email input fields (up to 10 total)
- **Remove Functionality**: Click "-" to remove email input fields (minimum 1 required)
- **Auto-numbering**: Automatically renumbers FROM_TO fields when inputs are added/removed
- **Validation**: Prevents submission if no destination emails are provided

### Visual Design
- **Gradient Background**: Modern gradient background for visual appeal
- **Card Layout**: Clean card-based design with rounded corners and shadows
- **Color Coding**: Blue theme for consistency with the main application
- **Responsive**: Mobile-friendly responsive design
- **Interactive Elements**: Hover effects and smooth transitions

## 🔧 Backend Implementation

### Route Handler (`/routes/formToRoutes.js`)
- **Validation**: Uses Joi schema validation for all input fields
- **Spam Protection**: Honeypot field detection
- **Email Processing**: Extracts FROM_TO1-FROM_TO10 fields and sends to each valid email
- **Logging**: Comprehensive logging for debugging and monitoring
- **Stats Tracking**: Separate statistics tracking for Form-To submissions

### Email Sender (`/utils/gmailSenderCustom.js`)
- **OAuth2 Integration**: Reuses Gmail API credentials from main system
- **Template Support**: Supports all existing email templates
- **Error Handling**: Robust error handling with detailed logging
- **Rate Limiting**: 1-second delay between emails to prevent rate limiting
- **Result Tracking**: Detailed success/failure tracking for each destination

## 📊 Statistics and Monitoring

### Separate Stats Tracking
- **Endpoint**: `GET /form-to-stats`
- **Metrics**: Total messages, unique users, daily messages, weekly trends
- **Storage**: Separate `form-to-stats.json` file
- **Logging**: Dedicated log files (`form-to-submissions.log`, `email-custom.log`)

### Response Metrics
```json
{
  "success": true,
  "stats": {
    "totalMessages": 156,
    "totalUsers": 89,
    "todayMessages": 12,
    "weeklyData": [
      {"date": "2024-01-09", "messages": 8},
      {"date": "2024-01-10", "messages": 15},
      {"date": "2024-01-11", "messages": 23}
    ],
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🔒 Security Features

### Input Validation
- **Email Format**: Validates all FROM_TO fields as proper email addresses
- **Field Limits**: Enforces character limits on all input fields
- **Required Fields**: Ensures essential fields are provided
- **Sanitization**: XSS protection through input sanitization

### Spam Protection
- **Honeypot Field**: Hidden `_honey` field to catch bots
- **Rate Limiting**: IP-based rate limiting (configurable)
- **Pattern Validation**: Validates input patterns for names, phones, etc.

### Access Control
- **Gmail API**: Uses same OAuth2 credentials as main system
- **Token Management**: Automatic token refresh and validation
- **Error Handling**: Secure error messages without exposing sensitive data

## 🌐 Integration with Main System

### Shared Components
- **Gmail API**: Uses same OAuth2 client and credentials
- **Templates**: Supports all existing email templates (default, contact, inquiry, etc.)
- **Security**: Same security middleware and validation patterns
- **Logging**: Integrated with main logging system

### Differences from Standard Form
- **Destination Logic**: Uses FROM_TO fields instead of environment TO_EMAIL variables
- **UI Enhancement**: Dynamic add/remove functionality for email inputs
- **Separate Stats**: Maintains separate statistics and logs
- **Custom Validation**: Additional validation for destination email requirements

## 🎯 Use Cases

### Business Applications
1. **Multi-Department Routing**: Send inquiries to multiple departments simultaneously
2. **Team Notifications**: Notify entire project teams about form submissions
3. **Client Communication**: Send copies to multiple client contacts
4. **Backup Recipients**: Ensure important messages reach multiple people

### Personal Use
1. **Family Notifications**: Send event information to multiple family members
2. **Group Coordination**: Coordinate with multiple friends or colleagues
3. **Service Providers**: Contact multiple service providers with the same inquiry

## 🚀 Access Points

### Live Demo
- **URL**: `https://web3ninja.onrender.com/form-to`
- **Features**: Full interactive form with dynamic email inputs
- **Testing**: Real-time testing with actual email sending

### API Testing
```bash
# Test the Form-To endpoint
curl -X POST https://web3ninja.onrender.com/form-to \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","message":"Test message","FROM_TO1":"recipient@example.com"}'

# Get Form-To statistics
curl https://web3ninja.onrender.com/form-to-stats
```

## 📝 Notes

### Requirements
- **Gmail API**: Must be configured with valid OAuth2 credentials
- **Minimum Input**: At least one FROM_TO field must be provided
- **Maximum Destinations**: Limited to 10 custom email addresses (FROM_TO1-FROM_TO10)

### Best Practices
1. **Validation**: Always validate email addresses on the frontend
2. **User Experience**: Provide clear feedback about email sending status
3. **Error Handling**: Handle network errors and API failures gracefully
4. **Rate Limiting**: Be mindful of Gmail API rate limits when sending to multiple recipients

### Limitations
- **Gmail API Dependency**: Requires valid Gmail API credentials to function
- **Rate Limits**: Subject to Gmail API rate limiting (handled with delays)
- **Template Dependency**: Uses existing email templates (no custom templates per destination)

---

The Form-To feature provides a powerful and flexible way to send form submissions to custom email destinations, making it ideal for businesses and individuals who need to route messages to multiple recipients dynamically.