const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const improvedPatterns = require("../utils/improvedRegexPatterns");

// In-memory storage for scan results
const storedScans = new Map();

// File patterns to exclude from scanning
const EXCLUDED_PATTERNS = [
  /node_modules\//i,
  /vendor\//i,
  /\.min\.js$/i,
  /bundle\./i,
  /chunk\./i,
  /[a-f0-9]{8,}\.(js|css)$/i, // Webpack hashed files
  /^(d3-|codemirror-|monaco-|ace-)/i, // Common libraries
  /vendors-node_modules/i, // GitHub's vendor bundles
  /_[a-f0-9]{8,}\./i, // Hashed vendor files
  /\.production\.min\./i, // Production builds
];

// Maximum file size to scan (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Check if URL should be excluded
function shouldExcludeUrl(url) {
  // Special handling for GitHub bundles
  if (url.includes('github.com') || url.includes('github.githubassets.com')) {
    const githubBundlePatterns = [
      /\/assets\/.*-[a-f0-9]{8,}\.js$/,
      /\/webpack-.*\.js$/,
      /\/vendor.*\.js$/,
      /\/chunks.*\.js$/,
      /_modules_.*\.js$/
    ];
    if (githubBundlePatterns.some(p => p.test(url))) {
      return true;
    }
  }
  
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(url));
}

// Extract context around a match
function extractContext(content, match, contextSize = 50) {
  const index = content.indexOf(match);
  if (index === -1) return { before: '', after: '' };
  
  const before = content.substring(Math.max(0, index - contextSize), index);
  const after = content.substring(index + match.length, Math.min(content.length, index + match.length + contextSize));
  
  return { before, after };
}

// Apply filters to reduce false positives
function applyFilters(match, pattern, context) {
  // Skip if match is too short (likely false positive)
  if (match.length < 10 && !pattern.name.includes("API Key")) {
    return false;
  }
  
  // Skip if match appears to be part of a minified bundle identifier
  // (e.g., GitHub's module names like "password-element_element-entry_ts:880d5e077e40")
  const minifiedPatterns = [
    /_[a-z]+_[a-z]+_ts:[a-f0-9]{8,}/i,  // GitHub module pattern
    /_[a-f0-9]{8,}_/,  // Hash patterns in file names
    /[a-z]+_modules_[a-z]+/i,  // Module bundle patterns
    /chunk\.[a-f0-9]{8,}/i,  // Webpack chunks
    /[a-z-]+_[a-z-]+_ts":"/i,  // Webpack module mapping pattern
    /"[a-f0-9]{12,}"/,  // Quoted hash values
  ];
  
  // Also check if this appears to be a webpack module mapping
  const webpackModulePattern = /[a-z-]+_[a-z-]+(?:_[a-z]+)*_ts["']?\s*:\s*["'][a-f0-9]+["']/i;
  if (webpackModulePattern.test(context.before + match + context.after)) {
    return false;
  }
  
  if (minifiedPatterns.some(p => p.test(context.before + match + context.after))) {
    return false;
  }
  
  // Check exclude patterns if defined
  if (pattern.filters && pattern.filters.excludePatterns) {
    for (const excludePattern of pattern.filters.excludePatterns) {
      if (excludePattern.test(match)) {
        return false;
      }
    }
  }
  
  // Skip if context indicates it's a placeholder or example
  const contextString = context.before + match + context.after;
  const placeholderPatterns = [
    /example/i,
    /placeholder/i,
    /your[_-]?api[_-]?key/i,
    /xxx+/i,
    /\*{3,}/,
    /TODO/i,
    /FIXME/i,
    /<[^>]+>/  // HTML-like placeholders
  ];
  
  if (placeholderPatterns.some(p => p.test(contextString))) {
    return false;
  }
  
  return true;
}

