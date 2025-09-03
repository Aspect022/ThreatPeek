"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Scan", href: "/dashboard/scan" },
  { label: "History", href: "/dashboard/history" },
  { label: "Logs", href: "/dashboard/logs" },
  { label: "Advance", href: "/dashboard/advance" },
  { label: "Alerts", href: "/dashboard/alerts" },
]

export function DashboardTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard sections" className="w-full">
      <ul className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-lg border bg-background/60 p-1 shadow-sm backdrop-blur">
        {tabs.map((t) => {
          const active = pathname === t.href
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-center text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-pretty">{t.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default DashboardTabs
