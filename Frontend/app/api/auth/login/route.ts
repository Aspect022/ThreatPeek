import { type NextRequest, NextResponse } from "next/server"
import { createSessionValue, SESSION_COOKIE } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Use a single hardcoded demo password instead of length check
    const DEMO_PASSWORD = "demo1234"
    if (password !== DEMO_PASSWORD) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const name = String(email).split("@")[0]
    const cookieValue = createSessionValue({ email, name })

    const res = NextResponse.json({ user: { email, name } })
    res.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 })
  }
}
