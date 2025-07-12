# ThreatPeek Backend

Node.js/Express backend for the ThreatPeek security scanning tool.

## Features

- Fetches HTML from target URLs
- Extracts JavaScript file URLs from HTML
- Scans JavaScript files for exposed secrets using regex patterns
- Returns structured scan results with severity levels

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Run the development server:
```bash
npm run dev
```

4. The API will be available at `http://localhost:3001`

## API Endpoints

### POST /api/scan
Scans a website for exposed secrets.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "results": [
    {
      "file": "https://example.com/script.js",
      "issue": "OpenAI API Key",
      "severity": "critical",
      "matches": ["sk-..."]
    }
  ]
}
```

### GET /api/health
Health check endpoint.

## Security Patterns

The scanner detects the following types of secrets:

- OpenAI API Keys
- Firebase API Keys
- Stripe Secret Keys
- AWS Access Keys
- Google API Keys
- GitHub Tokens
- Database passwords
- JWT tokens
- MongoDB connection strings
- PostgreSQL connection strings
- Environment variables exposed in window object

## Project Structure

```
backend/
├── controllers/
│   └── scanController.js    # Main scanning logic
├── routes/
│   └── scan.js              # API routes
├── utils/
│   └── regexPatterns.js     # Regex patterns for secret detection
├── server.js                # Express server setup
└── package.json
```
