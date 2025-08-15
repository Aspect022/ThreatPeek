# ThreatPeek - Security Scanner

A comprehensive web security scanning tool that detects secrets, vulnerabilities, and security misconfigurations.

## 🚀 Features

- **Multi-type Scanning**: URL scanning, repository analysis, file detection
- **AI-Powered Analysis**: Intelligent security assessment using Gemini AI
- **Real-time Results**: Live polling with progress indicators
- **Enhanced Reporting**: Detailed findings with confidence scores
- **Export Options**: JSON and text report downloads

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript, deployed on Vercel
- **Backend**: Node.js with Express, deployed on Render
- **AI Integration**: Google Gemini API for security analysis

## 🛠️ Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Gemini API key (get from [Google AI Studio](https://ai.google.dev/))

### Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd ThreatPeek
   ```

2. **Backend Setup**

   ```bash
   cd Backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm start
   ```

3. **Frontend Setup**

   ```bash
   cd Frontend
   npm install
   cp .env.example .env.local
   # Add your GEMINI_API_KEY to .env.local
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## 🚀 Deployment

### Backend (Render)

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set environment variables:
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-frontend-domain.vercel.app`

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set environment variables:
   - `GEMINI_API_KEY=your_gemini_api_key`
   - `NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.onrender.com/api`

## 🔒 Security

- API keys are properly secured and not exposed to client
- CORS configured for production domains
- Input validation and sanitization
- Rate limiting implemented
- Error messages sanitized in production

## 📝 Environment Variables

### Backend (.env)

```
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### Frontend (.env.local)

```
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.onrender.com/api
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
