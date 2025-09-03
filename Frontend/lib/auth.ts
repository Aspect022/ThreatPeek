import { cookies } from "next/headers"

export const SESSION_COOKIE = "tp_session"

export type SessionUser = {
  email: string
  name?: string
  iat: number
  exp: number
}

export async function parseSessionCookie(): Promise<SessionUser | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    const json = Buffer.from(raw, "base64").toString("utf-8")
    const data = JSON.parse(json) as SessionUser
    if (!data.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

export function createSessionValue(
  user: { email: string; name?: string },
  ttlMs = 1000 * 60 * 60 * 24 * 7 // 7 days
) {
  const payload: SessionUser = {
    email: user.email,
    name: user.name,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  }
  const raw = JSON.stringify(payload)
  return Buffer.from(raw, "utf-8").toString("base64")
}
