"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "./card"
import { Button } from "./button"

export type PopupSettingsValue = {
  domains: { chatgpt: boolean; gemini: boolean; claude: boolean }
  ocrLanguage: string
  ocrMode: "local" | "cloud"
}

export type PopupSettingsProps = {
  initial?: PopupSettingsValue
  onSave?: (value: PopupSettingsValue) => void
  onClose?: () => void
  className?: string
}

/**
 * Toolbar popup content sized to w-[350px].
 * Compose inside your extension popup root.
 */
export function PopupSettings({ initial, onSave, onClose, className }: PopupSettingsProps) {
  const [value, setValue] = React.useState<PopupSettingsValue>({
    domains: {
      chatgpt: initial?.domains.chatgpt ?? true,
      gemini: initial?.domains.gemini ?? true,
      claude: initial?.domains.claude ?? true,
    },
    ocrLanguage: initial?.ocrLanguage ?? "English",
    ocrMode: initial?.ocrMode ?? "local",
  })

  const handleSave = () => onSave?.(value)

  return (
    <div className={cn("w-[350px] p-4", className)}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-[#3B82F6] text-white grid place-items-center">
          <span className="text-xs font-semibold">S</span>
        </div>
        <h2 className="text-base font-semibold">StegoShield Settings</h2>
      </div>

      <div className="flex flex-col gap-3">
        {/* Domains */}
        <Card>
          <div className="mb-2">
            <h3 className="text-sm font-semibold">Domains</h3>
            <p className="text-xs text-[#6B7280]">Choose where StegoShield runs</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#3B82F6]"
                checked={value.domains.chatgpt}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    domains: { ...v.domains, chatgpt: e.target.checked },
                  }))
                }
              />
              ChatGPT
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#3B82F6]"
                checked={value.domains.gemini}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    domains: { ...v.domains, gemini: e.target.checked },
                  }))
                }
              />
              Gemini
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#3B82F6]"
                checked={value.domains.claude}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    domains: { ...v.domains, claude: e.target.checked },
                  }))
                }
              />
              Claude
            </label>
          </div>
        </Card>

        {/* OCR Language */}
        <Card>
          <div className="mb-2">
            <h3 className="text-sm font-semibold">OCR Language</h3>
            <p className="text-xs text-[#6B7280]">Default language</p>
          </div>
          <select
            value={value.ocrLanguage}
            onChange={(e) => setValue((v) => ({ ...v, ocrLanguage: e.target.value }))}
            className="w-full rounded-xl border border-[#6B7280] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          >
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>German</option>
            <option>Chinese (Simplified)</option>
            <option>Japanese</option>
          </select>
        </Card>

        {/* OCR Mode */}
        <Card>
          <div className="mb-2">
            <h3 className="text-sm font-semibold">OCR Mode</h3>
            <p className="text-xs text-[#6B7280]">Run locally or use cloud processing</p>
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ocrMode"
                value="local"
                className="h-4 w-4 accent-[#3B82F6]"
                checked={value.ocrMode === "local"}
                onChange={() => setValue((v) => ({ ...v, ocrMode: "local" }))}
              />
              Local (default)
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ocrMode"
                value="cloud"
                className="h-4 w-4 accent-[#3B82F6]"
                checked={value.ocrMode === "cloud"}
                onChange={() => setValue((v) => ({ ...v, ocrMode: "cloud" }))}
              />
              Cloud
            </label>
          </div>
        </Card>
      </div>

      {/* Footer actions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )
}
