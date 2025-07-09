import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader2, Server, Globe, Code, Zap, Shield, Mail } from 'lucide-react';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  company?: string;
  template_id: 'default' | 'contact' | 'inquiry' | 'support';
}

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  submissionId?: string;
  messageId?: string;
  processingTime?: number;
  timestamp?: string;
  details?: any;
}

function App() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    phone: '',
    company: '',
    template_id: 'default'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  // Get the current WebContainer API URL
  const getApiUrl = () => {
    // Use the live Render API URL
    return 'https://web3pro.onrender.com';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResponse(null);

    try {
      const apiUrl = `${getApiUrl()}/submit-form`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data: ApiResponse = await response.json();
      setResponse(data);

      if (data.success) {
        // Reset form on success
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
          phone: '',
          company: '',
          template_id: 'default'
        });
      }
    } catch (error) {
      setResponse({
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const testConnection = async () => {
    try {
      const apiUrl = `${getApiUrl()}/`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      setResponse({
        success: true,
        message: `API Status: ${data.status} - ${data.message} (v${data.version}) - Endpoints: ${Object.keys(data.endpoints).join(', ')}`,
      });
    } catch (error) {
      setResponse({
        success: false,
        error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
            <Server className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-4">
            Express.js Form Backend
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Production-ready form submission API with Gmail integration, security features, and beautiful email templates
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <button
              onClick={testConnection}
              className="group px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
              Test API Status
            </button>
            <div className="px-8 py-4 bg-white/80 backdrop-blur-sm rounded-xl text-sm text-blue-800 font-mono border border-blue-200 shadow-md flex items-center justify-center gap-2">
              <Globe className="w-4 h-4" />
              Live API: {getApiUrl()}
            </div>
          </div>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-gray-700 border border-gray-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              Security & Rate Limiting
            </div>
            <div className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-gray-700 border border-gray-200 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              Gmail API Integration
            </div>
            <div className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-gray-700 border border-gray-200 flex items-center gap-2">
              <Code className="w-4 h-4 text-purple-600" />
              RESTful API
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Submit Form</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="Your company"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Template
                </label>
                <select
                  name="template_id"
                  value={formData.template_id}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                >
                  <option value="default">Default Template</option>
                  <option value="contact">Contact Form</option>
                  <option value="inquiry">Business Inquiry</option>
                  <option value="support">Support Request</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                  placeholder="Your message here..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Response Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">API Response</h2>
            </div>
            
            {response ? (
              <div className={`p-6 rounded-xl border-l-4 animate-in slide-in-from-right duration-300 ${
                response.success 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400' 
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-400'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  {response.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600 animate-in zoom-in duration-300" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600 animate-in zoom-in duration-300" />
                  )}
                  <h3 className={`text-lg font-semibold ${
                    response.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {response.success ? 'Success!' : 'Error'}
                  </h3>
                </div>
                
                <div className="space-y-2 text-sm">
                  {response.message && (
                    <p className={response.success ? 'text-green-700' : 'text-red-700'}>
                      <strong>Message:</strong> {response.message}
                    </p>
                  )}
                  {response.error && (
                    <p className="text-red-700">
                      <strong>Error:</strong> {response.error}
                    </p>
                  )}
                  {response.hint && (
                    <p className="text-amber-700 bg-amber-50 p-2 rounded">
                      <strong>💡 Hint:</strong> {response.hint}
                    </p>
                  )}
                  {response.submissionId && (
                    <p className="text-green-700">
                      <strong>Submission ID:</strong> {response.submissionId}
                    </p>
                  )}
                  {response.messageId && (
                    <p className="text-green-700">
                      <strong>Gmail Message ID:</strong> {response.messageId}
                    </p>
                  )}
                  {response.processingTime && (
                    <p className="text-green-700">
                      <strong>Processing Time:</strong> {response.processingTime}ms
                    </p>
                  )}
                  {response.timestamp && (
                    <p className="text-gray-600">
                      <strong>Timestamp:</strong> {new Date(response.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>

                {response.details && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                      View Details
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                      {JSON.stringify(response.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Code className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg mb-6">Submit the form to see the API response here</p>
                <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl text-sm text-blue-700 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4" />
                    <p className="font-semibold">Setup Required:</p>
                  </div>
                  <p className="mb-2">To send emails, configure your Gmail API credentials in the server/.env file</p>
                  <p className="text-blue-600">See USERGUIDE.md for detailed setup instructions</p>
                </div>
              </div>
            )}

            {/* API Usage Instructions */}
            <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Using this API from another site:</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Root/Status:</strong> <code className="bg-white px-2 py-1 rounded">{getApiUrl()}/</code></p>
                <p><strong>Health:</strong> <code className="bg-white px-2 py-1 rounded">{getApiUrl()}/health</code></p>
                <p><strong>Endpoint:</strong> <code className="bg-white px-2 py-1 rounded">{getApiUrl()}/submit-form</code></p>
                <p><strong>Method:</strong> POST</p>
                <p><strong>Content-Type:</strong> application/json</p>
                <p><strong>Required fields:</strong> name, email, subject, message</p>
                <p><strong>Optional fields:</strong> phone, company, template_id</p>
                <p><strong>⚠️ Note:</strong> Gmail API must be configured for email sending to work</p>
              </div>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center">
              <Code className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Integration Examples</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                JavaScript/Fetch
              </h3>
              <pre className="bg-gray-900 text-green-400 p-6 rounded-xl text-sm overflow-x-auto border border-gray-700 shadow-inner">
{`fetch('${getApiUrl()}/submit-form', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Hello',
    message: 'Test message',
    template_id: 'contact'
  })
})
.then(response => response.json())
.then(data => console.log(data));`}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                cURL
              </h3>
              <pre className="bg-gray-900 text-green-400 p-6 rounded-xl text-sm overflow-x-auto border border-gray-700 shadow-inner">
{`curl -X POST ${getApiUrl()}/submit-form \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Hello",
    "message": "Test message",
    "template_id": "contact"
  }'`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;