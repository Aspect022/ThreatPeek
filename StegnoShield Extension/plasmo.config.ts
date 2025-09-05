import type { PlasmoConfig } from "plasmo"

export const config: PlasmoConfig = {
  name: "StegoShield",
  description: "Detect and extract hidden text from images using OCR",
  version: "0.1.0",
  manifest: {
    permissions: [
      "storage",
      "activeTab"
    ],
    host_permissions: [
      "https://chat.openai.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
      "https://bard.google.com/*"
    ]
  }
}
