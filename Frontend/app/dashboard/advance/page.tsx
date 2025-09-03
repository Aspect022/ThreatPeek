"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import DashboardTabs from "@/components/dashboard/dashboard-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

/**
 * Advanced tools dashboard (stubbed).
 * - Mobile-first, centered container
 * - Expandable sections (Accordion) for future implementations
 * - All actions are safe "Simulate" placeholders for now
 */

export default function AdvancePage() {
  const { toast } = useToast()
  const router = useRouter()

  const [sandboxActive, setSandboxActive] = useState(false)

  const simulate = (name: string) => {
    toast({
      title: sandboxActive ? `${name} triggered` : "Sandbox inactive",
      description: sandboxActive
        ? "This is a placeholder action. A real sandbox runner can be wired next."
        : "Activate the sandbox to enable tools.",
    })
  }

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="border-b">
        <div className="container mx-auto max-w-5xl px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-pretty">Advanced Tools</h1>
            <div className="hidden md:block">
              <Button variant="secondary" onClick={() => router.push("/dashboard/logs")}>
                View Logs
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Carefully controlled security simulations you can run in a sandbox. Tools remain disabled until the sandbox
            is activated.
          </p>
        </div>
        <div className="container mx-auto max-w-5xl px-4 pb-2">
          <DashboardTabs active="advance" />
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-5xl px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle>Sandbox</CardTitle>
              <CardDescription>Activate a safe sandbox to enable tools below.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Button
                  onClick={() => {
                    setSandboxActive(true)
                    toast({
                      title: "Sandbox activated",
                      description: "Tools are now enabled. You can run simulations safely.",
                    })
                  }}
                  // grey until active, then show as blue and disabled
                  variant={sandboxActive ? "default" : "secondary"}
                  disabled={sandboxActive}
                >
                  {sandboxActive ? "Sandbox Active" : "Activate Sandbox"}
                </Button>
              </div>

              <div
                className={`mt-6 min-h-[180px] rounded-md border-2 border-dashed flex items-center justify-center text-sm ${
                  sandboxActive ? "border-primary bg-accent" : "border-border text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {sandboxActive ? "Sandbox is running. Choose a test below." : "Sandbox inactive. Activate to begin."}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => simulate("SQLi")}
                  variant={sandboxActive ? "default" : "secondary"}
                  disabled={!sandboxActive}
                >
                  SQLi
                </Button>
                <Button
                  onClick={() => simulate("XSS")}
                  variant={sandboxActive ? "default" : "secondary"}
                  disabled={!sandboxActive}
                >
                  XSS
                </Button>
                <Button
                  onClick={() => simulate("nmap")}
                  variant={sandboxActive ? "default" : "secondary"}
                  disabled={!sandboxActive}
                >
                  nmap
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
