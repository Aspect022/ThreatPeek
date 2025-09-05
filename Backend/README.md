# ThreatPeek Backend API 🖥️

The backend API server for ThreatPeek, built with Node.js and Express.js, providing RESTful endpoints for threat detection, analysis, and integration with various security services.

## 🎯 Overview

The Backend serves as the central API hub for the ThreatPeek platform, handling:

- **API Endpoints**: RESTful services for frontend and extension integration
- **Security Middleware**: Request validation, CORS, and security headers
- **Service Integration**: Communication with ML models and external services
- **Data Processing**: Request/response handling and data transformation
- **Authentication**: User management and session handling

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Security**: Helmet.js, CORS middleware
- **HTTP Client**: Axios for external API calls
- **Additional**: Security-focused middleware and utilities

## 📦 Dependencies

### Production Dependencies
```json
{
  "express": "^4.x.x",          // Web framework
  "helmet": "^7.x.x",           // Security middleware
  "cors": "^2.x.x",             // Cross-origin resource sharing
  "axios": "^1.x.x"             // HTTP client for external requests
}
```

### Development Dependencies
- Standard Node.js development tools
- Testing frameworks
- Code formatting and linting tools

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm (comes with Node.js)

### Installation

1. **Navigate to Backend directory**
   ```bash
   cd Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the Backend directory:
   ```env
   PORT=3000
   NODE_ENV=development
   
   # API Keys and External Services
   STEGOSHIELD_SERVICE_URL=http://localhost:8000
   
   # Security Configuration
   CORS_ORIGIN=http://localhost:3001
   
   # Add other environment variables as needed
   ```

### Running the Server

#### Development Mode
```bash
npm run dev
# Server starts at http://localhost:3000 with hot reload
```

#### Production Mode
```bash
npm start
# Server starts at http://localhost:3000
```

## 📋 Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run test suite
- `npm run lint` - Run code linting
- `npm run format` - Format code

## 🛣️ API Endpoints

### Health Check
```http
GET /health
```
Returns server status and health information.

### Security Analysis
```http
POST /api/scan
```
Submit content for security analysis.

**Request Body:**
```json
{
  "type": "image|text|url",
  "content": "content_to_analyze",
  "options": {
    "deepScan": true,
    "includeMetadata": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "threats": [],
    "confidence": 0.95,
    "metadata": {}
  }
}
```

### Anomaly Detection
```http
POST /api/anomaly/detect
```
Process data through ML anomaly detection models.

### Image Analysis
```http
POST /api/stego/analyze
```
Analyze images for steganographic content.

## 🔒 Security Features

### Middleware Stack
1. **Helmet.js**: Sets security-related HTTP headers
2. **CORS**: Configures cross-origin requests
3. **Input Validation**: Request sanitization and validation
4. **Rate Limiting**: API endpoint protection
5. **Error Handling**: Secure error responses

### Security Headers
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy
- HTTP Strict Transport Security (HSTS)

### Input Validation
All endpoints implement comprehensive input validation:
- Request body sanitization
- Parameter type checking
- Content-length limitations
- File upload restrictions

## 🔄 Service Integration

### StegnoShield Service
The backend integrates with the Python-based StegnoShield service for image analysis:

```javascript
// Example integration
const analyzeImage = async (imageData) => {
  const response = await axios.post(
    `${process.env.STEGOSHIELD_SERVICE_URL}/analyze`,
    { image: imageData }
  );
  return response.data;
};
```

### ML Model Integration
Connects with anomaly detection models for threat analysis:

```javascript
// Example anomaly detection call
const detectAnomalies = async (data) => {
  // Process through ML models
  // Return threat confidence and classification
};
```

## 📁 Project Structure

```
Backend/
├── 📄 server.js              # Main server entry point
├── 📄 package.json           # Dependencies and scripts
├── 📄 package-lock.json      # Dependency lock file
├── 📂 routes/               # API route definitions
│   ├── 📄 health.js         # Health check endpoints
│   ├── 📄 scan.js           # Security scanning APIs
│   └── 📄 analysis.js       # Analysis and detection APIs
├── 📂 middleware/           # Custom middleware
│   ├── 📄 security.js       # Security middleware
│   ├── 📄 validation.js     # Input validation
│   └── 📄 errorHandler.js   # Error handling
├── 📂 services/             # Business logic services
│   ├── 📄 anomalyService.js # Anomaly detection integration
│   ├── 📄 stegoService.js   # Steganography analysis
│   └── 📄 alertService.js   # Alert and notification handling
├── 📂 utils/                # Utility functions
│   ├── 📄 logger.js         # Logging utilities
│   └── 📄 helpers.js        # General helper functions
└── 📂 config/               # Configuration files
    ├── 📄 database.js       # Database configuration
    └── 📄 security.js       # Security configuration
