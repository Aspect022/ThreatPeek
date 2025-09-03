"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"

export function UserCard() {
  const { user } = useAuth()
  const initials = (user?.name || user?.email || "U")
    .split("@")[0]
    .split(" ")
    .map((p: string) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("")

  return (
    <Card className="p-4 flex items-start gap-4">
      <Avatar className="h-12 w-12">
        <AvatarFallback>{initials || "U"}</AvatarFallback>
      </Avatar>
      <div className="grid gap-1">
        <div className="font-medium">{user?.name || "Demo User"}</div>
        <div className="text-sm text-muted-foreground">{user?.email || "demo@example.com"}</div>
        <div className="text-xs text-muted-foreground">Role: {user?.role || "member"}</div>
      </div>
    </Card>
  )
}
