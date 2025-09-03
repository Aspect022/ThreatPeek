"use client"

import useSWR from "swr"

type MeResponse = { user: { email: string; name?: string } | null }

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" })
  if (res.status === 401) return { user: null } as MeResponse
  if (!res.ok) throw new Error("Failed to load")
  return (await res.json()) as MeResponse
}

export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<MeResponse>("/api/auth/me", fetcher)
  const user = data?.user ?? null

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    await mutate()
  }

  return { user, isLoading, error, mutate, logout }
}
