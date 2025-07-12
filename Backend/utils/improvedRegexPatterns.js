// Context-aware patterns that reduce false positives
module.exports = [
  {
    name: "OpenAI API Key",
    regex: /(?:openai[_-]?api[_-]?key|OPENAI_API_KEY|sk-proj)[:\s='"]*(sk-[a-zA-Z0-9]{48})(?![a-zA-Z0-9])/gi,
    severity: "critical",
    extractGroup: 1,
    minLength: 51,
    filters: {
      excludePatterns: [/sk-[a-zA-Z0-9]{48}[a-zA-Z0-9]+/] // Exclude if part of longer string
    }
  },
  {
    name: "Firebase API Key",
    regex: /(?:firebase[_-]?api[_-]?key|apiKey|FIREBASE_API_KEY)[:\s='"]*(AIza[0-9A-Za-z-_]{35})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Stripe Live Secret Key",
    regex: /(?:stripe[_-]?secret|STRIPE_SECRET_KEY|stripe[_-]?key)[:\s='"]*(sk_live_[0-9a-zA-Z]{24,})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Stripe Test Secret Key",
    regex: /(?:stripe[_-]?test|STRIPE_TEST_KEY)[:\s='"]*(sk_test_[0-9a-zA-Z]{24,})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "AWS Access Key",
    regex: /(?:aws[_-]?access[_-]?key[_-]?id|AWS_ACCESS_KEY_ID|aws_key)[:\s='"]*(AKIA[0-9A-Z]{16})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "AWS Secret Key",
    regex: /(?:aws[_-]?secret[_-]?access[_-]?key|AWS_SECRET_ACCESS_KEY)[:\s='"]*([a-zA-Z0-9/+=]{40})/gi,
    severity: "critical",
    extractGroup: 1,
    contextRequired: true
  },
  {
    name: "Google API Key",
    regex: /(?:google[_-]?api[_-]?key|GOOGLE_API_KEY|maps[_-]?api[_-]?key)[:\s='"]*(AIza[0-9A-Za-z\\-_]{35})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "GitHub Personal Access Token",
    regex: /(?:github[_-]?token|GITHUB_TOKEN|github[_-]?pat)[:\s='"]*(ghp_[a-zA-Z0-9]{36})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "GitHub OAuth Token",
    regex: /(?:github[_-]?oauth|GITHUB_OAUTH)[:\s='"]*(gho_[a-zA-Z0-9]{36})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Database Password",
    regex: /(?:(?:^|[\s,{])(?:db[_-]?password|database[_-]?password|DB_PASSWORD|mysql[_-]?password|postgres[_-]?password|MYSQL_PASSWORD|POSTGRES_PASSWORD|DATABASE_PASS)\s*[:=]\s*['"])([^'"\s]{8,64})['"]/gim,
    severity: "high",
    extractGroup: 1,
    contextRequired: true,
    filters: {
      excludePatterns: [
        /\$\{.*\}/, 
        /process\.env/, 
        /\*{3,}/, 
        /xxx+/i, 
        /placeholder/i, 
        /your[_-]?password/i,
        /example/i,
        /test/i,
        /[a-f0-9]{12,}/  // Long hex strings
      ]
    }
  },
  {
    name: "MongoDB Connection String",
    regex: /(mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\/\s]+)/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "PostgreSQL Connection String",
    regex: /(postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\/\s]+)/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "MySQL Connection String",
    regex: /(mysql:\/\/[^:]+:[^@]+@[^\/\s]+)/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Redis Connection String",
    regex: /(redis:\/\/(?::[^@]+@)?[^\/\s]+)/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Private Key (RSA/SSH)",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical"
  },
  {
    name: "Slack Webhook",
    regex: /(?:slack[_-]?webhook|SLACK_WEBHOOK)[:\s='"]*https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/gi,
    severity: "medium"
  },
  {
    name: "SendGrid API Key",
    regex: /(?:sendgrid[_-]?api[_-]?key|SENDGRID_API_KEY)[:\s='"]*(SG\.[a-zA-Z0-9]{22}\.[a-zA-Z0-9]{43})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Twilio API Key",
    regex: /(?:twilio[_-]?api[_-]?key|TWILIO_API_KEY)[:\s='"]*(SK[a-f0-9]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Square Access Token",
    regex: /(?:square[_-]?access[_-]?token|SQUARE_ACCESS_TOKEN)[:\s='"]*(sq0a[tp]-[0-9A-Za-z\-_]{22,})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Mailgun API Key",
    regex: /(?:mailgun[_-]?api[_-]?key|MAILGUN_API_KEY)[:\s='"]*(key-[a-f0-9]{32})/gi,
    severity: "high",
    extractGroup: 1
  }
];
