import { NextRequest, NextResponse } from 'next/server';

function generateFallbackSummary(reportSummary: any): string {
  const { totalIssues, criticalCount, highCount, mediumCount, lowCount } = reportSummary;
  
  if (totalIssues === 0) {
    return `✅ Excellent! ThreatPeek's scan found no security vulnerabilities in your system. Your security posture is strong!

To further enhance your security, consider implementing these advanced practices:

1. **Content Security Policy (CSP) headers** - Control resource loading to prevent XSS attacks
2. **Subresource Integrity (SRI)** - Ensure external scripts haven't been tampered with  
3. **Regular dependency auditing** - Keep libraries updated with security patches

Keep up the great work! Remember to run regular scans and maintain strong security practices.`;
  }

  let summary = '';
  
  if (criticalCount > 0) {
    summary += `🚨 CRITICAL ALERT: Found ${criticalCount} critical security issue${criticalCount > 1 ? 's' : ''} requiring immediate attention!\n\n`;
  } else if (highCount > 0) {
    summary += `⚠️ HIGH RISK: Detected ${highCount} high-risk vulnerability${highCount > 1 ? 'ies' : 'y'} that should be addressed promptly.\n\n`;
  } else {
    summary += `📋 SECURITY REVIEW: Found ${totalIssues} security issue${totalIssues > 1 ? 's' : ''} to address.\n\n`;
  }

  summary += `**Issue Breakdown:**\n`;
  if (criticalCount > 0) summary += `• Critical: ${criticalCount}\n`;
  if (highCount > 0) summary += `• High: ${highCount}\n`;
  if (mediumCount > 0) summary += `• Medium: ${mediumCount}\n`;
  if (lowCount > 0) summary += `• Low: ${lowCount}\n\n`;

  summary += `**Immediate Actions:**\n`;
  summary += `1. Address critical and high-severity issues first\n`;
  summary += `2. Review exposed secrets and rotate credentials\n`;
  summary += `3. Implement proper access controls\n`;
  summary += `4. Regular security monitoring and updates\n\n`;

  summary += `💡 **Tip:** Use the detailed findings below to prioritize your security improvements.`;

  return summary;
}

function categorizeIssues(scanData: any) {
  const categories = {
    apiKeys: 0,
    passwords: 0,
    connectionStrings: 0,
    privateKeys: 0,
    webhooks: 0,
    tokens: 0,
    sampleIssues: [] as string[]
  };

  // Handle both legacy and enhanced formats
  let results = [];
  if (Array.isArray(scanData.results)) {
    // Legacy format
    results = scanData.results;
  } else if (scanData.results && scanData.results.categories) {
    // Enhanced format - flatten all findings
    results = scanData.results.categories.flatMap((category: any) => 
      category.findings.map((finding: any) => ({
        issue: finding.type || finding.title,
        severity: finding.severity,
        file: finding.location?.file || finding.location?.url,
        matches: finding.evidence ? [finding.evidence.pattern || finding.evidence.value] : []
      }))
    );
  }

  results.forEach((result: any) => {
    const issue = result.issue.toLowerCase();
    const sampleMatch = result.matches?.[0] || 'Pattern matched';
    const fileName = result.file ? new URL(result.file).pathname.split('/').pop() : 'Unknown file';
    
    if (issue.includes('api key')) categories.apiKeys++;
    else if (issue.includes('password')) categories.passwords++;
    else if (issue.includes('connection string')) categories.connectionStrings++;
    else if (issue.includes('private key')) categories.privateKeys++;
    else if (issue.includes('webhook')) categories.webhooks++;
    else if (issue.includes('token')) categories.tokens++;
    
    // Add sample issues (max 3)
    if (categories.sampleIssues.length < 3) {
      categories.sampleIssues.push(`Found '${sampleMatch.substring(0, 20)}...' in ${fileName}`);
    }
  });

  return {
    ...categories,
    totalIssues: results.length,
    criticalCount: results.filter(r => r.severity === 'critical').length,
    highCount: results.filter(r => r.severity === 'high').length,
    mediumCount: results.filter(r => r.severity === 'medium').length,
    lowCount: results.filter(r => r.severity === 'low').length
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const summary = body.summary;
    if (!summary) {
      return NextResponse.json({ error: 'Missing summary' }, { status: 400 });
    }

    // Categorize the issues
    const reportSummary = categorizeIssues(summary);

    const systemPrompt = `You are ThreatPeek's AI security analyst. Write a concise, professional security assessment based on the scan results.

If issues are found:
- Start with an emoji alert (🚨 for critical, ⚠️ for high risk, 📋 for medium/low)
- Mention specific counts and types of vulnerabilities found
- Explain the potential risks (data breaches, unauthorized access, etc.)
- Provide actionable mitigation steps
- Keep it under 200 words

If no issues are found:
- Celebrate with ✅ and congratulate the user
- Suggest 2-3 creative, advanced security practices:
  * CSP (Content Security Policy) headers
  * Subresource Integrity (SRI)
  * Code obfuscation
  * Security headers (X-Content-Type-Options, etc.)
  * Dependency auditing
- Use encouraging, positive language
- End with a security tip or best practice

Tone: Professional but friendly, security-focused, actionable.`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Missing Gemini API key' }, { status: 500 });
    }

    // console.log('Calling Gemini API with data:', JSON.stringify(reportSummary, null, 2)); // Removed for production
    
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nScan Results Summary: ${JSON.stringify(reportSummary, null, 2)}` }
            ]
          }
        ]
      })
    })

    
    // console.log('Gemini API response status:', geminiRes.status); // Removed for production
    
    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('Gemini API error:', errorText);
      
      // Check if it's a quota/rate limit error
      if (errorText.includes('quota') || errorText.includes('rate limit') || errorText.includes('overloaded')) {
        // Return a fallback summary instead of an error
        const fallbackSummary = generateFallbackSummary(reportSummary);
        return NextResponse.json({ summary: fallbackSummary });
      }
      
      return NextResponse.json({ error: `Gemini API error: ${errorText}` }, { status: 500 });
    }
    
    const geminiData = await geminiRes.json();
    // console.log('Gemini API response:', JSON.stringify(geminiData, null, 2)); // Removed for production
    
    const summaryText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available.';
    // console.log('Generated summary:', summaryText); // Removed for production
    
    return NextResponse.json({ summary: summaryText });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
