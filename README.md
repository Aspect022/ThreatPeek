# ThreatPeek 🔍🛡️

A comprehensive cybersecurity platform that combines anomaly detection, steganography analysis, and automated threat monitoring with intelligent alerting systems.

## 📺 Demo Video

<!-- Embed your demo video here from the Other Resources folder -->
<!-- Replace with your video URL or embed code -->
```
🎥 Demo videos available in /Other Resources/individual workings/
- Main Demo: ThreatPeek.mov
- Feature Demos: Basic scan.mp4, deepscan.mp4, reposcan.mp4, sqli.mp4, xss.mp4, etc.
```

## 🌟 Overview

ThreatPeek is a multi-component cybersecurity solution designed to detect, analyze, and respond to various security threats. The platform integrates machine learning-based anomaly detection with steganography analysis and provides automated alerting through multiple channels.

### 🏗️ Architecture

The platform consists of several interconnected components:

```
ThreatPeek/
├── 🤖 AnomolyDetection/     # ML-based anomaly detection system
├── ⚡ Automation/           # n8n workflow automation for alerts
├── 🖥️  Backend/             # Node.js/Express API server
├── 🌐 Frontend/             # Next.js React web application
├── 🔐 StegnoShield/         # Steganography analysis service
├── 🧩 StegnoShield Extension/ # Browser extension for image analysis
├── 📁 Resources/            # Additional steganography services
├── 🧪 sandbox/              # Development and testing environment
└── 📚 Other Resources/      # Documentation and demo videos
```

## 🚀 Key Features

### 🔍 Threat Detection
- **Machine Learning Anomaly Detection**: Advanced ML models using Random Forest and Isolation Forest algorithms
- **Steganography Analysis**: Detect hidden content in images using specialized algorithms
- **Multi-vector Scanning**: Support for XSS, SQL injection, and repository scanning
- **Real-time Monitoring**: Continuous threat assessment and monitoring

### 🔔 Intelligent Alerting
- **Multi-channel Notifications**: Email, WhatsApp, and SMS alerts via automated workflows
- **Severity-based Routing**: Intelligent alert routing based on threat severity and confidence levels
- **Integration Support**: Google Sheets logging and webhook-based integrations
- **Customizable Workflows**: n8n-powered automation for flexible alert management

### 🌐 User Interface
- **Modern Web Dashboard**: Next.js-based responsive web application
- **Browser Extension**: Chrome extension for on-the-fly image analysis
- **Real-time Updates**: Live threat status and monitoring dashboards
- **Mobile-responsive Design**: Optimized for desktop and mobile devices

