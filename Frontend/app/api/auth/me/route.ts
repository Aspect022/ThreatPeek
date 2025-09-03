import { NextResponse } from "next/server"
import { parseSessionCookie } from "@/lib/auth"

export async function GET() {
  const user = parseSessionCookie()

  // If a real session exists, return it; otherwise fall back to demo user
  if (!user) {
    // Demo mode: return a fake user instead of 401
    return NextResponse.json({ user: { email: "demo@example.com", name: "Demo" } })
  }

  return NextResponse.json({ user: { email: user.email, name: user.name } })
}
