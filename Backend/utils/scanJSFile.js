const axios = require('axios');

async function scanJSFile(url, patterns, options = {}) {
  const { timeout = 8000, maxContentLength = 5 * 1024 * 1024 } = options;
  try {
    const response = await axios.get(url, {
      timeout,
      maxContentLength,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
      }
    });
    const contentType = response.headers["content-type"] || "";
    if (!contentType.includes("javascript") && !contentType.includes("text/plain")) {
      return [];
    }
    const content = response.data;
    if (content.length > maxContentLength) {
      return [];
    }
    const matches = [];
    for (const pattern of patterns) {
      const patternMatches = [];
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        patternMatches.push(match[0]);
        if (patternMatches.length >= 5) break;
      }
      pattern.regex.lastIndex = 0;
      if (patternMatches.length > 0) {
        matches.push({
          file: url,
          issue: pattern.name,
          severity: pattern.severity,
          matches: patternMatches
        });
      }
    }
    return matches;
  } catch (err) {
    return [];
  }
}

module.exports = { scanJSFile }; 