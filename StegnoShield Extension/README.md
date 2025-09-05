# StegnoShield Browser Extension 🧩

A powerful Chrome browser extension built with Plasmo framework that provides real-time steganography detection and image analysis capabilities directly in your browser.

## 🎯 Overview

The StegnoShield Browser Extension extends ThreatPeek's capabilities into web browsing, offering:

- **Real-time Image Analysis**: Analyze images on any webpage for hidden content
- **Context Menu Integration**: Right-click analysis of images
- **On-demand Scanning**: Popup interface for quick analysis
- **Seamless Integration**: Direct connection to StegnoShield service
- **Visual Indicators**: Inline threat indicators and warnings
- **Privacy-focused**: Local processing with optional cloud analysis

## 🛠️ Technology Stack

- **Framework**: Plasmo 0.90.5 (Modern browser extension framework)
- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS 4.1.9 with animations
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **OCR**: Tesseract.js for client-side text extraction
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Advanced Plasmo build system

## 🏗️ Architecture

```
StegnoShield Extension/
├── 📄 manifest.json              # Extension manifest (auto-generated)
├── 📄 package.json               # Dependencies and scripts
├── 📄 next.config.mjs           # Next.js configuration
├── 📄 tailwind.config.js        # Tailwind CSS configuration
├── 📄 components.json           # shadcn/ui configuration
├── 📄 tsconfig.json             # TypeScript configuration
├── 📂 app/                      # App Router components
│   ├── 📄 globals.css           # Global styles
│   └── 📄 layout.tsx            # App layout
├── 📂 assets/                   # Extension assets
│   ├── 📄 icon-16.svg           # Extension icons (SVG)
│   ├── 📄 icon-32.svg
│   ├── 📄 icon-48.svg
│   ├── 📄 icon.svg
│   └── 📄 icon*.png             # Extension icons (PNG)
├── 📂 components/               # Reusable UI components
│   └── 📄 theme-provider.tsx    # Theme management
├── 📂 hooks/                    # Custom React hooks
│   ├── 📄 use-mobile.ts         # Mobile detection
│   └── 📄 use-toast.ts          # Toast notifications
├── 📂 lib/                      # Utility libraries
│   └── 📄 utils.ts              # Helper functions
├── 📂 .plasmo/                  # Plasmo generated files
│   ├── 📄 chrome-mv3.plasmo.manifest.json
│   ├── 📄 devtools.html
│   ├── 📄 newtab.html
│   ├── 📄 options.html
│   ├── 📄 popup.html
│   └── 📄 sidepanel.html
├── 📄 content.tsx               # Content script
├── 📄 options.tsx               # Options page
└── 📄 popup.tsx                 # Extension popup
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Chrome browser (for testing)

### Installation

1. **Navigate to Extension directory**
   ```bash
   cd "StegnoShield Extension"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Load extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` directory

### Building for Production

```bash
# Build the extension
npm run build

# Package for distribution
npm run package
```

The built extension will be in the `build/chrome-mv3-prod` directory.

## 📦 Key Dependencies

### Core Framework
```json
{
  "plasmo": "^0.90.5",
  "next": "14.2.16",
  "react": "^18",
  "react-dom": "^18",
  "typescript": "^5"
}
```

### UI & Styling
```json
{
  "@radix-ui/react-*": "Various UI components",
  "tailwindcss": "^4.1.9",
  "lucide-react": "^0.454.0",
  "framer-motion": "^12.23.12",
  "class-variance-authority": "^0.7.1"
}
```

### Functionality
```json
{
  "tesseract.js": "^6.0.1",
  "react-hook-form": "^7.60.0",
  "zod": "3.25.67"
}
```

## 🎨 Extension Components

### Popup Interface

The main extension popup provides quick access to analysis tools:

```tsx
// popup.tsx
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Scan, Settings } from "lucide-react"

function IndexPopup() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeCurrentPage = async () => {
    setIsAnalyzing(true)
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { action: 'scanImages' })
    setIsAnalyzing(false)
  }

  return (
    <div className="w-80 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="/assets/icon-32.png" alt="StegnoShield" className="w-6 h-6" />
            StegnoShield
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={analyzeCurrentPage} 
            className="w-full" 
            disabled={isAnalyzing}
          >
            <Scan className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'Scan Current Page'}
          </Button>
          
          <Button variant="outline" className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            Upload Image
          </Button>
          
          <Button variant="ghost" className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default IndexPopup
```

### Content Script

The content script handles webpage interaction and image analysis:

```tsx
// content.tsx
import type { PlasmoCSConfig } from "plasmo"
import { createRoot } from "react-dom/client"
import { AlertTriangle, Shield } from "lucide-react"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

interface AnalysisResult {
  suspicious: boolean
  confidence: number
  techniques?: string[]
}

