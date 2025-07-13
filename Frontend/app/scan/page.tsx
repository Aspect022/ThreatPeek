"use client"

import { Button } from "@/components/ui/button"
import {
  Shield,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Sparkles,
  TrendingUp,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"

type ScanResult = {
  issue: string
  matches?: string[] // just an array of strings
  severity: string
  file?: string
}

type ScanData = {
  results: ScanResult[]
  filesScanned?: number
  filesSkipped?: number
  jsFilesFound?: number
  jsFilesScanned?: number
  scanType?: string
  timestamp?: string
}

function ScanResultsContent() {
  const searchParams = useSearchParams()
  const scannedUrl = searchParams.get("url") || "https://example.com"
  const scanId = searchParams.get("scanId")
  const [scanData, setScanData] = useState<ScanData>({ results: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    const fetchScanResults = async () => {
      if (!scanId) {
        setError("No scan ID provided")
        setIsLoading(false)
        return
      }

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!
        const response = await fetch(`${apiBase}/scan/${scanId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch scan results")
        }
        const data = await response.json()
        setScanData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
      }
    }

    fetchScanResults()
  }, [scanId])

  // AI Summary using Gemini API
  useEffect(() => {
    if (!scanData || !scanData.results) return

    const generateAiSummary = async () => {
      setAiLoading(true)
      setAiError(null)

      try {
        console.log("Requesting AI summary for scan data:", scanData)

        const response = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: scanData }),
        })

        console.log("AI summary response status:", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("AI summary error response:", errorText)
          throw new Error(`Failed to generate AI summary: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log("AI summary response data:", data)

        if (data.error) {
          throw new Error(data.error)
        }

        setAiSummary(data.summary)
      } catch (err) {
        console.error("AI Summary Error:", err)
        setAiError(err instanceof Error ? err.message : "Failed to generate summary")
        // Fallback to basic summary
        const totalIssues = scanData.results.length
        const criticalIssues = scanData.results.filter((r: ScanResult) => r.severity === "critical").length
        const highIssues = scanData.results.filter((r: ScanResult) => r.severity === "high").length

        let fallbackSummary = `Security Analysis Summary:\n\n`
        if (criticalIssues > 0) {
          fallbackSummary += `🚨 CRITICAL: Found ${criticalIssues} critical security issue${criticalIssues > 1 ? "s" : ""} requiring immediate attention.\n\n`
        }
        if (highIssues > 0) {
          fallbackSummary += `⚠️ HIGH RISK: Detected ${highIssues} high-risk vulnerability${highIssues > 1 ? "ies" : "y"}.\n\n`
        }
        fallbackSummary += `📊 RECOMMENDATION: Address critical and high-severity issues first.`
        setAiSummary(fallbackSummary)
      } finally {
        setAiLoading(false)
      }
    }

    generateAiSummary()
  }, [scanData])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showDropdown])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading scan results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Process scan results to match the expected format
  const processedResults = scanData.results.map((result, index) => ({
    id: index + 1,
    issue: result.issue,
    pattern: result.matches?.[0] || "Pattern matched",
    severity: result.severity.charAt(0).toUpperCase() + result.severity.slice(1),
    file: result.file,
    matchCount: result.matches?.length || 1,
  }))

  // Calculate severity counts
  const criticalCount = processedResults.filter((r) => r.severity === "Critical").length
  const highCount = processedResults.filter((r) => r.severity === "High").length
  const mediumCount = processedResults.filter((r) => r.severity === "Medium").length
  const lowCount = processedResults.filter((r) => r.severity === "Low").length

  const scanResults = {
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    issues: processedResults,
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-800 border border-red-200"
      case "high":
        return "bg-red-100 text-red-800 border border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case "medium":
        return <Info className="h-4 w-4 text-yellow-600" />
      case "low":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      default:
        return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  const totalIssues = scanResults.criticalCount + scanResults.highCount + scanResults.mediumCount + scanResults.lowCount

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/" className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-gray-900 text-xl font-bold">ThreatPeek</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Security Scan Results</h1>
          <p className="text-gray-600 mb-4">Scanned: {scannedUrl}</p>

          {/* Scan Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm font-medium text-blue-800">
                {scanData.scanType === 'deep' ? 'Deep Scan' : 'Standard Scan'} Completed
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Files Scanned:</span>
                <span className="font-medium ml-1">{scanData.filesScanned || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">JS Files Found:</span>
                <span className="font-medium ml-1">{scanData.jsFilesFound || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">JS Files Scanned:</span>
                <span className="font-medium ml-1">{scanData.jsFilesScanned || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Files Skipped:</span>
                <span className="font-medium ml-1">{scanData.filesSkipped || 0}</span>
              </div>
            </div>
            {scanData.timestamp && (
              <div className="text-xs text-gray-500 mt-2">
                Scan completed: {new Date(scanData.timestamp).toLocaleString()}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{scanResults.criticalCount}</p>
                  <p className="text-sm text-gray-600">Critical</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-orange-600">{scanResults.highCount}</p>
                  <p className="text-sm text-gray-600">High</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <Info className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{scanResults.mediumCount}</p>
                  <p className="text-sm text-gray-600">Medium</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{scanResults.lowCount}</p>
                  <p className="text-sm text-gray-600">Low</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Security Analysis - Enhanced UI */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-lg mr-4">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI Security Analysis</h2>
                  <p className="text-purple-100 text-sm">Powered by advanced threat intelligence</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {aiLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center text-purple-600">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3"></div>
                    <span className="text-lg font-medium">Analyzing security patterns with AI...</span>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-red-800 font-medium">Analysis Error</span>
                  </div>
                  <p className="text-red-700 mt-1">{aiError}</p>
                </div>
              )}

              {aiSummary && (
                <div className="space-y-4">
                  {/* Analysis Content */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center mb-4">
                      <TrendingUp className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="font-semibold text-gray-900">Security Assessment</span>
                    </div>
                    <div className="prose prose-gray max-w-none">
                      <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans text-sm">
                        {aiSummary}
                      </pre>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Risk Level</p>
                          <p className="text-lg font-bold text-gray-900">
                            {totalIssues === 0
                              ? "Low"
                              : criticalCount > 0
                                ? "Critical"
                                : highCount > 0
                                  ? "High"
                                  : "Medium"}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-purple-600" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Issues</p>
                          <p className="text-lg font-bold text-gray-900">{totalIssues}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Scan Status</p>
                          <p className="text-lg font-bold text-green-600">Complete</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Findings</h3>
            <p className="text-sm text-gray-600">Complete list of security issues found during the scan</p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pattern Matched
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scanResults.issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{issue.issue}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded max-w-md truncate">
                      {issue.pattern}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getSeverityIcon(issue.severity)}
                      <span
                        className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityBadge(issue.severity)}`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Download Report */}
        <div className="mt-8 flex justify-center">
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center"
              onClick={() => setShowDropdown(!showDropdown)}
              type="button"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Report
              <svg
                className={`ml-2 w-4 h-4 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </Button>

            {showDropdown && (
              <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 border border-gray-200 z-50">
                <div className="py-2">
                  <button
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                    onClick={() => {
                      // JSON download
                      const dataStr = JSON.stringify(scanData, null, 2)
                      const blob = new Blob([dataStr], { type: "application/json" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = `ThreatPeek-report-${scanId || "scan"}.json`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      setShowDropdown(false)
                    }}
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <div className="font-medium">Download as JSON</div>
                      <div className="text-xs text-gray-500">Raw data format</div>
                    </div>
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                    onClick={() => {
                      // Simple text report download instead of PDF to avoid jsPDF dependency
                      let report = `ThreatPeek SECURITY SCAN REPORT\n`
                      report += `${"=".repeat(40)}\n\n`
                      report += `Scanned URL: ${scannedUrl}\n`
                      report += `Scan Date: ${new Date().toLocaleDateString()}\n`
                      report += `Total Issues: ${totalIssues}\n\n`

                      report += `SUMMARY:\n`
                      report += `- Critical: ${scanResults.criticalCount}\n`
                      report += `- High: ${scanResults.highCount}\n`
                      report += `- Medium: ${scanResults.mediumCount}\n`
                      report += `- Low: ${scanResults.lowCount}\n\n`

                      if (aiSummary) {
                        report += `AI ANALYSIS:\n`
                        report += `${"-".repeat(20)}\n`
                        report += `${aiSummary}\n\n`
                      }

                      report += `DETAILED FINDINGS:\n`
                      report += `${"-".repeat(20)}\n\n`

                      scanResults.issues.forEach((issue, index) => {
                        report += `${index + 1}. ${issue.issue}\n`
                        report += `   Severity: ${issue.severity}\n`
                        report += `   Pattern: ${issue.pattern}\n`
                        report += `   File: ${issue.file || "N/A"}\n\n`
                      })

                      const blob = new Blob([report], { type: "text/plain" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = `ThreatPeek-report-${scanId || "scan"}.txt`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      setShowDropdown(false)
                    }}
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <div className="font-medium">Download as Text Report</div>
                      <div className="text-xs text-gray-500">Formatted summary with AI analysis</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ScanResults() {
  return <ScanResultsContent />
}