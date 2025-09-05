"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type DomainToggle = { domain: string; enabled: boolean }

const defaultDomains: DomainToggle[] = [
  { domain: "chat.openai.com", enabled: true },
  { domain: "claude.ai", enabled: true },
  { domain: "gemini.google.com", enabled: true },
]

export default function PopupSettingsPage() {
  const [domains, setDomains] = React.useState<DomainToggle[]>(defaultDomains)
  const [ocrLang, setOcrLang] = React.useState("en")
  const [ocrMode, setOcrMode] = React.useState<"local" | "cloud">("local")

  const toggleDomain = (domain: string) => {
    setDomains((prev) => prev.map((d) => (d.domain === domain ? { ...d, enabled: !d.enabled } : d)))
  }

  const saveSettings = () => {
    // Placeholder: wire to chrome.storage or messaging later
    console.log("[v0] Saving settings", { domains, ocrLang, ocrMode })
  }

  return (
    <main className="font-sans mx-auto max-w-md p-4">
      <header className="mb-4">
        <h1 className="text-pretty text-lg font-semibold">StegoShield Settings</h1>
        <p className="mt-1 text-sm text-foreground/70">Configure where the extension runs and OCR preferences.</p>
      </header>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Domains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {domains.map((d) => (
            <div key={d.domain} className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">{d.domain}</p>
                <p className="text-xs text-foreground/60">Enable extension on this domain</p>
              </div>
              <Switch checked={d.enabled} onCheckedChange={() => toggleDomain(d.domain)} />
            </div>
          ))}
          <p className="text-xs text-foreground/60">More domain management is planned in a future update.</p>
        </CardContent>
      </Card>

      <div className="my-4" />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">OCR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="lang">Language</Label>
              <Select value={ocrLang} onValueChange={setOcrLang}>
                <SelectTrigger id="lang" className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="my-2 h-px bg-border" />

            <div className="grid gap-2">
              <Label>Mode</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={ocrMode === "local"}
                  onClick={() => setOcrMode("local")}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    ocrMode === "local" ? "border-teal-600 bg-teal-50" : "hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-medium">Local OCR</p>
                  <p className="text-xs text-foreground/60">Default. Runs in your browser.</p>
                </button>
                <button
                  type="button"
                  aria-pressed={ocrMode === "cloud"}
                  onClick={() => setOcrMode("cloud")}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    ocrMode === "cloud" ? "border-teal-600 bg-teal-50" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Cloud OCR</p>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Future
                    </span>
                  </div>
                  <p className="text-xs text-foreground/60">Optional server-side processing.</p>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={saveSettings}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <footer className="mt-4 text-center text-xs text-foreground/60">
        Color system: teal (primary), foreground/background neutrals, green/red accents.
      </footer>
    </main>
  )
}
