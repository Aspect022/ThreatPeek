module.exports = [
  {
    name: "OpenAI API Key",
    regex: /sk-[a-zA-Z0-9]{48}/g,
    severity: "critical",
  },
  {
    name: "Firebase API Key",
    regex: /AIza[0-9A-Za-z-_]{35}/g,
    severity: "high",
  },
  {
    name: "Stripe Live Secret Key",
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    severity: "critical",
  },
  {
    name: "Stripe Test Secret Key",
    regex: /sk_test_[0-9a-zA-Z]{24,}/g,
    severity: "high",
  },
  {
    name: "Supabase Anon Key",
    regex: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
    severity: "medium",
  },
  {
    name: "JWT Token",
    regex: /eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g,
    severity: "medium",
  },
  {
    name: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
  },
  {
    name: "Google API Key",
    regex: /AIza[0-9A-Za-z\\-_]{35}/g,
    severity: "high",
  },
  {
    name: "GitHub Token",
    regex: /ghp_[a-zA-Z0-9]{36}/g,
    severity: "high",
  },
  {
    name: "Database Password",
    regex: /password.*=.*['"][^'"]{8,}['"]/gi,
    severity: "high",
  },
  {
    name: "Generic API Token",
    regex: /token.*['"][a-zA-Z0-9]{32,}['"]/gi,
    severity: "medium",
  },
  {
    name: "MongoDB Connection String",
    regex: /mongodb\+srv:\/\/[^\s]+/g,
    severity: "critical",
  },
  {
    name: "PostgreSQL Connection String",
    regex: /postgresql:\/\/[^\s]+/g,
    severity: "critical",
  },
  {
    name: "Environment Variable in Window",
    regex: /window\.[A-Z_]+\s*=\s*['"][^'"]+['"]/g,
    severity: "medium",
  }
];
