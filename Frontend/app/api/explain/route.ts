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
    examples: results.slice(0, 30).map((r) => ({
      issue: r.issue,
      sample: r.matches?.[0] || "Pattern matched",
      file: r.file || "N/A",
      severity: r.severity || "unknown",
    })),
  }
}

function fallbackExplain(summary: any) {
  const s = summary.bySeverity
  if (summary.totalIssues === 0) {
    return "Great news! We didn’t find any problems. Keep your secrets out of code, rotate keys regularly, and scan often to stay safe."
  }
  return `We found ${summary.totalIssues} problems (critical: ${s.critical}, high: ${s.high}, medium: ${s.medium}, low: ${s.low}). 
Think of these like unlocked doors and visible keys to your house. Close the big doors first (critical/high): remove exposed keys (API tokens, passwords), 
move secrets to environment variables, and rotate anything that might be exposed. Then fix the rest to reduce overall risk.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const summary = categorizeIssues(body.summary)
    const geminiApiKey = process.env.GEMINI_API_KEY
    const system =
      "Explain all issues in extremely simple, friendly language a non-technical person can understand. " +
      "Avoid jargon. Use short sentences and real-world analogies. Focus on what could happen if unfixed."

    if (!geminiApiKey) {
      return NextResponse.json({ text: fallbackExplain(summary) })
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
      return NextResponse.json({ text: fallbackExplain(summary), note: `fallback: ${txt.substring(0, 120)}...` })
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || fallbackExplain(summary)
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ text: fallbackExplain({ totalIssues: 0, bySeverity: {} }) })
  }
}
