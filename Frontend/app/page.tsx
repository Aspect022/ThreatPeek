"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScanTypeSelector, type ScanConfig } from "@/components/ui/scan-type-selector"
import { Shield, AlertTriangle, Search, Zap, Eye, Github, Folder } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  const handleScanStart = async (config: ScanConfig) => {
    // Require login for repo and deep scans
    if (!user && (config.scanType === "repository" || config.scanType === "deep")) {
      router.push("/login")
      return
    }
    setIsLoading(true)
    try {
      // Use the enhanced scan endpoint
      const endpoint = "/enhanced-scan"

      // Determine scan types based on config
      let scanTypes = ["url"]
      if (config.scanType === "repository") {
        scanTypes = ["repository"]
      } else if (config.scanType === "deep") {
        scanTypes = ["url", "files", "headers", "owasp"]
      }

      const requestBody: any = {
        scanTypes: scanTypes,
        options: {
          timeout: 30000,
          confidenceThreshold: 0.5,
          ...config.options,
        },
      }

      if (config.scanType === "repository") {
        requestBody.repositoryUrl = config.repositoryUrl
      } else {
        requestBody.url = config.url
      }

      // Make API call to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error("Failed to start scan")
      }

      const scanData = await response.json()

      // Navigate to scan results page with appropriate parameters
      const params = new URLSearchParams({
        scanId: scanData.scanId,
        scanType: config.scanType,
      })

      if (config.url) {
        params.set("url", config.url)
      }
      if (config.repositoryUrl) {
        params.set("repositoryUrl", config.repositoryUrl)
      }

      router.push(`/scan?${params.toString()}`)
    } catch (error) {
      console.error("Error starting scan:", error)
      let errorMessage = "Error starting scan. Please try again."

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
            Advanced AI-powered security scanner with deep HTML & JavaScript file analysis that detects exposed API
            keys, secrets, and vulnerabilities in your web applications instantly.
          </p>

          {/* Enhanced Scan Interface */}
          <ScanTypeSelector onScanStart={handleScanStart} isLoading={isLoading} />
          {/* Small note to reflect wireframe gating */}
          <p className="text-sm text-gray-500 mt-3">GitHub Scan and Deep Scan require login.</p>
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
                  Advanced HTML & JavaScript file scanning with CDN filtering, caching, and 70+ security patterns for
                  comprehensive threat detection
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
