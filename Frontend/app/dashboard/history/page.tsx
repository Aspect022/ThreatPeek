import type { Metadata } from "next"
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Dashboard – History",
}

export default function DashboardHistoryPage() {
  // Hardcoded demo data
  const scanHistory = [
    { id: "s1", type: "Normal Scan", date: "2025-09-01", issues: 13, status: "completed" },
    { id: "s2", type: "Github Scan", date: "2025-09-01", issues: 1, status: "completed" },
    { id: "s3", type: "Deep Scan", date: "2025-09-03", issues: 17, status: "completed" },
  ]

  const logHistory = [
    { id: "l1", level: "info", message: "Scheduled scan started", ts: "2025-09-03 09:12" },
    { id: "l2", level: "warn", message: "Rate limit approaching threshold", ts: "2025-09-03 09:15" },
    { id: "l3", level: "error", message: "GitHub token missing for repo X", ts: "2025-09-02 18:47" },
  ]

  const alertHistory = [
    { id: "a1", severity: "high", title: "Exposed API key found in /public/js/app.js", ts: "2025-09-01 14:03" },
    { id: "a2", severity: "medium", title: "Subresource Integrity missing on CDN script", ts: "2025-09-02 10:55" },
    { id: "a3", severity: "low", title: "Deprecated TLS version detected", ts: "2025-09-02 12:21" },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:py-10">
      <header className="mb-6">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Dashboard – History</h1>
      </header>

      <div className="mb-6">
        <DashboardTabs />
      </div>

      <section aria-label="History sections" className="mx-auto w-full max-w-3xl">
        <Tabs defaultValue="scan" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scan">Scan History</TabsTrigger>
            <TabsTrigger value="logs">Log History</TabsTrigger>
            <TabsTrigger value="alerts">Alert History</TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="space-y-3">
            {scanHistory.map((s) => (
              <Card key={s.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {s.type}{" "}
                      <Badge variant="secondary" className="ml-2 capitalize">
                        {s.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>completed at: {s.date}</CardDescription>
                  </div>
                  <div className="text-sm font-medium">{s.issues} issues found</div>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="logs" className="space-y-3">
            {logHistory.map((l) => (
              <Card key={l.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base capitalize">{l.level}</CardTitle>
                    <CardDescription>{l.ts}</CardDescription>
                  </div>
                  <CardContent className="p-0">
                    <p className="px-6 py-2 text-sm text-muted-foreground">{l.message}</p>
                  </CardContent>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-3">
            {alertHistory.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      className="capitalize"
                      variant={
                        a.severity === "high" ? "destructive" : a.severity === "medium" ? "default" : "secondary"
                      }
                    >
                      {a.severity}
                    </Badge>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                  </div>
                  <CardDescription>{a.ts}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  )
}
