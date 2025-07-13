"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertTriangle, Search, Zap, Lock, Eye, Github, Folder } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { wakeUpBackend } from "@/lib/api";



export default function LandingPage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [scanMode, setScanMode] = useState<'basic' | 'deep'>('deep')

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)
    try {
    //    // Step 1: Wake up backend
    // const backendReady = await wakeUpBackend();
    // if (!backendReady) {
    //   throw new Error("Cannot connect to the scanner service.");
    // }
      // Make API call to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, scanMode }),
      })

      if (!response.ok) {
        throw new Error("Failed to scan website")
      }

      const scanData = await response.json()

      // Navigate to scan results page with URL parameter and scan ID
      router.push(`/scan?url=${encodeURIComponent(url)}&scanId=${scanData.scanId}`)
    } catch (error) {
      console.error("Error scanning website:", error)
      let errorMessage = "Error scanning website. Please try again."

      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        errorMessage = "Cannot connect to the scanner service."
      }

      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Dark Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
              <Shield className="h-8 w-8 text-blue-400 mr-2" />
                <span className="text-white text-xl font-bold">ThreatPeek</span>
              </div>
            </Link>
            <div className="flex items-center">
              <Link href="https://github.com/Aspect022/ThreatPeek" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-800">
                  <Github className="h-4 w-4 mr-2" />
                  View on GitHub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
              <Zap className="h-4 w-4" />
              <span>AI-Powered Threat Detection</span>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            ThreatPeek - Security at a Glance
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Advanced AI-powered security scanner with deep HTML & JavaScript file analysis that detects exposed API keys, secrets, and vulnerabilities in your web applications instantly.
          </p>

          {/* URL Input Section */}
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={handleScan}
              className="flex flex-col sm:flex-row gap-4 p-6 bg-white rounded-2xl shadow-lg border border-gray-200"
            >
              <div className="flex-1">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter your website URL (e.g., https://yoursite.com)"
                  className="h-14 text-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex flex-col justify-center">
                <label htmlFor="scanMode" className="text-xs font-medium text-gray-700 mb-1 ml-1">Scan Mode</label>
                <select
                  id="scanMode"
                  value={scanMode}
                  onChange={e => setScanMode(e.target.value as 'basic' | 'deep')}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-base focus:border-blue-500 focus:ring-blue-500 bg-white"
                  style={{ minWidth: 120 }}
                >
                  <option value="basic">Basic</option>
                  <option value="deep">Deep</option>
                </select>
              </div>
              <Button
                type="submit"
                disabled={isLoading || !url}
                className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Scanning...
                  </div>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Scan Now
                  </>
                )}
              </Button>
            </form>
            <p className="text-sm text-gray-500 mt-4">
              Free security scan • No registration required • Results in seconds
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Powerful Security Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive scanning and AI-powered analysis to keep your applications secure
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Deep Scanning Card */}
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Deep Scanning</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center text-lg leading-relaxed">
                  Advanced HTML & JavaScript file scanning with CDN filtering, caching, and 70+ security patterns for comprehensive threat detection
                </CardDescription>
              </CardContent>
            </Card>

            {/* AI Analysis Card */}
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center text-lg leading-relaxed">
                  Intelligent security assessment with contextual insights and actionable recommendations powered by AI
                </CardDescription>
              </CardContent>
            </Card>

            {/* Security Reports Card */}
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Detailed Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center text-lg leading-relaxed">
                  Comprehensive security reports with severity levels and prioritized recommendations for immediate
                  action
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Project Structure Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <Folder className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-2xl font-bold text-gray-900">Project Structure</h3>
            </div>
            <p className="text-lg text-gray-600 mb-8">
              ThreatPeek is built with modern web technologies and follows best practices for security scanning
              applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Frontend Structure */}
            <Card className="rounded-xl shadow-lg border-0 bg-white">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                  <Github className="h-5 w-5 mr-2 text-blue-600" />
                  Frontend (Next.js)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 font-mono">
                  <div>📁 Frontend/</div>
                  <div className="ml-4">📁 app/ - Next.js App Router pages</div>
                  <div className="ml-4">📁 components/ - Reusable UI components</div>
                  <div className="ml-4">📁 public/ - Static assets & SEO files</div>
                  <div className="ml-8">🔗 favicon files (16x16, 32x32)</div>
                  <div className="ml-8">📱 apple-touch-icon.png</div>
                  <div className="ml-8">🤖 robots.txt</div>
                  <div className="ml-8">📋 manifest.json</div>
                  <div className="ml-8">🖼️ og-image.png</div>
                  <div className="ml-4">📁 lib/ - Utility functions</div>
                  <div className="ml-4">📁 hooks/ - Custom React hooks</div>
                </div>
              </CardContent>
            </Card>

            {/* Backend Structure */}
            <Card className="rounded-xl shadow-lg border-0 bg-white">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-green-600" />
                  Backend (Node.js)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 font-mono">
                  <div>📁 Backend/</div>
                  <div className="ml-4">📁 controllers/ - API logic</div>
                  <div className="ml-8">🔍 scanController.js</div>
                  <div className="ml-8">⚡ improvedScanController.js</div>
                  <div className="ml-4">📁 routes/ - API endpoints</div>
                  <div className="ml-4">📁 utils/ - Security patterns</div>
                  <div className="ml-8">🔐 regexPatterns.js</div>
                  <div className="ml-8">🛡️ improvedRegexPatterns.js</div>
                  <div className="ml-4">🚀 server.js - Express server</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <Link href="https://github.com/Aspect022/ThreatPeek" target="_blank" rel="noopener noreferrer">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 text-lg font-medium rounded-xl">
                <Github className="h-5 w-5 mr-2" />
                Explore the Full Codebase
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link href="/" className="flex items-center mb-4 md:mb-0">
              <Shield className="h-8 w-8 text-blue-400 mr-2" />
              <span className="text-xl font-bold">ThreatPeek</span>
            </Link>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link
                href="https://github.com/Aspect022/ThreatPeek"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Github className="h-5 w-5 inline mr-1" />
                GitHub
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>
              &copy; {new Date().getFullYear()} ThreatPeek. All rights reserved. AI-Powered Threat Detection at a
              Glance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
