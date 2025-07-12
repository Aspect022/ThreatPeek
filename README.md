# ThreatPeek

![ThreatPeek Logo](public/logo.png)

AI-Powered Threat Detection at a Glance

ThreatPeek is an advanced, AI-powered security scanner designed to detect exposed API keys, secrets, and other vulnerabilities in web applications. It provides instant, actionable insights to help developers and security teams protect their digital assets.

---

## ✨ Features

- **Smart Detection**: Utilizes advanced pattern matching and an improved regex engine to identify sensitive information such as OpenAI, Stripe, AWS, Google, and GitHub API keys; database credentials; and private keys with high accuracy and minimal false positives.
- **AI-Powered Analysis**: Leverages the Google Gemini API to deliver intelligent security assessments, providing contextual insights, potential risks, and actionable mitigation steps.
- **Comprehensive Scanning**: Crawls main HTML content and all linked JavaScript files to uncover hidden vulnerabilities.
- **Detailed Reports**: Generates security reports with severity levels (Critical, High, Medium, Low) and prioritized recommendations. Reports are available in JSON or plain text format.
- **User-Friendly Interface**: Clean, intuitive web interface for easy URL submission and result viewing.
- **SEO & PWA Ready**: Includes metadata, Open Graph tags, `robots.txt`, and a web manifest for improved search visibility and Progressive Web App capabilities.

---

## 🚀 Tech Stack

**Frontend:**
- Next.js (App Router & Server Components)
- React
- Tailwind CSS
- shadcn/ui (Radix UI & Tailwind components)
- Lucide React (icons)

**Backend:**
- Node.js & Express.js
- Axios (HTTP client)
- dotenv (env vars)
- helmet (security headers)
- cors (CORS)
- express-rate-limit (rate limiting)

**AI Integration:**
- Google Gemini API

---

## 📂 Project Structure

```
ThreatPeek/
├── Backend/
│   ├── controllers/
│   │   ├── improvedScanController.js   # Advanced detection logic
│   │   └── scanController.js           # Original detection logic
│   ├── routes/
│   │   └── scan.js                     # Scan API endpoint
│   ├── utils/
│   │   ├── improvedRegexPatterns.js    # Enhanced regex patterns
│   │   └── regexPatterns.js            # Base regex patterns
│   └── server.js                       # Express server entrypoint
├── Frontend/
│   ├── app/
│   │   ├── api/summary/route.ts        # AI summary endpoint
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Landing page
│   │   ├── scan/[scanId]/page.tsx      # Scan results (dynamic)
│   │   ├── scan/page.tsx               # Scan results (static)
│   │   ├── privacy/page.tsx            # Privacy policy
│   │   └── terms/page.tsx              # Terms of service
│   ├── components/                     # Custom UI components
│   ├── hooks/                          # Custom React hooks
│   ├── lib/                            # Utility functions
│   ├── public/                         # Static assets & SEO files
│   ├── styles/                         # Global styles
│   ├── tailwind.config.ts              # Tailwind config
│   └── tsconfig.json                   # TypeScript config
└── .env.example                        # Example environment vars
```  

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** v18+ (LTS)
- **npm** or **Yarn**
- **Git**

### 1. Clone the Repo

```bash
git clone https://github.com/Aspect022/ThreatPeek.git
cd ThreatPeek
```

### 2. Install Dependencies

```bash
# Backend
git checkout main && cd Backend && npm install
# Frontend
cd ../Frontend && npm install
```  

### 3. Configure Environment Variables

#### Backend (`Backend/.env`)
```
PORT=3001
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

#### Frontend (`Frontend/.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

### 4. Run the App

```bash
# Start Backend
cd Backend && npm start
# Start Frontend
gnpm run dev # from Frontend folder
```  

Open [http://localhost:3000](http://localhost:3000) to view ThreatPeek.

---

## 💡 Usage

1. **Enter URL** on the landing page.
2. Click **Scan Now** to initiate the scan.
3. Review **Results** by severity and actionable AI summary.
4. **Download** the full report in JSON or plain text.

---

## 🤝 Contributing

1. Fork the repo 👉 `gh fork https://github.com/Aspect022/ThreatPeek`
2. Clone your fork and create a branch: `git checkout -b feature/YourFeature`
3. Implement changes, commit, and push.
4. Open a Pull Request with a clear description.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 📧 Contact

Questions or feedback? Open an issue or reach out to the maintainers at [https://github.com/Aspect022/ThreatPeek/issues](https://github.com/Aspect022/ThreatPeek/issues).

Made with 💙 by Jayesh RL
