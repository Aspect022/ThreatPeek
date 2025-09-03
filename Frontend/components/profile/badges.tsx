"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type BadgeSlug =
  | "ddos-proof"
  | "sql-safe"
  | "xss-guard"
  | "csrf-shield"
  | "rate-limited"
  | "config-hygiene"
  | "uptime-99"

/**
 * System-managed badges. Do not expose edit controls in the UI.
 * Replace the image paths with your real PNGs later. Keep the same slugs.
 */
const BADGES: { slug: BadgeSlug; name: string; description: string; image: string }[] = [
  {
    slug: "ddos-proof",
    name: "DDoS Proof",
    description: "Passed traffic surge simulation",
    image: "/images/badges/ddos-proof.png",
  },
  {
    slug: "sql-safe",
    name: "SQL Injection Safe",
    description: "Resisted SQL injection tests",
    image: "/images/badges/sql-safe.png",
  },
  {
    slug: "xss-guard",
    name: "XSS Guarded",
    description: "Mitigated cross-site scripting",
    image: "/images/badges/xss-guard.png",
  },
  {
    slug: "csrf-shield",
    name: "CSRF Shield",
    description: "Verified CSRF protections",
    image: "/images/badges/csrf-shield.png",
  },
  {
    slug: "rate-limited",
    name: "Rate Limited",
    description: "Proper rate limit defenses",
    image: "/images/badges/rate-limited.png",
  },
  {
    slug: "config-hygiene",
    name: "Config Hygiene",
    description: "Secure config & secrets",
    image: "/images/badges/config-hygiene.png",
  },
  {
    slug: "uptime-99",
    name: "99%+ Uptime",
    description: "Consistent availability",
    image: "/images/badges/uptime-99.png",
  },
]

export function BadgesGrid({
  earned,
  className,
  showLocked = true,
}: {
  earned: BadgeSlug[]
  className?: string
  showLocked?: boolean
}) {
  const earnedSet = React.useMemo(() => new Set(earned), [earned])

  const items = BADGES.filter((b) => showLocked || earnedSet.has(b.slug))

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4", className)}>
      {items.map((b) => {
        const isEarned = earnedSet.has(b.slug)
        return (
          <Card
            key={b.slug}
            className={cn("p-3 flex flex-col items-center text-center gap-3", isEarned ? "" : "opacity-60")}
            role="group"
            aria-label={`${b.name}${isEarned ? "" : " (locked)"}`}
          >
            <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.image || "/placeholder.svg"}
                alt={b.name}
                className={cn("w-full h-full object-contain", isEarned ? "" : "grayscale")}
              />
            </div>
            <div>
              <div className="font-medium">{b.name}</div>
              <p className="text-xs text-muted-foreground">{b.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded",
                  isEarned
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
                )}
              >
                {isEarned ? "Awarded" : "Locked"}
              </span>
              {/* Non-interactive placeholder to keep layout consistent */}
              <Button variant="ghost" size="sm" disabled className="h-7 px-2">
                Details
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
