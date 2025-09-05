import { createWorker } from "tesseract.js"

export interface OCRResult {
  text: string
  confidence: number
  lines: string[]
  hasText: boolean
}

export interface OCRSettings {
  language: string
  mode: "local" | "cloud"
}

// OCR service using Tesseract.js
export class OCRService {
  private worker: Tesseract.Worker | null = null
  private isInitialized = false

  async initialize(language: string = "eng"): Promise<void> {
    if (this.isInitialized && this.worker) return

    try {
      this.worker = await createWorker(language, 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            // Could emit progress events here
          }
        }
      })
      
      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize OCR worker:", error)
      throw new Error("OCR initialization failed")
    }
  }

  async extractText(imageElement: HTMLImageElement, onProgress?: (progress: number) => void): Promise<OCRResult> {
    if (!this.worker || !this.isInitialized) {
      throw new Error("OCR service not initialized")
    }

    try {
      // Convert image to canvas for processing
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      if (!ctx) {
        throw new Error("Failed to get canvas context")
      }

      // Set canvas dimensions
      canvas.width = imageElement.naturalWidth || imageElement.width
      canvas.height = imageElement.naturalHeight || imageElement.height

      // Draw image to canvas
      ctx.drawImage(imageElement, 0, 0)

      // Perform OCR with progress tracking
      const result = await this.worker.recognize(canvas, {
        logger: (m) => {
          if (m.status === "recognizing text" && onProgress) {
            // Estimate progress based on Tesseract status
            if (m.progress) {
              onProgress(m.progress)
            }
          }
        }
      })
      
      // Process results
      const text = result.data.text.trim()
      const lines = text.split("\n").filter(line => line.trim().length > 0)
      const confidence = result.data.confidence / 100

      return {
        text,
        confidence,
        lines,
        hasText: text.length > 0
      }
    } catch (error) {
      console.error("OCR extraction failed:", error)
      throw new Error("Text extraction failed")
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this.isInitialized = false
    }
  }

  // Get available languages
  async getAvailableLanguages(): Promise<string[]> {
    try {
      const worker = await createWorker()
      const languages = await worker.getLanguages()
      await worker.terminate()
      return languages
    } catch (error) {
      console.warn("Failed to get available languages:", error)
      return ["eng"] // Fallback to English
    }
  }
}

// Singleton instance
export const ocrService = new OCRService()