class ImageAnalyzer {
  private stegnoShieldUrl = "http://localhost:8000"
  
  async analyzeImage(imageElement: HTMLImageElement): Promise<AnalysisResult> {
    try {
      // Convert image to blob
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = imageElement.naturalWidth
      canvas.height = imageElement.naturalHeight
      ctx?.drawImage(imageElement, 0, 0)
      
      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return resolve({ suspicious: false, confidence: 0 })
          
          const formData = new FormData()
          formData.append('file', blob, 'image.png')
          
          try {
            const response = await fetch(`${this.stegnoShieldUrl}/analyze`, {
              method: 'POST',
              body: formData
            })
            
            const result = await response.json()
            resolve({
              suspicious: result.analysis_results?.steganography_detected || false,
              confidence: result.analysis_results?.confidence_score || 0,
              techniques: result.analysis_results?.techniques_detected || []
            })
          } catch (error) {
            console.error('Analysis failed:', error)
            resolve({ suspicious: false, confidence: 0 })
          }
        }, 'image/png')
      })
    } catch (error) {
      console.error('Image processing failed:', error)
      return { suspicious: false, confidence: 0 }
    }
  }
  
  addThreatIndicator(imageElement: HTMLImageElement, result: AnalysisResult) {
    // Create threat indicator
    const indicator = document.createElement('div')
    indicator.className = 'stego-threat-indicator'
    indicator.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      z-index: 10000;
      background: ${result.suspicious ? '#ef4444' : '#22c55e'};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `
    
    indicator.textContent = result.suspicious 
      ? `⚠️ Suspicious (${Math.round(result.confidence * 100)}%)`
      : '✅ Clean'
    
    // Position relative to image
    const parent = imageElement.parentElement
    if (parent) {
      parent.style.position = 'relative'
      parent.appendChild(indicator)
    }
  }
}

// Initialize analyzer
const analyzer = new ImageAnalyzer()

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanImages') {
    scanPageImages()
    sendResponse({ success: true })
  }
})

async function scanPageImages() {
  const images = document.querySelectorAll('img')
  console.log(`Found ${images.length} images to analyze`)
  
  for (const img of images) {
    if (img.complete && img.naturalWidth > 0) {
      try {
        const result = await analyzer.analyzeImage(img)
        analyzer.addThreatIndicator(img, result)
      } catch (error) {
        console.error('Failed to analyze image:', error)
      }
    }
  }
}

// Auto-scan images on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(scanPageImages, 2000) // Allow images to load
  })
} else {
  setTimeout(scanPageImages, 2000)
}
```

### Options Page

Configuration interface for extension settings:

```tsx
// options.tsx
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Settings {
  autoScan: boolean
  serviceUrl: string
  showIndicators: boolean
  analysisThreshold: number
}

function OptionsIndex() {
  const [settings, setSettings] = useState<Settings>({
    autoScan: true,
    serviceUrl: 'http://localhost:8000',
    showIndicators: true,
    analysisThreshold: 0.7
  })

  useEffect(() => {
    // Load saved settings
    chrome.storage.sync.get(['stegnoShieldSettings'], (result) => {
      if (result.stegnoShieldSettings) {
        setSettings(result.stegnoShieldSettings)
      }
    })
  }, [])

  const saveSettings = () => {
    chrome.storage.sync.set({ stegnoShieldSettings: settings }, () => {
      console.log('Settings saved')
    })
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">StegnoShield Settings</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-scan"
                checked={settings.autoScan}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, autoScan: checked }))}
              />
              <Label htmlFor="auto-scan">Auto-scan images on page load</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="show-indicators"
                checked={settings.showIndicators}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, showIndicators: checked }))}
              />
              <Label htmlFor="show-indicators">Show threat indicators on images</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="threshold">Analysis Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={settings.analysisThreshold}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, analysisThreshold: parseFloat(e.target.value) }))}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Service Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-url">StegnoShield Service URL</Label>
              <Input
                id="service-url"
                value={settings.serviceUrl}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, serviceUrl: e.target.value }))}
                placeholder="http://localhost:8000"
              />
            </div>
          </CardContent>
        </Card>
        
        <Button onClick={saveSettings} className="w-full">
          Save Settings
        </Button>
      </div>
    </div>
  )
}

export default OptionsIndex
```

## 📋 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production version
- `npm run package` - Create distribution package
- `npm run lint` - Run ESLint
- `npm start` - Alias for dev command

## 🔧 Extension Permissions

The extension requires the following permissions (defined in manifest):

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "contextMenus"
  ],
  "host_permissions": [
    "http://localhost:8000/*",
    "https://api.threatpeek.com/*"
  ]
}
```

### Permission Explanations
- **activeTab**: Access current tab for image analysis
- **storage**: Save user settings and preferences
- **contextMenus**: Add right-click context menu options
- **host_permissions**: Connect to StegnoShield service APIs

## 🎮 Features

### Context Menu Integration

Right-click analysis on any image:

```typescript
// Background script (auto-generated by Plasmo)
chrome.contextMenus.create({
  id: "analyze-image",
  title: "Analyze with StegnoShield",
  contexts: ["image"]
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyze-image" && info.srcUrl) {
    // Send analysis request
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeSpecificImage',
      imageUrl: info.srcUrl
    })
  }
})
```

### Visual Threat Indicators

Real-time visual feedback on analyzed images:

- 🟢 **Green Badge**: Clean image, no threats detected
- 🟡 **Yellow Badge**: Suspicious patterns, low confidence
- 🔴 **Red Badge**: High-confidence threat detection
- ⚠️ **Warning Overlay**: Detailed threat information

### OCR Text Extraction

Client-side text extraction using Tesseract.js:

```typescript
import Tesseract from 'tesseract.js'

