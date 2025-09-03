import { type NextRequest, NextResponse } from "next/server"

function categorizeIssues(scanData: any) {
  let results: any[] = []
  if (Array.isArray(scanData?.results)) results = scanData.results
  else if (scanData?.results?.categories) {
    results = scanData.results.categories.flatMap((category: any) =>
      category.findings.map((f: any) => ({
        issue: f.type || f.title,
        severity: String(f.severity || "").toLowerCase(),
        file: f.location?.file || f.location?.url,
        matches: f.evidence ? [f.evidence.pattern || f.evidence.value] : [],
      })),
    )
  }
  return {
    totalIssues: results.length,
    bySeverity: {
      critical: results.filter((r) => r.severity === "critical").length,
      high: results.filter((r) => r.severity === "high").length,
      medium: results.filter((r) => r.severity === "medium").length,
      low: results.filter((r) => r.severity === "low").length,
    },
    issues: results.slice(0, 50).map((r) => ({
      title: r.issue,
      severity: r.severity,
      file: r.file || "N/A",
    })),
  }
}

function fallbackGuide(summary: any) {
  const s = summary.bySeverity || {}
  return [
    "1) Rotate any exposed keys or passwords immediately (critical/high).",
    "2) Remove secrets from code. Store them in environment variables or a secrets manager.",
    "3) Restrict access: least-privilege for tokens and API keys.",
    "4) Add input validation and parameterized queries to stop SQL injection.",
    "5) Add rate limiting and bot protection to reduce DDoS impact.",
    "6) Add security headers (CSP, X-Frame-Options, X-Content-Type-Options).",
    `7) Re-scan after fixes to confirm (issues: ${summary.totalIssues}, critical: ${s.critical || 0}, high: ${s.high || 0}).`,
  ].join("\n")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const summary = categorizeIssues(body.summary)
    const geminiApiKey = process.env.GEMINI_API_KEY
    const system =
      "You are a senior application security engineer. Produce a clear, actionable, step-by-step remediation playbook. " +
      "Group steps by priority (critical/high first), keep each step specific and concrete. Include verification steps."

    if (!geminiApiKey) {
      return NextResponse.json({ text: fallbackGuide(summary) })
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${system}\n\nHere is the compact issue summary (JSON):\n` + JSON.stringify(summary, null, 2),
                },
              ],
            },
          ],
        }),
      },
    )

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ text: fallbackGuide(summary), note: `fallback: ${txt.substring(0, 120)}...` })
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || fallbackGuide(summary)
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ text: fallbackGuide({ totalIssues: 0, bySeverity: {} }) })
  }
}
