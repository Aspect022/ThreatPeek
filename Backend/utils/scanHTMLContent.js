function scanHTMLContent(html, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    const patternMatches = [];
    let match;
    while ((match = pattern.regex.exec(html)) !== null) {
      patternMatches.push(match[0]);
      if (patternMatches.length >= 5) break;
    }
    pattern.regex.lastIndex = 0;
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

module.exports = { scanHTMLContent }; 