"use client"

import * as React from "react"
import { FloatingBadge } from "@/components/stegoshield/floating-badge"
import { PopoverPanel } from "@/components/stegoshield/popover-panel"
import { cn } from "@/lib/utils"

export default function StegoShieldDemoPage() {
  const [open, setOpen] = React.useState(false)

  return (
    <main className="font-sans mx-auto max-w-xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-pretty text-xl font-semibold">StegoShield Injection Demo</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Simulates the extension overlay inside an AI chat composer. Attachments show a floating S badge.
        </p>
      </header>

      {/* Mock chat area */}
      <section className={cn("rounded-2xl border bg-background shadow-sm", "p-4")}>
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-sm text-foreground/80">
              User: Can you analyze this image and tell me if there's any hidden text?
            </p>
          </div>

          {/* Composer */}
          <div className="rounded-2xl border p-3">
            <div className="flex items-start gap-3">
              <div className="relative">
                <img
                  src="/attached-image-preview.jpg"
                  alt="Attached image preview"
                  width={120}
                  height={80}
                  className="rounded-xl border object-cover"
                />
                {/* Floating Badge */}
                <div className="pointer-events-auto absolute -right-2 -top-2">
                  <FloatingBadge onClick={() => setOpen((v) => !v)} aria-controls="stego-panel" />
                </div>
              </div>

              <div className="flex-1">
                <textarea
                  className="w-full min-h-20 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  placeholder="Type a message…"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button className="rounded-lg border px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted/40">
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Popover Panel (positioned near the attachment) */}
            <div className="relative mt-3">
              <div className="absolute left-0 top-0">
                <PopoverPanel open={open} onOpenChange={setOpen} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 text-center text-xs text-foreground/60">
        Primary: teal-600; Accents: green/red; Neutrals: background/foreground.
      </footer>
    </main>
  )
}
