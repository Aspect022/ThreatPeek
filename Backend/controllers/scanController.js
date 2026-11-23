const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const regexPatterns = require("../utils/regexPatterns");
const improvedPatterns = require("../utils/improvedRegexPatterns");
const { extractJSFiles, isCDNUrl } = require("../utils/extractJSFiles");
const { scanHTMLContent } = require("../utils/scanHTMLContent");
const { scanJSFile } = require("../utils/scanJSFile");

// In-memory storage for scan results (in production, use Redis or database)
const storedScans = new Map();

exports.basicScan = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    let validUrl;
    try { validUrl = new URL(url); } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }
    const htmlResponse = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
      }
    });
    if (!htmlResponse.headers["content-type"] || !htmlResponse.headers["content-type"].includes("text/html")) {
      return res.status(400).json({ error: "URL does not return HTML content" });
    }
    const html = htmlResponse.data;
    const results = scanHTMLContent(html, regexPatterns);
    const scanId = uuidv4();
    storedScans.set(scanId, {
      url,
      timestamp: new Date().toISOString(),
      results,
      scanMode: 'basic',
      deduplicationStats: {
        deduplicationEnabled: false,
        reason: 'Basic scan mode does not use deduplication'
      }
    });
    if (storedScans.size > 100) {
      const oldestKey = storedScans.keys().next().value;
      storedScans.delete(oldestKey);
    }
    res.json({ scanId, resultsCount: results.length, scanMode: 'basic' });
  } catch (error) {
    res.status(500).json({ error: `Failed to scan website: ${error.message}` });
  }
};

exports.deepScan = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    let validUrl;
    try { validUrl = new URL(url); } catch (err) {
      return res.status(400).json({ error: "Invalid URL format" });
    }
    const htmlResponse = await axios.get(url, {
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/1.0; +https://ThreatPeek.com)'
      }
    });
    if (!htmlResponse.headers["content-type"] || !htmlResponse.headers["content-type"].includes("text/html")) {
      return res.status(400).json({ error: "URL does not return HTML content" });
    }
    const html = htmlResponse.data;
    // 1. Basic scan (HTML)
    const htmlResults = scanHTMLContent(html, improvedPatterns);
    // 2. Extract JS files
    const jsFiles = extractJSFiles(html, url);
    const filteredJsFiles = jsFiles.filter(file => !isCDNUrl(file));
    // 3. Scan JS files
    let jsResults = [];
    for (const jsUrl of filteredJsFiles) {
      const matches = await scanJSFile(jsUrl, improvedPatterns);
      jsResults = jsResults.concat(matches);
    }
    const results = [...htmlResults, ...jsResults];
    const scanId = uuidv4();
    storedScans.set(scanId, {
      url,
      timestamp: new Date().toISOString(),
      results,
      scanMode: 'deep',
      jsFilesFound: jsFiles.length,
      jsFilesScanned: filteredJsFiles.length,
      deduplicationStats: {
        deduplicationEnabled: false,
        reason: 'Deep scan mode does not use deduplication (legacy controller)'
      }
    });
    if (storedScans.size > 100) {
      const oldestKey = storedScans.keys().next().value;
      storedScans.delete(oldestKey);
    }
    res.json({ scanId, resultsCount: results.length, scanMode: 'deep', jsFilesFound: jsFiles.length, jsFilesScanned: filteredJsFiles.length });
  } catch (error) {
    res.status(500).json({ error: `Failed to scan website: ${error.message}` });
  }
};

exports.scanWebsite = async (req, res) => {
  const { scanMode = 'deep' } = req.body;
  if (scanMode === 'basic') {
    return exports.basicScan(req, res);
  } else {
    return exports.deepScan(req, res);
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

