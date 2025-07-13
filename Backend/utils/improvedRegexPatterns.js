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
  },

  {
    name: "Cloudinary URL",
    regex: /cloudinary:\/\/.*/gi,
    severity: "medium",
    extractGroup: 0
  },
  {
    name: "Firebase URL",
    regex: /.*firebaseio\.com/gi,
    severity: "medium",
    extractGroup: 0
  },
  {
    name: "Slack Token",
    regex: /(xox[p|b|o|a]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "RSA Private Key",
    regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/gi,
    severity: "critical",
    extractGroup: 0
  },
  {
    name: "SSH DSA Private Key",
    regex: /-----BEGIN DSA PRIVATE KEY-----[\s\S]+?-----END DSA PRIVATE KEY-----/gi,
    severity: "critical",
    extractGroup: 0
  },
  {
    name: "SSH EC Private Key",
    regex: /-----BEGIN EC PRIVATE KEY-----[\s\S]+?-----END EC PRIVATE KEY-----/gi,
    severity: "critical",
    extractGroup: 0
  },
  {
    name: "PGP Private Key Block",
    regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----/gi,
    severity: "critical",
    extractGroup: 0
  },
  {
    name: "Amazon AWS Access Key ID",
    regex: /(AKIA[0-9A-Z]{16})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Amazon MWS Auth Token",
    regex: /(amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "AWS API Key",
    regex: /(AKIA[0-9A-Z]{16})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "AWS MWS Auth Token",
    regex: /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    severity: "critical"
  },
  {
    name: "Generic Bearer Token",
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    severity: "high",
    extractGroup: 0
  },
  {
    name: "Discord Bot Token",
    regex: /([MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27})/g,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "WakaTime API Key",
    regex: /(waka_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    severity: "medium",
    extractGroup: 1
  },
  {
    name: "Google OAuth Client ID",
    regex: /([0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com)/g,
    severity: "medium",
    extractGroup: 1
  },
  {
    name: "Google OAuth Access Token",
    regex: /(ya29\.[0-9A-Za-z\-_]+)/g,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Supabase URL",
    regex: /(supabase\.co\/[a-z0-9]{15,})/gi,
    severity: "medium",
    extractGroup: 1
  },
  {
    name: "Square API Token",
    regex: /(sq0atp-[A-Za-z0-9_-]+)/g,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Algolia API Key",
    regex: /(?:algolia[_-]?api[_-]?key|ALGOLIA_API_KEY)[:\s='"]*([a-zA-Z0-9]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Cloudinary API Key",
    regex: /(cloudinary:\/\/[0-9]{15}:[a-zA-Z0-9]+@[a-zA-Z0-9]+)/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "AWS Access Key ID",
    regex: /(AKIA[0-9A-Z]{16})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Google API Key",
    regex: /(AIza[0-9A-Za-z-_]{35})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Slack Token",
    regex: /(xox[baprs]-[0-9a-zA-Z]{10,48})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Stripe Live Secret Key",
    regex: /(sk_live_[0-9a-zA-Z]{24})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "SendGrid API Key",
    regex: /(SG\.[A-Za-z0-9-_]{22}\.[A-Za-z0-9-_]{43})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Twilio API Key",
    regex: /(SK[0-9a-fA-F]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "GitHub Token",
    regex: /(gh[pousr]_[A-Za-z0-9_]{36,255})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "OpenAI API Key",
    regex: /(sk-[a-zA-Z0-9]{48})/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Heroku API Key",
    regex: /([hH]eroku[a-z0-9]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Mailgun API Key",
    regex: /(key-[0-9a-zA-Z]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Firebase Config",
    regex: /(AAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "DigitalOcean API Token",
    regex: /(dop_v1_[a-f0-9]{64})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Cloudflare API Token",
    regex: /(cf-[a-z0-9]{32}|Bearer [a-zA-Z0-9_-]{40,60})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "JWT Token",
    regex: /(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/gi,
    severity: "medium",
    extractGroup: 1
  },
  {
    name: "RSA Private Key",
    regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/gi,
    severity: "critical",
    extractGroup: 0
  },
  {
    name: "Facebook Access Token",
    regex: /(EAACEdEose0cBA[0-9A-Za-z]+)/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Azure Storage Connection String",
    regex: /(DefaultEndpointsProtocol=https;AccountName=[a-z0-9]+;AccountKey=[A-Za-z0-9+/=]+)/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Dropbox Access Token",
    regex: /(sl\.[A-Za-z0-9-_]{20,})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Notion API Key",
    regex: /(secret_[a-zA-Z0-9]{43})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Netlify API Token",
    regex: /(Bearer [a-zA-Z0-9_-]{40,60})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Terraform API Token",
    regex: /(tfr_[A-Za-z0-9]{32})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "CircleCI API Token",
    regex: /(circle-token [a-f0-9]{40})/gi,
    severity: "high",
    extractGroup: 1
  },
  {
    name: "Basic Authentication in URL",
    regex: /(https?:\/\/[A-Za-z0-9_\-]+:[A-Za-z0-9_\-]+@)/gi,
    severity: "critical",
    extractGroup: 1
  },
  {
    name: "Generic Base64 Encoded Secret",
    regex: /(?<![A-Za-z0-9+/=])([A-Za-z0-9+/]{32,}={0,2})(?![A-Za-z0-9+/=])/gi,
    severity: "medium",
    extractGroup: 1,
    filters: {
      excludePatterns: [
        /^[A-Za-z0-9+/]{32,}={0,2}$/i, // Exclude if it's just a standalone base64 string
        /example/i,
        /placeholder/i,
        /test/i
      ]
    }
  }
   
 ];