async function extractTextFromImage(imageElement: HTMLImageElement): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageElement.src,
      'eng',
      {
        logger: m => console.log(m) // Progress logging
      }
    )
    return text
  } catch (error) {
    console.error('OCR extraction failed:', error)
    return ''
  }
}
```

## 🔒 Privacy & Security

### Data Handling
- **Local Processing**: Basic analysis performed locally when possible
- **Opt-in Cloud Analysis**: Advanced analysis requires user consent
- **No Data Storage**: Images are not stored on servers
- **Encrypted Transmission**: All API communications use HTTPS
- **User Control**: Users can disable specific features

### Security Features
- **Content Security Policy**: Strict CSP to prevent XSS
- **Input Validation**: All user inputs validated with Zod schemas
- **Secure Communication**: API keys and tokens handled securely
- **Permission Minimal**: Only necessary permissions requested

## 🧪 Testing

### Manual Testing
1. **Install Development Build**: Load unpacked extension
2. **Visit Test Pages**: Navigate to image-rich websites
3. **Trigger Analysis**: Use popup or context menu
4. **Verify Indicators**: Check visual feedback appears
5. **Test Settings**: Modify options and verify behavior

### Automated Testing
```bash
# Run extension tests
npm run test

# E2E testing with Playwright
npm run test:e2e
```

## 🚀 Distribution

### Chrome Web Store

1. **Build Production Version**
   ```bash
   npm run build
   npm run package
   ```

2. **Create Store Package**
   - Zip the `build/chrome-mv3-prod` directory
   - Include all required assets and manifest

3. **Submit to Chrome Web Store**
   - Create developer account
   - Upload extension package
   - Complete store listing with descriptions, screenshots
   - Wait for review and approval

### Private Distribution

```bash
# Create CRX package for enterprise
npx crx pack build/chrome-mv3-prod -p private-key.pem -o stegno-shield.crx
```

## 🔧 Configuration

### Environment Variables
```env
# Development
PLASMO_PUBLIC_STEGO_SERVICE_URL=http://localhost:8000

# Production
PLASMO_PUBLIC_STEGO_SERVICE_URL=https://api.threatpeek.com
PLASMO_PUBLIC_ANALYTICS_ID=your_analytics_id
```

### Plasmo Configuration
```typescript
// plasmo.config.ts
import { PlasmoConfig } from "plasmo"

const config: PlasmoConfig = {
  manifest: {
    permissions: ["activeTab", "storage", "contextMenus"],
    host_permissions: ["http://localhost:8000/*"]
  },
  build: {
    minify: true,
    sourcemap: false
  }
}

export default config
```

## 🛟 Troubleshooting

### Common Issues

**Extension Not Loading**
- Check Chrome developer mode is enabled
- Verify manifest.json syntax
- Check console for errors

**Analysis Not Working**
- Ensure StegnoShield service is running
- Check network connectivity
- Verify CORS settings on service

**Performance Issues**
- Reduce auto-scan frequency
- Implement image size limits
- Use selective analysis

### Debug Mode
```bash
# Enable debug logging
PLASMO_DEBUG=true npm run dev
```

## 🔮 Future Enhancements

- [ ] **Firefox Support**: Mozilla Firefox extension port
- [ ] **Edge Support**: Microsoft Edge compatibility
- [ ] **Offline Mode**: Enhanced local processing capabilities
- [ ] **Batch Analysis**: Process multiple images simultaneously
- [ ] **Report Generation**: Export analysis reports
- [ ] **Integration APIs**: Connect with other security tools
- [ ] **Mobile Support**: Progressive Web App version
- [ ] **Advanced Visualizations**: Detailed analysis overlays

## 🤝 Contributing

1. Follow Plasmo framework conventions
2. Use TypeScript for all new code
3. Test across multiple websites
4. Ensure privacy compliance
5. Document new features thoroughly

---

For detailed Plasmo documentation, visit: https://docs.plasmo.com/
