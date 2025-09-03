const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');
const improvedPatterns = require("../utils/improvedRegexPatterns");

// In-memory storage for scan results
const storedScans = new Map();

// Cache for scanned JS URLs to avoid duplicate fetches
const jsUrlCache = new Map();

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

// CDN domains to skip (optional - can be enabled/disabled)
const CDN_DOMAINS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'gstatic.com',
  'googleapis.com',
  'cloudflare.com'
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

// Check if URL is from a CDN
function isCDNUrl(url) {
  try {
    const urlObj = new URL(url);
    return CDN_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch (err) {
    return false;
  }
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

// Extract JS files from HTML using cheerio
function extractJSFiles(html, baseUrl) {
  const $ = cheerio.load(html);
  const jsFiles = new Set();

  // Extract script tags with src attribute
  $("script[src]").each((_, el) => {
    let src = $(el).attr("src");
    
    // Skip data URLs and inline scripts
    if (src.startsWith('data:') || src.startsWith('javascript:')) {
      return;
    }
    
    // Handle relative URLs
    if (!src.startsWith('http')) {
      if (src.startsWith('//')) {
        src = new URL(src, baseUrl).href;
      } else if (src.startsWith('/')) {
        src = new URL(src, baseUrl).href;
      } else {
        src = new URL(src, baseUrl).href;
      }
    }
    
    // Skip if should be excluded
    if (!shouldExcludeUrl(src)) {
      jsFiles.add(src);
    }
  });

  return Array.from(jsFiles);
}

// Fetch and scan JS file content
async function scanJSFile(url, patterns, scanProgress) {
  try {
    // Check cache first
    if (jsUrlCache.has(url)) {
      console.log(`[CACHE] Using cached content for: ${url}`);
      return jsUrlCache.get(url);
    }

    console.log(`[SCAN] Fetching: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
      },
      maxContentLength: MAX_FILE_SIZE
    });
    
    const content = response.data;
    
    // Skip if content is too large
    if (content.length > MAX_FILE_SIZE) {
      console.log(`[SKIP] File too large: ${url} (${content.length} bytes)`);
      return [];
    }

    const matches = [];
    
    // Scan with patterns
    for (const pattern of patterns) {
      const patternMatches = processMatches(content, pattern);
      
      if (patternMatches.length > 0) {
        matches.push({
          file: url,
          issue: pattern.name,
          severity: pattern.severity,
          matches: patternMatches
        });
      }
    }

    // Cache the results
    jsUrlCache.set(url, matches);
    
    // Update progress
    if (scanProgress) {
      scanProgress.current++;
      scanProgress.total = Math.max(scanProgress.total, scanProgress.current);
    }

    return matches;
  } catch (err) {
    console.log(`[ERROR] Failed to scan ${url}: ${err.message}`);
    return [];
  }
}

// Scan HTML content for patterns
function scanHTMLContent(html, patterns) {
  const matches = [];
  
  for (const pattern of patterns) {
    const patternMatches = processMatches(html, pattern);
    
    if (patternMatches.length > 0) {
      matches.push({
        file: 'HTML Content',
        issue: pattern.name,
        severity: pattern.severity,
        matches: patternMatches
      });
    }
  }
  
  return matches;
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

    console.log(`🚀 Starting deep scan for: ${url}`);

    // Fetch HTML
    let htmlResponse;
    let html;
    try {
      console.log(`[HTML] Fetching main page...`);
      htmlResponse = await axios.get(url, {
        timeout: 15000,
        maxContentLength: MAX_FILE_SIZE,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
        }
      });
      if (!htmlResponse.headers["content-type"] || !htmlResponse.headers["content-type"].includes("text/html")) {
        console.log("Skipping non-HTML content:", url);
        return res.status(400).json({ error: "URL does not return HTML content" });
      }
      html = htmlResponse.data;
    } catch (err) {
      console.error(`[ERROR] Failed to fetch or parse HTML for ${url}:`, err.message);
      return res.status(500).json({ error: `Failed to fetch or parse HTML: ${err.message}` });
    }

    // Extract JS files using cheerio
    let jsFiles = [];
    try {
      console.log(`[JS] Extracting JavaScript files...`);
      const $ = cheerio.load(html);
      const jsSet = new Set();
      $("script[src]").each((_, el) => {
        let src = $(el).attr("src");
        if (src.startsWith('data:') || src.startsWith('javascript:')) return;
        if (!src.startsWith('http')) {
          src = new URL(src, url).href;
        }
        if (!shouldExcludeUrl(src)) {
          jsSet.add(src);
        }
      });
      jsFiles = Array.from(jsSet);
    } catch (err) {
      console.error(`[ERROR] cheerio.load failed for ${url}:`, err.message);
      return res.status(500).json({ error: `Failed to parse HTML for JS extraction: ${err.message}` });
    }

    // Filter out CDN files (optional - can be disabled)
    const filteredJsFiles = jsFiles.filter(file => !isCDNUrl(file));
    console.log(`[INFO] Found ${jsFiles.length} JS files (${filteredJsFiles.length} after CDN filtering)`);

    // Scan progress tracking
    const scanProgress = {
      current: 0,
      total: filteredJsFiles.length + 1 // +1 for HTML scan
    };

    const scanResults = [];
    let scannedCount = 0;
    let skippedCount = 0;

    // 1. Scan HTML content first
    try {
      console.log(`[HTML] Scanning main page content...`);
      const htmlMatches = scanHTMLContent(html, improvedPatterns);
      scanResults.push(...htmlMatches);
      scannedCount++;
    } catch (err) {
      console.error(`[ERROR] Failed to scan HTML content for ${url}:`, err.message);
    }

    // 2. Scan each JS file
    console.log(`[JS] Starting JavaScript file scanning...`);
    for (const jsUrl of filteredJsFiles) {
      try {
        // Fetch JS file with timeout and size limit
        const response = await axios.get(jsUrl, {
          timeout: 8000,
          maxContentLength: MAX_FILE_SIZE,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
          }
        });
        // Validate content-type for JS
        const contentType = response.headers["content-type"] || "";
        if (!contentType.includes("javascript") && !contentType.includes("text/plain")) {
          console.log(`[SKIP] Non-JS content-type for: ${jsUrl} (${contentType})`);
          skippedCount++;
          continue;
        }
        const content = response.data;
        if (content.length > MAX_FILE_SIZE) {
          console.log(`[SKIP] File too large: ${jsUrl} (${content.length} bytes)`);
          skippedCount++;
          continue;
        }
        // Scan with patterns
        for (const pattern of improvedPatterns) {
          const matches = processMatches(content, pattern);
          if (matches.length > 0) {
            scanResults.push({
              file: jsUrl,
              issue: pattern.name,
              severity: pattern.severity,
              matches: matches
            });
          }
        }
        scannedCount++;
      } catch (err) {
        console.log(`[ERROR] Failed to scan ${jsUrl}: ${err.message}`);
        skippedCount++;
      }
    }

    console.log(`✅ Deep scan complete!`);
    console.log(`📊 Results: Scanned ${scannedCount} files, skipped ${skippedCount}, found ${scanResults.length} potential issues`);
    
    // Generate scan ID and store results
    const scanId = uuidv4();
    storedScans.set(scanId, {
      url: url,
      timestamp: new Date().toISOString(),
      filesScanned: scannedCount,
      filesSkipped: skippedCount,
      jsFilesFound: jsFiles.length,
      jsFilesScanned: filteredJsFiles.length,
      results: scanResults,
      scanType: 'deep'
    });
    
    // Clean up old results (keep last 100 scans)
    if (storedScans.size > 100) {
      const oldestKey = storedScans.keys().next().value;
      storedScans.delete(oldestKey);
    }
    
    // Clean up cache (keep last 200 URLs)
    if (jsUrlCache.size > 200) {
      const oldestKey = jsUrlCache.keys().next().value;
      jsUrlCache.delete(oldestKey);
    }
    
    res.json({ 
      scanId, 
      filesScanned: scannedCount,
      filesSkipped: skippedCount,
      jsFilesFound: jsFiles.length,
      jsFilesScanned: filteredJsFiles.length,
      issuesFound: scanResults.length,
      scanType: 'deep'
    });
  } catch (error) {
    console.error('❌ Scan error:', error.message);
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