```

## 🔧 Configuration

### Environment Variables
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# External Services
STEGOSHIELD_SERVICE_URL=http://localhost:8000
ML_SERVICE_URL=http://localhost:5000

# Security
CORS_ORIGIN=http://localhost:3001
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# Database (if used)
DATABASE_URL=your_database_url

# Third-party APIs
NOTIFICATION_SERVICE_API_KEY=your_api_key
```

### CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  optionsSuccessStatus: 200,
  credentials: true
};
```

## 🚨 Error Handling

The backend implements comprehensive error handling:

- **Validation Errors**: 400 Bad Request with detailed messages
- **Authentication Errors**: 401 Unauthorized
- **Authorization Errors**: 403 Forbidden
- **Not Found**: 404 for invalid endpoints
- **Server Errors**: 500 with sanitized error messages
- **Rate Limit**: 429 Too Many Requests

## 📊 Logging

Structured logging with different levels:
- **Error**: Critical errors and exceptions
- **Warn**: Warning conditions
- **Info**: General information
- **Debug**: Detailed debug information

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Structure
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Security Tests**: Vulnerability scanning
- **Performance Tests**: Load and stress testing

## 🚀 Deployment

### Production Deployment
1. **Environment Setup**
   ```bash
   export NODE_ENV=production
   export PORT=3000
   ```

2. **Install Production Dependencies**
   ```bash
   npm ci --only=production
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Load Balancer Configuration
Configure your load balancer to:
- Health check: `GET /health`
- Sticky sessions: If using sessions
- SSL termination: HTTPS configuration

## 📈 Monitoring

### Health Monitoring
- **Endpoint**: `/health`
- **Metrics**: Memory usage, CPU, uptime
- **Dependencies**: External service connectivity

### Performance Monitoring
- Response time tracking
- Request rate monitoring
- Error rate analysis
- Resource utilization

## 🔄 Integration with Frontend

The backend provides APIs consumed by:
- **Web Dashboard**: Main frontend application
- **Browser Extension**: StegnoShield extension
- **Mobile App**: Future mobile implementations
- **Third-party Services**: External integrations

### Authentication Flow
1. Client authentication request
2. Token generation and validation
3. Secure API access with tokens
4. Session management

## 🛟 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process on port 3000
npx kill-port 3000
# Or use different port
PORT=3001 npm start
```

**CORS Errors**
- Check `CORS_ORIGIN` environment variable
- Verify frontend URL matches configuration
- Ensure credentials configuration is correct

**Service Connection Issues**
- Verify StegnoShield service is running
- Check service URLs in environment variables
- Review network connectivity and firewall rules

### Debug Mode
```bash
DEBUG=* npm run dev
```

## 🤝 Contributing

1. Follow existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure security best practices
5. Test integration with frontend and services

## 🔮 Future Enhancements

- [ ] GraphQL API implementation
- [ ] WebSocket support for real-time updates
- [ ] Advanced caching mechanisms
- [ ] Database integration for persistent storage
- [ ] Advanced authentication (OAuth2, SAML)
- [ ] API versioning
- [ ] OpenAPI/Swagger documentation
- [ ] Microservices architecture migration

---

For questions or support, refer to the main project documentation or create an issue in the repository.
