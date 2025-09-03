import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    // In real implementation, enqueue a workflow or call an external system.
    // For now, just acknowledge and echo what would have triggered.
    return NextResponse.json({ ok: true, triggered: true, received: body ?? null })
  } catch (err) {
    return NextResponse.json({ ok: false, error: "failed-to-trigger" }, { status: 500 })
  }
}
