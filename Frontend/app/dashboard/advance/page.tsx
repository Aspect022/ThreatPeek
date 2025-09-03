"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import DashboardTabs from "@/components/dashboard/dashboard-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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

  const [targetUrl, setTargetUrl] = useState("")
  const [apiEndpoint, setApiEndpoint] = useState("")
  const [enableRateLimitBypass, setEnableRateLimitBypass] = useState(false)
  const [customPayload, setCustomPayload] = useState("")

  const simulate = (name: string) => {
    toast({
      title: `${name} ready`,
      description: "This is a placeholder action. We will wire this to a safe sandbox/workflow in the next iteration.",
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
            Carefully controlled security simulations you can run in a sandbox. All tools are disabled by default and
            currently run as no-op simulations for UI testing.
          </p>
        </div>
        <div className="container mx-auto max-w-5xl px-4 pb-2">
          <DashboardTabs active="advance" />
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-5xl px-4 py-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>Set defaults shared across tests. These values are not persisted yet.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="targetUrl">Target URL</Label>
                  <Input
                    id="targetUrl"
                    placeholder="https://example.com"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="apiEndpoint">Primary API Endpoint</Label>
                  <Input
                    id="apiEndpoint"
                    placeholder="https://api.example.com/v1"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="sandbox">
                <AccordionTrigger>Sandbox Simulation</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>
                        Run all actions in an isolated sandbox. We’ll connect this to a real runner later.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
                      <div className="grid gap-2 flex-1">
                        <Label htmlFor="sandbox-notes">Notes</Label>
                        <Textarea id="sandbox-notes" placeholder="Describe scenario or goals..." />
                      </div>
                      <Button onClick={() => simulate("Sandbox simulation")}>Simulate</Button>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ddos">
                <AccordionTrigger>Traffic Spike / DDoS Drill</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>
                        Safe traffic spike rehearsal. Does not perform any real load in this demo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="ddos-target">Target URL</Label>
                        <Input
                          id="ddos-target"
                          placeholder="https://example.com"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ddos-rps">Planned RPS</Label>
                        <Input id="ddos-rps" type="number" placeholder="e.g. 2000" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2">
                          <span>Bypass rate limit (simulate)</span>
                          <Switch
                            checked={enableRateLimitBypass}
                            onCheckedChange={setEnableRateLimitBypass}
                            aria-label="Toggle rate limit bypass simulation"
                          />
                        </Label>
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button variant="destructive" onClick={() => simulate("DDoS drill")}>
                          Simulate Spike
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sql">
                <AccordionTrigger>SQL Injection Probe</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>
                        Test common payloads against a controlled sandbox. This UI only simulates responses for now.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="sql-target">Endpoint</Label>
                        <Input
                          id="sql-target"
                          placeholder="POST {api}/login"
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-3">
                        <Label htmlFor="sql-payload">Custom Payload</Label>
                        <Input
                          id="sql-payload"
                          placeholder={`' OR 1=1 --`}
                          value={customPayload}
                          onChange={(e) => setCustomPayload(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button onClick={() => simulate("SQL injection probe")}>Simulate</Button>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="xss">
                <AccordionTrigger>XSS Injection Probe</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>Try reflected / stored XSS payloads safely (simulation only).</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="xss-endpoint">Endpoint</Label>
                        <Input
                          id="xss-endpoint"
                          placeholder="GET {url}/search?q="
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-3">
                        <Label htmlFor="xss-payload">Payload</Label>
                        <Input id="xss-payload" placeholder={`<img src=x onerror=alert(1)>`} />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button onClick={() => simulate("XSS probe")}>Simulate</Button>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="csrf">
                <AccordionTrigger>CSRF Scenario</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>Validate CSRF protection heuristics (simulation only).</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
                      <div className="grid gap-2 flex-1">
                        <Label htmlFor="csrf-endpoint">Sensitive Endpoint</Label>
                        <Input id="csrf-endpoint" placeholder="POST {api}/transfer-funds" />
                      </div>
                      <Button onClick={() => simulate("CSRF scenario")}>Simulate</Button>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="config-drift">
                <AccordionTrigger>Config Drift Simulation</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>Detects simulated drift across environments.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between gap-4">
                      <div className="grid gap-2 flex-1">
                        <Label htmlFor="drift-notes">Notes</Label>
                        <Textarea id="drift-notes" placeholder="e.g. missing env var in staging..." />
                      </div>
                      <Button onClick={() => simulate("Config drift simulation")}>Simulate</Button>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="rate-limit">
                <AccordionTrigger>Rate Limit Throttle Test</AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardDescription>Exercise throttling paths (simulation only).</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="rate-burst">Burst</Label>
                        <Input id="rate-burst" type="number" placeholder="e.g. 50" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="rate-window">Window (s)</Label>
                        <Input id="rate-window" type="number" placeholder="e.g. 10" />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button onClick={() => simulate("Rate limit test")}>Simulate</Button>
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>
    </main>
  )
}