### 🔧 Developer-Friendly
- **RESTful APIs**: Well-documented API endpoints for integration
- **Microservices Architecture**: Scalable and maintainable component design
- **Docker Support**: Containerized deployment options
- **Comprehensive Logging**: Detailed audit trails and monitoring

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for ML components)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ThreatPeek-Project
   ```

2. **Install Backend Dependencies**
   ```bash
   cd Backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../Frontend
   npm install
   ```

4. **Setup StegnoShield Service**
   ```bash
   cd ../StegnoShield/stegoshield_service
   pip install -r requirements.txt
   ```

5. **Install Browser Extension Dependencies**
   ```bash
   cd "../../StegnoShield Extension"
   npm install
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd Backend
   npm start
   # Server runs on http://localhost:3000
   ```

2. **Start the Frontend Application**
   ```bash
   cd Frontend
   npm run dev
   # Web app runs on http://localhost:3001
   ```

3. **Start StegnoShield Service**
   ```bash
   cd StegnoShield/stegoshield_service
   uvicorn main:app --reload
   # Service runs on http://localhost:8000
   ```

4. **Build Browser Extension**
   ```bash
   cd "StegnoShield Extension"
   npm run build
   # Extension built in build/ directory
   ```

## 📊 Component Details

### 🤖 Anomaly Detection System
- **Technology**: Python, Jupyter Notebooks, Scikit-learn
- **Models**: Random Forest, Isolation Forest
- **Features**: Data preprocessing, feature engineering, model evaluation
- **Output**: Threat confidence scores and anomaly classifications

### ⚡ Automation Workflows
- **Platform**: n8n workflow automation
- **Integrations**: Gmail, Twilio, Google Sheets, Webhooks
- **Features**: Conditional routing, template-based messaging, data logging
- **Triggers**: Real-time anomaly events and scheduled checks

### 🖥️ Backend API
- **Technology**: Node.js, Express.js
- **Features**: RESTful endpoints, middleware security, request validation
- **Integrations**: ML model APIs, database connections, external services
- **Security**: Helmet.js, CORS, input sanitization

### 🌐 Frontend Dashboard
- **Technology**: Next.js, React, Radix UI
- **Features**: Real-time dashboards, responsive design, dark/light themes
- **Components**: Charts, alerts, user management, settings
- **Deployment**: Static generation, serverless functions

### 🔐 StegnoShield Services
- **Technology**: Python, FastAPI, Computer Vision
- **Features**: Image analysis, steganography detection, metadata extraction
- **API**: RESTful endpoints for image processing
- **Integration**: Browser extension and web dashboard support

## 🛠️ Development

### Project Structure
Each component maintains its own dependencies and can be developed independently:

- **Backend**: Express.js server with security middleware
- **Frontend**: Next.js with modern React patterns
- **ML Services**: Python-based microservices with FastAPI
- **Browser Extension**: Plasmo-based Chrome extension
- **Automation**: n8n workflow definitions

### Environment Setup
Refer to individual component READMEs for detailed setup instructions:
- [Backend Setup](./Backend/README.md)
- [Frontend Setup](./Frontend/README.md)
- [StegnoShield Setup](./StegnoShield/README.md)
- [Extension Setup](./StegnoShield%20Extension/README.md)

## 📱 Browser Extension

The StegnoShield browser extension provides on-the-fly image analysis capabilities:

- **Technology**: Plasmo framework, React, TypeScript
- **Features**: Right-click context menu, popup interface, background processing
- **Analysis**: Real-time steganography detection in web images
- **Integration**: Seamless connection with backend services

## 🔒 Security Features

- **Input Validation**: Comprehensive request sanitization
- **CORS Protection**: Configured cross-origin policies  
- **Helmet Integration**: Security headers and protections
- **Rate Limiting**: API endpoint protection
- **Secure Communications**: HTTPS/WSS protocols
- **Data Encryption**: Sensitive data protection

## 📈 Monitoring & Analytics

- **Real-time Dashboards**: Live threat status monitoring
- **Historical Analysis**: Trend analysis and reporting
- **Alert Management**: Centralized notification handling
- **Performance Metrics**: System health and usage statistics
- **Audit Trails**: Comprehensive activity logging

## 🤝 Contributing

We welcome contributions to ThreatPeek! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details on:

- Code style and standards
- Pull request process
- Issue reporting
- Development workflow

## 📄 License

This project is licensed under the [MIT License](./LICENSE) - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check component-specific READMEs for detailed guides
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Security**: Report security vulnerabilities via our [Security Policy](./SECURITY.md)


## 👥 Contributors

ThreatPeek is proudly developed by a collaborative team of four passionate developers:

- **Jayesh RL** - Team Lead(FullStack and integration) ([GitHub](https://github.com/Aspect022))
- **Rajath U** - Ml ([GitHub](https://github.com/Rajathshivraj))
- **Vaishanth Mohan** - UI/UX and Agentic Automation ([GitHub](https://github.com/friend2-username))
- **Sinchana Benakatti** - CyberSec ([GitHub](https://github.com/friend3-username))

For detailed information about each contributor's role and contributions, see our [CONTRIBUTORS.md](./CONTRIBUTORS.md) file.

## 🏆 Acknowledgments

- Open source libraries and frameworks used
- Security research community contributions  
- Machine learning model training datasets
- Testing and feedback from security professionals
- Our amazing team collaboration and shared vision

---

**ThreatPeek** - *Comprehensive cybersecurity through intelligent detection and automated response*

For detailed setup and usage instructions, please refer to the individual component documentation in their respective directories.
