const cheerio = require('cheerio');

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

const CDN_DOMAINS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'gstatic.com',
  'googleapis.com',
  'cloudflare.com'
];

function shouldExcludeUrl(url) {
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

function isCDNUrl(url) {
  try {
    const urlObj = new URL(url);
    return CDN_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch (err) {
    return false;
  }
}

function extractJSFiles(html, baseUrl) {
  const $ = cheerio.load(html);
  const jsFiles = new Set();
  $("script[src]").each((_, el) => {
    let src = $(el).attr("src");
    if (src.startsWith('data:') || src.startsWith('javascript:')) return;
    if (!src.startsWith('http')) {
      src = new URL(src, baseUrl).href;
    }
    if (!shouldExcludeUrl(src)) {
      jsFiles.add(src);
    }
  });
  return Array.from(jsFiles);
}

module.exports = {
  extractJSFiles,
  shouldExcludeUrl,
  isCDNUrl,
  CDN_DOMAINS
}; 