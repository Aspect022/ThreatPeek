"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScanTypeSelector, type ScanConfig } from "@/components/ui/scan-type-selector"
import { CheckCircle2 } from "lucide-react"
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs"

export default function DashboardScanPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [isLoading, user, router])

  const handleScanStart = async (config: ScanConfig) => {
    setIsScanning(true)
    try {
      const endpoint = "/enhanced-scan"
      let scanTypes = ["url"]
      if (config.scanType === "repository") scanTypes = ["repository"]
      else if (config.scanType === "deep") scanTypes = ["url", "files", "headers", "owasp"]

      const body: any = {
        scanTypes,
        options: {
          timeout: 30000,
          confidenceThreshold: 0.5,
          ...config.options,
        },
      }

      if (config.scanType === "repository") body.repositoryUrl = config.repositoryUrl
      else body.url = config.url

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to start scan")
      const data = await res.json()

      const params = new URLSearchParams({
        scanId: data.scanId,
        scanType: config.scanType,
      })
      if (config.url) params.set("url", config.url)
      if (config.repositoryUrl) params.set("repositoryUrl", config.repositoryUrl)

      router.push(`/scan?${params.toString()}`)
    } catch (err) {
      alert("Error starting scan. Please try again.")
    } finally {
      setIsScanning(false)
    }
  }

  const previousScans = [
    { type: "Normal scan", issues: 13, date: "31-08-2025", status: "completed" },
    { type: "GitHub scan", issues: 1, date: "01-09-2025", status: "completed" },
    { type: "Deep scan", issues: 17, date: "03-09-2025", status: "completed" },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:py-10">
      {/* Primary dashboard tabs */}
      <div className="mb-6">
        <DashboardTabs />
      </div>

      {/* Scan section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-balance">Scan your website for Exposed secrets & vulnerabilities</CardTitle>
          <CardDescription>Uses the same scanners as the homepage.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScanTypeSelector onScanStart={handleScanStart} isLoading={isScanning} />
        </CardContent>
      </Card>

      {/* Previous scans - centered column */}
      <section aria-labelledby="previous-scans" className="mx-auto w-full max-w-3xl">
        <h2 id="previous-scans" className="mb-4 text-xl font-semibold">
          Previous scans
        </h2>
        <div className="space-y-3">
          {previousScans.map((s, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {s.type} <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">completed at: {s.date}</p>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{s.issues}</span> issues found
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
