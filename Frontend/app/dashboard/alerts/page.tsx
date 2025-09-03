"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
// If you created a shared dashboard tabs, use it; otherwise this section still renders fine without it.
import DashboardTabs from "@/components/dashboard/dashboard-tabs"

// Hardcoded demo alerts. Replace with real data later.
type Alert = {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  source: "scan" | "logs" | "watcher" | "system"
  createdAt: string
  status: "open" | "resolved"
  description?: string
}

const demoAlerts: Alert[] = [
  {
    id: "a-1001",
    severity: "critical",
    title: "Exposed API key in homepage",
    source: "scan",
    createdAt: new Date().toISOString(),
    status: "open",
    description: "Detected API key-like pattern in page script bundle.",
  },
  {
    id: "a-1002",
    severity: "high",
    title: "Multiple 5xx spikes on /api/auth",
    source: "logs",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    status: "open",
    description: "Error rate exceeded 3% over 5 minutes.",
  },
  {
    id: "a-1003",
    severity: "medium",
    title: "Unusual login location",
    source: "watcher",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    status: "resolved",
    description: "Login from new country compared to recent activity.",
  },
]

function SeverityBadge({ level }: { level: Alert["severity"] }) {
  const map = {
    critical: "bg-red-600 text-white",
    high: "bg-orange-600 text-white",
    medium: "bg-yellow-500 text-black",
    low: "bg-blue-600 text-white",
  } as const
  return <Badge className={cn("capitalize", map[level])}>{level}</Badge>
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(demoAlerts)
  const [slackEnabled, setSlackEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [slackWebhook, setSlackWebhook] = useState("")
  const [email, setEmail] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const pathname = usePathname()

  const openCount = useMemo(() => alerts.filter((a) => a.status === "open").length, [alerts])

  function markResolved(id: string) {
    setAlerts((curr) => curr.map((a) => (a.id === id ? { ...a, status: "resolved" } : a)))
  }

  return (
    <main className="min-h-[calc(100vh-64px)]">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Top dashboard nav */}
        {DashboardTabs ? <DashboardTabs active="alerts" /> : null}

        <div className="mt-6 flex items-center justify-between">
          <h1 className="text-balance text-2xl font-semibold">Alerts</h1>
          {/* Quick actions area */}
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/history">View History</Link>
            </Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-600/90">Send test alert</Button>
          </div>
        </div>

        {/* Secondary tabs: Past Alerts | Settings */}
        <Tabs defaultValue="past" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 md:max-w-md mx-auto">
            <TabsTrigger value="past">Past Alerts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="past" className="mt-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  All Alerts
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {alerts.length} total • {openCount} open
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {alerts.map((a) => (
                    <li key={a.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <SeverityBadge level={a.severity} />
                          <p className="font-medium">{a.title}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Badge variant="outline" className="capitalize">
                            {a.source}
                          </Badge>
                          <span>•</span>
                          <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString()}</time>
                          <span>•</span>
                          <Badge
                            className={cn(
                              "capitalize",
                              a.status === "open" ? "bg-emerald-600 text-white" : "bg-gray-300 text-gray-900",
                            )}
                          >
                            {a.status}
                          </Badge>
                        </div>
                      </div>
                      {a.description ? <p className="mt-2 text-sm text-gray-700">{a.description}</p> : null}
                      <div className="mt-3 flex items-center gap-3">
                        {a.status === "open" ? (
                          <Button size="sm" onClick={() => markResolved(a.id)}>
                            Mark resolved
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => markResolved(a.id)}>
                            Reopen
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          View details
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alert Channels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Slack */}
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-2">
                    <Label htmlFor="slackWebhook">Slack Webhook (optional)</Label>
                    <Input
                      id="slackWebhook"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                    />
                    <p className="text-sm text-gray-600">Send alerts to a Slack channel via Incoming Webhook.</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Label htmlFor="slackEnabled" className="text-sm">
                      Enable
                    </Label>
                    <Switch id="slackEnabled" checked={slackEnabled} onCheckedChange={setSlackEnabled} />
                  </div>
                </div>

                {/* Email */}
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                      id="email"
                      placeholder="security@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-sm text-gray-600">Receive alerts via email.</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Label htmlFor="emailEnabled" className="text-sm">
                      Enable
                    </Label>
                    <Switch id="emailEnabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                  </div>
                </div>

                {/* Webhook */}
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-2">
                    <Label htmlFor="webhookUrl">Custom Webhook (optional)</Label>
                    <Input
                      id="webhookUrl"
                      placeholder="https://example.com/alerts"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                    <p className="text-sm text-gray-600">Post alerts to any HTTPS endpoint.</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Label htmlFor="webhookEnabled" className="text-sm">
                      Enable
                    </Label>
                    <Switch id="webhookEnabled" checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button variant="outline">Cancel</Button>
                  <Button className="bg-blue-600 text-white hover:bg-blue-600/90">Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
