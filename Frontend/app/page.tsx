"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertTriangle, Wrench, Search } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)
    try {
      // Make API call to backend
      const response = await fetch('http://localhost:3001/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error('Failed to scan website')
      }

      const scanData = await response.json()
      
      // Navigate to scan results page with URL parameter and scan ID
      router.push(`/scan?url=${encodeURIComponent(url)}&scanId=${scanData.scanId}`)
    } catch (error) {
      console.error('Error scanning website:', error)
      let errorMessage = 'Error scanning website. Please try again.'
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to the scanner service. Please make sure the backend is running on port 3001.'
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
              <Link href="/scan">
                <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-800">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            ThreatPeek - Snitch on Bad Vibe-Code
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Scan your deployed web app for exposed API keys and secrets
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
              <Button
                type="submit"
                disabled={isLoading || !url}
                className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {isLoading ? "Scanning..." : "Scan my site 🔍"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Powerful Security Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive scanning and reporting to keep your applications secure
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* API Key Detection Card */}
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">API Key Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center text-lg leading-relaxed">
                  Advanced pattern matching to identify exposed API keys, tokens, and credentials in your web
                  applications
                </CardDescription>
              </CardContent>
            </Card>

            {/* Severity Reports Card */}
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Severity Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center text-lg leading-relaxed">
                  Detailed risk assessment with severity levels to help you prioritize security fixes based on impact
                </CardDescription>
              </CardContent>
            </Card>

            {/* Fix Suggestions Card */}
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100 hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mb-4">
                  <Wrench className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Fix Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center text-lg leading-relaxed">
                  Actionable recommendations and best practices to secure your applications and prevent future exposures
                </CardDescription>
              </CardContent>
            </Card>
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
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} ThreatPeek. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
