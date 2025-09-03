/**
 * Enhanced Pattern Definitions with categorization and improved accuracy
 * Supports secrets, vulnerabilities, and configuration patterns
 */

const secretPatterns = [
    // OpenAI API Keys
    {
        id: 'openai-api-key',
        name: 'OpenAI API Key',
        category: 'secrets',
        severity: 'critical',
        regex: /(?:openai[_-]?api[_-]?key|OPENAI_API_KEY|sk-proj)[:\s='"]*(sk-[a-zA-Z0-9]{48})(?![a-zA-Z0-9])/gi,
        extractGroup: 1,
        confidence: 0.9,
        minLength: 51,
        falsePositiveFilters: [
            /sk-[a-zA-Z0-9]{48}[a-zA-Z0-9]+/, // Exclude if part of longer string
            /example/i,
            /placeholder/i
        ],
        validator: (value) => value.startsWith('sk-') && value.length === 51
    },

    // Twilio API Keys (Requirement 1.1)
    {
        id: 'twilio-api-key',
        name: 'Twilio API Key',
        category: 'secrets',
        severity: 'high',
        regex: /(SK[a-f0-9]{32})/gi,
        extractGroup: 1,
        confidence: 0.85,
        minLength: 34,
        falsePositiveFilters: [/example/i, /test/i, /placeholder/i],
        validator: (value) => /^SK[a-f0-9]{32}$/.test(value)
    },

    // Twilio Auth Token (Requirement 1.1)
    {
        id: 'twilio-auth-token',
        name: 'Twilio Auth Token',
        category: 'secrets',
        severity: 'high',
        regex: /(AC[a-f0-9]{32})/gi,
        extractGroup: 1,
        confidence: 0.85,
        minLength: 34,
        falsePositiveFilters: [/example/i, /test/i, /placeholder/i],
        validator: (value) => /^AC[a-f0-9]{32}$/.test(value)
    },

    // Azure Storage Connection String (Requirement 1.2)
    {
        id: 'azure-storage-connection',
        name: 'Azure Storage Connection String',
        category: 'secrets',
        severity: 'critical',
        regex: /(DefaultEndpointsProtocol=https;AccountName=[a-zA-Z0-9]+;AccountKey=[A-Za-z0-9+/=]+)/gi,
        extractGroup: 1,
        confidence: 0.95,
        falsePositiveFilters: [/example/i, /placeholder/i, /your_account/i, /myaccount/i, /test/i]
    },

    // Azure Service Principal (Requirement 1.2)
    {
        id: 'azure-service-principal',
        name: 'Azure Service Principal Key',
        category: 'secrets',
        severity: 'critical',
        regex: /(?:azure[_-]?client[_-]?secret|AZURE_CLIENT_SECRET)[:\s='"]*([\w\-~]{34,44})/gi,
        extractGroup: 1,
        confidence: 0.8,
        falsePositiveFilters: [/example/i, /placeholder/i]
    },

    // SendGrid API Key (Requirement 1.3)
    {
        id: 'sendgrid-api-key',
        name: 'SendGrid API Key',
        category: 'secrets',
        severity: 'high',
        regex: /(?:sendgrid[_-]?api[_-]?key|SENDGRID_API_KEY)[:\s='"]*(SG\.[A-Za-z0-9-_]{22}\.[A-Za-z0-9-_]{43})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /test/i],
        validator: (value) => /^SG\.[A-Za-z0-9-_]{22}\.[A-Za-z0-9-_]{43}$/.test(value)
    },

    // GitHub Fine-grained Token (Requirement 1.4)
    {
        id: 'github-fine-grained-token',
        name: 'GitHub Fine-grained Personal Access Token',
        category: 'secrets',
        severity: 'high',
        regex: /(github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})/gi,
        extractGroup: 1,
        confidence: 0.95,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/.test(value)
    },

    // GitHub App Installation Token (Requirement 1.4)
    {
        id: 'github-app-token',
        name: 'GitHub App Installation Token',
        category: 'secrets',
        severity: 'high',
        regex: /(?:github[_-]?app[_-]?token|GITHUB_APP_TOKEN)[:\s='"]*(ghs_[a-zA-Z0-9]{36})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^ghs_[a-zA-Z0-9]{36}$/.test(value)
    },

    // Stripe Publishable Key (Requirement 1.5)
    {
        id: 'stripe-publishable-key',
        name: 'Stripe Publishable Key',
        category: 'secrets',
        severity: 'medium',
        regex: /(pk_(test|live)_[0-9a-zA-Z]{24,})/gi,
        extractGroup: 1,
        confidence: 0.8,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^pk_(test|live)_[0-9a-zA-Z]{24,}$/.test(value)
    },

    // Stripe Webhook Secret (Requirement 1.5)
    {
        id: 'stripe-webhook-secret',
        name: 'Stripe Webhook Endpoint Secret',
        category: 'secrets',
        severity: 'high',
        regex: /(?:stripe[_-]?webhook[_-]?secret|STRIPE_WEBHOOK_SECRET)[:\s='"]*(whsec_[a-zA-Z0-9]{32,})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^whsec_[a-zA-Z0-9]{32,}$/.test(value)
    },

    // Discord Bot Token (Requirement 1.6)
    {
        id: 'discord-bot-token',
        name: 'Discord Bot Token',
        category: 'secrets',
        severity: 'critical',
        regex: /((?:mfa\.)?[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^(?:mfa\.)?[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}$/.test(value)
    },

    // Notion API Key (Requirement 1.6)
    {
        id: 'notion-api-key',
        name: 'Notion API Key',
        category: 'secrets',
        severity: 'high',
        regex: /(secret_[a-zA-Z0-9]{43})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^secret_[a-zA-Z0-9]{43}$/.test(value)
    },

    // DigitalOcean Token (Requirement 1.6)
    {
        id: 'digitalocean-token',
        name: 'DigitalOcean Personal Access Token',
        category: 'secrets',
        severity: 'high',
        regex: /(?:digitalocean[_-]?token|DO_TOKEN|DIGITALOCEAN_TOKEN)[:\s='"]*(dop_v1_[a-f0-9]{64})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^dop_v1_[a-f0-9]{64}$/.test(value)
    },

    // Existing patterns enhanced
    {
        id: 'aws-access-key',
        name: 'AWS Access Key ID',
        category: 'secrets',
        severity: 'critical',
        regex: /(?:aws[_-]?access[_-]?key[_-]?id|AWS_ACCESS_KEY_ID)[:\s='"]*(AKIA[0-9A-Z]{16})/gi,
        extractGroup: 1,
        confidence: 0.95,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^AKIA[0-9A-Z]{16}$/.test(value)
    },

    {
        id: 'aws-secret-key',
        name: 'AWS Secret Access Key',
        category: 'secrets',
        severity: 'critical',
        regex: /(?:aws[_-]?secret[_-]?access[_-]?key|AWS_SECRET_ACCESS_KEY)[:\s='"]*([\w/+=]{40})/gi,
        extractGroup: 1,
        confidence: 0.8,
        minLength: 40,
        falsePositiveFilters: [/example/i, /placeholder/i, /\*{10,}/]
    },

    {
        id: 'stripe-secret-key',
        name: 'Stripe Secret Key',
        category: 'secrets',
        severity: 'critical',
        regex: /(?:stripe[_-]?secret|STRIPE_SECRET_KEY)[:\s='"]*(sk_(test|live)_[0-9a-zA-Z]{24,})/gi,
        extractGroup: 1,
        confidence: 0.95,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^sk_(test|live)_[0-9a-zA-Z]{24,}$/.test(value)
    },

    {
        id: 'google-api-key',
        name: 'Google API Key',
        category: 'secrets',
        severity: 'high',
        regex: /(?:google[_-]?api[_-]?key|GOOGLE_API_KEY)[:\s='"]*(AIza[0-9A-Za-z\\-_]{35})/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i],
        validator: (value) => /^AIza[0-9A-Za-z\\-_]{35}$/.test(value)
    },

    {
        id: 'firebase-api-key',
        name: 'Firebase API Key',
        category: 'secrets',
        severity: 'high',
        regex: /(?:firebase[_-]?api[_-]?key|apiKey|FIREBASE_API_KEY)[:\s='"]*(AIza[0-9A-Za-z-_]{35})/gi,
        extractGroup: 1,
        confidence: 0.85,
        falsePositiveFilters: [/example/i, /placeholder/i]
    }
];

const vulnerabilityPatterns = [
    {
        id: 'sql-injection-pattern',
        name: 'Potential SQL Injection Pattern',
        category: 'vulnerabilities',
        severity: 'high',
        regex: /(?:query|execute|exec)\s*\(\s*['"`].*\+.*['"`]\s*\)/gi,
        confidence: 0.7,
        falsePositiveFilters: [/console\.log/i, /debug/i]
    },

    {
        id: 'xss-pattern',
        name: 'Potential XSS Pattern',
        category: 'vulnerabilities',
        severity: 'medium',
        regex: /innerHTML\s*=\s*.*\+/gi,
        confidence: 0.6,
        falsePositiveFilters: [/sanitize/i, /escape/i]
    },

    {
        id: 'hardcoded-password',
        name: 'Hardcoded Password',
        category: 'vulnerabilities',
        severity: 'high',
        regex: /(?:password|pwd|pass)[:\s='"]*((?!['"]\s*\$\{)[^'"\s]{8,})['"]/gi,
        extractGroup: 1,
        confidence: 0.7,
        falsePositiveFilters: [
            /\$\{.*\}/,
            /process\.env/,
            /\*{3,}/,
            /xxx+/i,
            /placeholder/i,
            /your[_-]?password/i,
            /example/i,
            /test/i
        ]
    }
];

const configurationPatterns = [
    {
        id: 'database-connection-string',
        name: 'Database Connection String',
        category: 'configurations',
        severity: 'critical',
        regex: /((?:mongodb|mysql|postgresql|postgres|redis):\/\/[^:]+:[^@]+@[^\/\s]+)/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i, /localhost/i]
    },

    {
        id: 'private-key',
        name: 'Private Key',
        category: 'configurations',
        severity: 'critical',
        regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        confidence: 0.95,
        falsePositiveFilters: [/example/i, /placeholder/i]
    },

    {
        id: 'jwt-token',
        name: 'JWT Token',
        category: 'configurations',
        severity: 'medium',
        regex: /(?:jwt[_-]?token|JWT_TOKEN|authorization)[:\s='"]*(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/gi,
        extractGroup: 1,
        confidence: 0.8,
        falsePositiveFilters: [/example/i, /placeholder/i]
    },

    {
        id: 'basic-auth-url',
        name: 'Basic Authentication in URL',
        category: 'configurations',
        severity: 'critical',
        regex: /(https?:\/\/[A-Za-z0-9_\-]+:[A-Za-z0-9_\-]+@[^\/\s]+)/gi,
        extractGroup: 1,
        confidence: 0.9,
        falsePositiveFilters: [/example/i, /placeholder/i, /user:pass/i]
    }
];

// Export all patterns organized by category
module.exports = {
    secretPatterns,
    vulnerabilityPatterns,
    configurationPatterns,

    // Combined array for convenience
    allPatterns: [
        ...secretPatterns,
        ...vulnerabilityPatterns,
        ...configurationPatterns
    ],

    // Helper function to get patterns by category
    getPatternsByCategory: (category) => {
        switch (category) {
            case 'secrets':
                return secretPatterns;
            case 'vulnerabilities':
                return vulnerabilityPatterns;
            case 'configurations':
                return configurationPatterns;
            default:
                return [];
        }
    },

    // Helper function to get pattern by ID
    getPatternById: (id) => {
        return module.exports.allPatterns.find(pattern => pattern.id === id);
    }
};