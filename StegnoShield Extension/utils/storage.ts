import type { PlasmoCSConfig } from "plasmo"
import type { OCRResult } from "./ocr"

// Storage interface for extension settings
export interface StegoShieldSettings {
  domains: Array<{ domain: string; enabled: boolean }>
  ocrLang: string
  ocrMode: "local" | "cloud"
}

// OCR result with metadata for storage
export interface StoredOCRResult {
  result: OCRResult
  timestamp: number
  imageName: string
  imageSize: number
}

// Default settings
const defaultSettings: StegoShieldSettings = {
  domains: [
    { domain: "chat.openai.com", enabled: true },
    { domain: "claude.ai", enabled: true },
    { domain: "gemini.google.com", enabled: true }
  ],
  ocrLang: "en",
  ocrMode: "local"
}

// Storage utility with Chrome extension API support
export const storage = {
  async get(): Promise<StegoShieldSettings> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.sync.get("stegoshield-settings")
        return result["stegoshield-settings"] || defaultSettings
      }
    } catch (error) {
      console.warn("Chrome storage not available, using defaults:", error)
    }
    
    // Fallback to localStorage for development
    try {
      const stored = localStorage.getItem("stegoshield-settings")
      return stored ? JSON.parse(stored) : defaultSettings
    } catch (error) {
      console.warn("LocalStorage not available, using defaults:", error)
      return defaultSettings
    }
  },

  async set(settings: StegoShieldSettings): Promise<void> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.sync.set({ "stegoshield-settings": settings })
        return
      }
    } catch (error) {
      console.warn("Chrome storage not available, falling back to localStorage:", error)
    }
    
    // Fallback to localStorage for development
    try {
      localStorage.setItem("stegoshield-settings", JSON.stringify(settings))
    } catch (error) {
      console.error("Failed to save settings:", error)
    }
  },

  async update(updates: Partial<StegoShieldSettings>): Promise<void> {
    const current = await this.get()
    await this.set({ ...current, ...updates })
  },

  // OCR Results Storage
  async getLastOCRResult(): Promise<StoredOCRResult | null> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get("stegoshield-last-ocr")
        return result["stegoshield-last-ocr"] || null
      }
    } catch (error) {
      console.warn("Chrome storage not available, falling back to localStorage:", error)
    }
    
    // Fallback to localStorage for development
    try {
      const stored = localStorage.getItem("stegoshield-last-ocr")
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.warn("LocalStorage not available for OCR results:", error)
      return null
    }
  },

  async saveOCRResult(result: OCRResult, imageFile: File): Promise<void> {
    const storedResult: StoredOCRResult = {
      result,
      timestamp: Date.now(),
      imageName: imageFile.name,
      imageSize: imageFile.size
    }

    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({ "stegoshield-last-ocr": storedResult })
        return
      }
    } catch (error) {
      console.warn("Chrome storage not available, falling back to localStorage:", error)
    }
    
    // Fallback to localStorage for development
    try {
      localStorage.setItem("stegoshield-last-ocr", JSON.stringify(storedResult))
    } catch (error) {
      console.error("Failed to save OCR result:", error)
    }
  },

  async clearOCRHistory(): Promise<void> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.remove("stegoshield-last-ocr")
        return
      }
    } catch (error) {
      console.warn("Chrome storage not available, falling back to localStorage:", error)
    }
    
    // Fallback to localStorage for development
    try {
      localStorage.removeItem("stegoshield-last-ocr")
    } catch (error) {
      console.error("Failed to clear OCR history:", error)
    }
  }
}
