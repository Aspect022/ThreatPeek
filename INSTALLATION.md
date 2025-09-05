# ThreatPeek Installation Guide 🚀

Complete installation and setup guide for the ThreatPeek cybersecurity platform. This guide covers all components and provides step-by-step instructions for getting the entire system running.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Component Installation](#component-installation)
4. [Configuration](#configuration)
5. [Running the System](#running-the-system)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Setup](#advanced-setup)

## 🔧 Prerequisites

### Required Software

#### Node.js and npm
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)

```bash
# Check versions
node --version
npm --version

# Install Node.js from: https://nodejs.org/
```

#### Python
- **Python**: Version 3.8.0 or higher
- **pip**: Latest version

```bash
# Check versions
python --version
pip --version

# Install Python from: https://python.org/
```

#### Git with Git LFS
- **Git**: Latest version
- **Git LFS**: For handling large files

```bash
# Check Git version
git --version

# Install Git LFS
git lfs install
```

#### Additional Dependencies

**For StegnoShield Service:**
```bash
# Windows
# Download Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki

# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install tesseract-ocr tesseract-ocr-eng

# CentOS/RHEL/Fedora
sudo yum install tesseract tesseract-langpack-eng
```

**Optional:**
- **Docker**: For containerized deployment
- **n8n**: For automation workflows (can be installed via npm)

### System Requirements

- **RAM**: Minimum 8GB, Recommended 16GB
- **Storage**: Minimum 10GB free space
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **Browser**: Chrome/Chromium (for browser extension)

## ⚡ Quick Start

### 1. Clone the Repository

```bash
# Clone with Git LFS support
git clone <your-repository-url>
cd ThreatPeek-Project

# Pull LFS files (if any exist)
git lfs pull
```

### 2. Install All Dependencies

```bash
# Root level setup script (create this for convenience)
# Windows
.\setup.bat

# macOS/Linux
./setup.sh
```

Or manually install each component:

```bash
# Backend
cd Backend
npm install
cd ..

# Frontend
cd Frontend
npm install
cd ..

# StegnoShield Extension
cd "StegnoShield Extension"
npm install
cd ..

# Python dependencies
cd StegnoShield/stegoshield_service
pip install -r requirements.txt
cd ../..

cd AnomolyDetection
pip install -r requirements.txt
cd ..
```

### 3. Configure Environment Variables

```bash
# Copy example environment files
cp Backend/.env.example Backend/.env
cp Frontend/.env.local.example Frontend/.env.local
```

### 4. Start All Services

```bash
# Terminal 1: Backend API
cd Backend
npm start

# Terminal 2: Frontend Dashboard
cd Frontend
npm run dev

# Terminal 3: StegnoShield Service
cd StegnoShield/stegoshield_service
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 4: Browser Extension (development)
cd "StegnoShield Extension"
npm run dev
```

## 🏗️ Component Installation

### Backend API Server

```bash
cd Backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

**Edit `.env` file:**
```env
PORT=3000
NODE_ENV=development
STEGOSHIELD_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3001
```

**Start the backend:**
```bash
# Development mode
npm run dev

# Production mode
npm start

# With debugging
DEBUG=* npm run dev
```

### Frontend Dashboard

```bash
cd Frontend

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local
```

**Edit `.env.local` file:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_APP_NAME=ThreatPeek
NEXT_PUBLIC_STEGO_SERVICE_URL=http://localhost:8000
```

**Start the frontend:**
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# With type checking
npm run type-check
```

### StegnoShield Service

```bash
cd StegnoShield/stegoshield_service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Create requirements.txt if it doesn't exist:**
```txt
fastapi>=0.68.0
uvicorn>=0.15.0
python-multipart>=0.0.5
Pillow>=8.3.0
opencv-python>=4.5.0
pytesseract>=0.3.8
numpy>=1.21.0
scikit-image>=0.18.0
scipy>=1.7.0
matplotlib>=3.4.0
aiofiles>=0.7.0
pydantic>=1.8.0
```

**Start the service:**
```bash
# Development mode
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Browser Extension

```bash
cd "StegnoShield Extension"

# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build

# Package for distribution
npm run package
```

**Load extension in Chrome:**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` directory

### Anomaly Detection System

```bash
cd AnomolyDetection

# Create virtual environment
python -m venv anomaly_env

# Activate virtual environment
# Windows
anomaly_env\Scripts\activate
# macOS/Linux
source anomaly_env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Create requirements.txt if it doesn't exist:**
```txt
pandas>=1.3.0
numpy>=1.21.0
scikit-learn>=1.0.0
matplotlib>=3.4.0
seaborn>=0.11.0
jupyter>=1.0.0
joblib>=1.1.0
plotly>=5.0.0
```

**Start Jupyter Notebook:**
```bash
jupyter notebook
```

### Automation System (n8n)

```bash
# Install n8n globally
npm install -g n8n

# Or run with npx
npx n8n

# Start n8n
n8n start

# Access at http://localhost:5678
```

## ⚙️ Configuration

### Backend Configuration

**Edit `Backend/.env`:**
```env
# Server Configuration
PORT=3000
NODE_ENV=development
HOST=localhost

# External Services
STEGOSHIELD_SERVICE_URL=http://localhost:8000
ML_SERVICE_URL=http://localhost:5000

# Security
CORS_ORIGIN=http://localhost:3001
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Database (if used)
DATABASE_URL=your_database_url_here

# Third-party APIs
GMAIL_USERNAME=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### Frontend Configuration

**Edit `Frontend/.env.local`:**
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# App Configuration
NEXT_PUBLIC_APP_NAME=ThreatPeek
NEXT_PUBLIC_APP_VERSION=1.0.0

# External Services
NEXT_PUBLIC_STEGO_SERVICE_URL=http://localhost:8000

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
```

### StegnoShield Configuration

**Create `StegnoShield/stegoshield_service/.env`:**
```env
# Service Configuration
STEGO_PORT=8000
STEGO_HOST=0.0.0.0
STEGO_WORKERS=4

# Processing Limits
MAX_FILE_SIZE=50MB
MAX_BATCH_SIZE=10
PROCESSING_TIMEOUT=30

# Tesseract Configuration
TESSERACT_PATH=/usr/bin/tesseract
TESSDATA_PREFIX=/usr/share/tesseract-ocr

# Detection Thresholds
LSB_ENTROPY_THRESHOLD=7.8
DCT_IRREGULARITY_THRESHOLD=0.05
CHI_SQUARE_P_THRESHOLD=0.01
```

## 🚀 Running the System

### Development Mode (All Components)

Create a startup script for convenience:

**`start-dev.bat` (Windows):**
```batch
@echo off
echo Starting ThreatPeek Development Environment...

start "Backend API" cmd /k "cd Backend && npm run dev"
start "Frontend Dashboard" cmd /k "cd Frontend && npm run dev"
start "StegnoShield Service" cmd /k "cd StegnoShield/stegoshield_service && venv\Scripts\activate && uvicorn main:app --reload"
start "Browser Extension" cmd /k "cd StegnoShield Extension && npm run dev"

echo All services started!
echo.
echo Services:
echo - Backend API: http://localhost:3000
echo - Frontend Dashboard: http://localhost:3001
echo - StegnoShield Service: http://localhost:8000
echo - Browser Extension: Load from build/chrome-mv3-dev
pause
```

**`start-dev.sh` (macOS/Linux):**
```bash
#!/bin/bash
echo "Starting ThreatPeek Development Environment..."

# Start Backend API
cd Backend && npm run dev &
BACKEND_PID=$!

# Start Frontend Dashboard
cd ../Frontend && npm run dev &
FRONTEND_PID=$!

# Start StegnoShield Service
cd ../StegnoShield/stegoshield_service
source venv/bin/activate
uvicorn main:app --reload &
STEGO_PID=$!

# Start Browser Extension
cd "../../StegnoShield Extension" && npm run dev &
EXTENSION_PID=$!

echo "All services started!"
echo ""
echo "Services:"
echo "- Backend API: http://localhost:3000"
echo "- Frontend Dashboard: http://localhost:3001"
echo "- StegnoShield Service: http://localhost:8000"
echo "- Browser Extension: Load from build/chrome-mv3-dev"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'kill $BACKEND_PID $FRONTEND_PID $STEGO_PID $EXTENSION_PID' INT
wait
```

### Production Mode

**Using Docker Compose (if implemented):**
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Manual Production Setup:**
```bash
# Backend
cd Backend
npm run build
npm start

# Frontend
cd Frontend
npm run build
npm start

# StegnoShield Service
cd StegnoShield/stegoshield_service
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## ✅ Verification

### Health Checks

**Backend API:**
```bash
curl http://localhost:3000/health
```

**StegnoShield Service:**
```bash
curl http://localhost:8000/health
```

**Frontend Dashboard:**
- Open http://localhost:3001 in browser
- Check for loading and no console errors

**Browser Extension:**
- Verify extension loads in Chrome
- Check extension popup works
- Test image analysis functionality

### Integration Tests

**Test Backend to StegnoShield Communication:**
```bash
# Upload test image via backend
curl -X POST http://localhost:3000/api/stegoshield/analyze \
  -F "file=@test-image.png"
```

**Test Frontend to Backend Communication:**
- Login to dashboard
- Perform a scan operation
- Check for real-time updates

## 🐛 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using a port
# Windows
netstat -ano | findstr :3000

# macOS/Linux
lsof -i :3000

# Kill process using port
# Windows
taskkill /PID <PID> /F

# macOS/Linux
kill -9 <PID>
```

#### Python Virtual Environment Issues
```bash
# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

#### Node Modules Issues
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Tesseract OCR Issues
```bash
# Test Tesseract installation
tesseract --version

# Windows: Add to PATH
# C:\Program Files\Tesseract-OCR

# macOS: Reinstall with Homebrew
brew reinstall tesseract

# Ubuntu: Reinstall packages
sudo apt-get remove tesseract-ocr
sudo apt-get install tesseract-ocr tesseract-ocr-eng
```

#### Git LFS Issues
```bash
# Reinstall Git LFS
git lfs uninstall
git lfs install

# Pull LFS files
git lfs pull

# Check LFS status
git lfs status
```

### Debug Mode

Enable debug logging for components:

**Backend:**
```bash
DEBUG=* npm run dev
```

**StegnoShield:**
```bash
export LOG_LEVEL=debug
uvicorn main:app --reload --log-level debug
```

**Frontend:**
```bash
# Check browser console for errors
# Enable React Developer Tools
```

### Performance Issues

**Optimize Development:**
- Close unnecessary applications
- Use SSD for development
- Increase Node.js memory limit: `NODE_OPTIONS="--max_old_space_size=4096"`

**Database Optimization:**
- Use local database for development
- Index frequently queried fields
- Enable query logging for optimization

## 🚀 Advanced Setup

### Docker Development

**Create `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  backend:
    build: ./Backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - STEGOSHIELD_SERVICE_URL=http://stegoshield:8000
    depends_on:
      - stegoshield

  frontend:
    build: ./Frontend
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000

  stegoshield:
    build: ./StegnoShield
    ports:
      - "8000:8000"
    volumes:
      - ./temp:/app/temp
```

### CI/CD Setup

**GitHub Actions (`.github/workflows/ci.yml`):**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
      with:
        lfs: true
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Setup Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        cd Backend && npm ci
        cd ../Frontend && npm ci
        cd ../StegnoShield/stegoshield_service && pip install -r requirements.txt
    
    - name: Run tests
      run: |
        cd Backend && npm test
        cd ../Frontend && npm test
        cd ../StegnoShield/stegoshield_service && pytest
```

### Production Deployment

**Environment Setup:**
- Use environment variables for all secrets
- Set up SSL certificates
- Configure reverse proxy (Nginx)
- Set up monitoring and logging
- Configure auto-scaling if needed

**Security Checklist:**
- [ ] All secrets in environment variables
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Rate limiting enabled
- [ ] Security headers configured

## 📞 Support

If you encounter issues during installation:

1. Check this documentation
2. Review component-specific README files
3. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
4. Search existing GitHub issues
5. Create a new issue with:
   - Your operating system and versions
   - Complete error messages
   - Steps you tried to resolve the issue

---

**Congratulations!** 🎉 You now have ThreatPeek fully installed and running. Check out the individual component documentation for detailed usage instructions.
