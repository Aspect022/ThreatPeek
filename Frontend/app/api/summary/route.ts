import { NextRequest, NextResponse } from 'next/server';

function categorizeIssues(results: any[]) {
  const categories = {
    apiKeys: 0,
    passwords: 0,
    connectionStrings: 0,
    privateKeys: 0,
    webhooks: 0,
    tokens: 0,
    sampleIssues: [] as string[]
  };

  results.forEach((result) => {
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
    const reportSummary = categorizeIssues(summary.results || []);

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

    console.log('Calling Gemini API with data:', JSON.stringify(reportSummary, null, 2));
    
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

    
    console.log('Gemini API response status:', geminiRes.status);
    
    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json({ error: `Gemini API error: ${errorText}` }, { status: 500 });
    }
    
    const geminiData = await geminiRes.json();
    console.log('Gemini API response:', JSON.stringify(geminiData, null, 2));
    
    const summaryText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary available.';
    console.log('Generated summary:', summaryText);
    
    return NextResponse.json({ summary: summaryText });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
} 