// Process pattern matches with context
function processMatches(content, pattern) {
  const results = [];
  let match;
  
  while ((match = pattern.regex.exec(content)) !== null) {
    let extractedValue = match[0];
    
    // Extract specific group if defined
    if (pattern.extractGroup && match[pattern.extractGroup]) {
      extractedValue = match[pattern.extractGroup];
    }
    
    // Get context around the match
    const context = extractContext(content, match[0]);
    
    // Apply filters
    if (applyFilters(extractedValue, pattern, context)) {
      results.push({
        value: extractedValue,
        context: {
          before: context.before.trim(),
          after: context.after.trim()
        }
      });
      
      // Limit to 3 matches per pattern to avoid spam
      if (results.length >= 3) break;
    }
  }
  
  // Reset regex lastIndex
  pattern.regex.lastIndex = 0;
  
  return results;
}

exports.scanWebsite = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    console.log(`Starting improved scan for: ${url}`);

    // Fetch HTML
    const htmlResponse = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
      }
    });
    const html = htmlResponse.data;

    // Extract script URLs
    const scriptRegexes = [
      /<script[^>]*src=["']([^"']+)["'][^>]*>/gi,
      /<script[^>]*src=([^\s>"']+)[^>]*>/gi
    ];

    const scriptUrls = new Set();
    
    for (const regex of scriptRegexes) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        let scriptUrl = match[1].trim();
        
        // Skip data URLs and inline scripts
        if (scriptUrl.startsWith('data:') || scriptUrl.startsWith('javascript:')) {
          continue;
        }
        
        // Handle relative URLs
        if (!scriptUrl.startsWith('http')) {
          if (scriptUrl.startsWith('//')) {
            scriptUrl = validUrl.protocol + scriptUrl;
          } else if (scriptUrl.startsWith('/')) {
            scriptUrl = validUrl.origin + scriptUrl;
          } else {
            scriptUrl = new URL(scriptUrl, validUrl.href).href;
          }
        }
        
        // Skip if should be excluded
        if (!shouldExcludeUrl(scriptUrl)) {
          scriptUrls.add(scriptUrl);
        }
      }
    }

    console.log(`Found ${scriptUrls.size} script URLs to scan`);

    const scanResults = [];
    let scannedCount = 0;

    // Process each script URL
    for (const scriptUrl of scriptUrls) {
      try {
        console.log(`Scanning: ${scriptUrl}`);
        
        const response = await axios.get(scriptUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
          },
          maxContentLength: MAX_FILE_SIZE
        });
        
        const content = response.data;
        scannedCount++;

        // Skip if content is too large
        if (content.length > MAX_FILE_SIZE) {
          console.log(`Skipping ${scriptUrl} - file too large`);
          continue;
        }

        // Scan with improved patterns
        for (const pattern of improvedPatterns) {
          const matches = processMatches(content, pattern);
          
          if (matches.length > 0) {
            scanResults.push({
              file: scriptUrl,
              issue: pattern.name,
              severity: pattern.severity,
              matches: matches
            });
          }
        }
      } catch (err) {
        console.log(`Failed to scan ${scriptUrl}: ${err.message}`);
      }
    }

    console.log(`Scan complete. Scanned ${scannedCount} files, found ${scanResults.length} potential issues`);
    
    // Generate scan ID and store results
    const scanId = uuidv4();
    storedScans.set(scanId, {
      url: url,
      timestamp: new Date().toISOString(),
      filesScanned: scannedCount,
      results: scanResults
    });
    
    // Clean up old results
    if (storedScans.size > 100) {
      const oldestKey = storedScans.keys().next().value;
      storedScans.delete(oldestKey);
    }
    
    res.json({ 
      scanId, 
      filesScanned: scannedCount,
      issuesFound: scanResults.length 
    });
  } catch (error) {
    console.error('Scan error:', error.message);
    res.status(500).json({ error: `Failed to scan website: ${error.message}` });
  }
};

exports.getScanResults = async (req, res) => {
  const { scanId } = req.params;
  
  if (!scanId) {
    return res.status(400).json({ error: "Scan ID is required" });
  }
  
  const scanData = storedScans.get(scanId);
  
  if (!scanData) {
    return res.status(404).json({ error: "Scan results not found" });
  }
  
  res.json(scanData);
};
