const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const regexPatterns = require("../utils/regexPatterns");

// In-memory storage for scan results (in production, use Redis or database)
const storedScans = new Map();

exports.scanWebsite = async (req, res) => {
  const { url } = req.body;

  // Validate URL
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    // Validate URL format
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    console.log(`Scanning: ${url}`);

    // Fetch HTML with timeout and headers
    const htmlResponse = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = htmlResponse.data;

    // Extract script URLs using multiple patterns
    const scriptRegexes = [
      /<script[^>]*src=["'](.*?)["'][^>]*>/gi,
      /<script[^>]*src=([^\s>"']+)[^>]*>/gi
    ];

    let scriptUrls = [];
    scriptRegexes.forEach(regex => {
      const matches = [...html.matchAll(regex)];
      matches.forEach(match => {
        let scriptUrl = match[1];
        // Clean up the URL by removing quotes and whitespace
        scriptUrl = scriptUrl.replace(/["'\s]/g, '');
        if (scriptUrl && !scriptUrls.includes(scriptUrl)) {
          scriptUrls.push(scriptUrl);
        }
      });
    });

    console.log(`Found ${scriptUrls.length} script URLs`);

    let scanResults = [];

    // Process each script URL
    for (let scriptUrl of scriptUrls) {
      try {
        // Handle relative URLs
        if (!scriptUrl.startsWith("http")) {
          if (scriptUrl.startsWith("//")) {
            scriptUrl = validUrl.protocol + scriptUrl;
          } else if (scriptUrl.startsWith("/")) {
            scriptUrl = validUrl.origin + scriptUrl;
          } else {
            scriptUrl = validUrl.origin + "/" + scriptUrl;
          }
        }
        
        // Skip if URL is malformed or contains double protocol
        if (scriptUrl.includes('http://http') || scriptUrl.includes('https://https')) {
          console.log(`Skipping malformed URL: ${scriptUrl}`);
          continue;
        }

        // Remove quotes if present
        scriptUrl = scriptUrl.replace(/["']/g, '');

        console.log(`Fetching: ${scriptUrl}`);

        const jsResponse = await axios.get(scriptUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const jsContent = jsResponse.data;

        // Scan content with all patterns
        regexPatterns.forEach((pattern) => {
          const matches = jsContent.match(pattern.regex);
          if (matches) {
            scanResults.push({
              file: scriptUrl,
              issue: pattern.name,
              severity: pattern.severity,
              matches: matches.slice(0, 5), // Limit to first 5 matches
            });
          }
        });
      } catch (err) {
        console.log(`Failed to fetch ${scriptUrl}: ${err.message}`);
      }
    }

    console.log(`Scan complete. Found ${scanResults.length} issues`);
    
    // Generate unique scan ID and store results
    const scanId = uuidv4();
    storedScans.set(scanId, {
      url: url,
      timestamp: new Date().toISOString(),
      results: scanResults
    });
    
    // Clean up old results (keep only last 100 scans)
    if (storedScans.size > 100) {
      const oldestKey = storedScans.keys().next().value;
      storedScans.delete(oldestKey);
    }
    
    res.json({ scanId, resultsCount: scanResults.length });
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

