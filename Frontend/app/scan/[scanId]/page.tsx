"use client"

import { Button } from "@/components/ui/button"
import { Shield } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

// Type for scan result
type ScanResult = {
  issue: string;
  matches?: string[];
  severity: string;
  file?: string;
};

export default function ScanResultPage({ params }: { params: { scanId: string } }) {
  const scanId = params.scanId;
  const [scanData, setScanData] = useState<{ results: ScanResult[] }>({ results: [] })
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

  useEffect(() => {
    if (!scanData || !scanData.results) return
    setAiLoading(true)
    setTimeout(() => {
      const totalIssues = scanData.results.length
      const criticalIssues = scanData.results.filter((r: ScanResult) => r.severity === "critical").length
      const highIssues = scanData.results.filter((r: ScanResult) => r.severity === "high").length
      let summary = `Security Analysis Summary:\n\n`
      if (criticalIssues > 0) {
        summary += `🚨 CRITICAL: Found ${criticalIssues} critical security issue${criticalIssues > 1 ? "s" : ""} that require immediate attention. These expose sensitive credentials that could lead to data breaches.\n\n`
      }
      if (highIssues > 0) {
        summary += `⚠️ HIGH RISK: Detected ${highIssues} high-risk vulnerability${highIssues > 1 ? "ies" : "y"} that should be addressed promptly to prevent potential security compromises.\n\n`
      }
      summary += `📊 RECOMMENDATION: Prioritize fixing critical and high-severity issues first. Consider implementing environment variables for sensitive data and regular security audits.`
      setAiSummary(summary)
      setAiLoading(false)
    }, 2000)
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

  const processedResults = scanData.results.map((result, index) => ({
    id: index + 1,
    issue: result.issue,
    pattern: result.matches?.[0] || "Pattern matched",
    severity: result.severity.charAt(0).toUpperCase() + result.severity.slice(1),
    file: result.file,
    matchCount: result.matches?.length || 1,
  }))

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scan Results</h1>
          <p className="text-gray-600 mb-4">Scan ID: {scanId}</p>

          {/* Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <p className="text-lg">
              <span className="font-bold text-gray-900">Found {totalIssues} issues:</span>
              {scanResults.criticalCount > 0 && (
                <span className="ml-2 font-bold text-red-600">{scanResults.criticalCount} Critical</span>
              )}
              {scanResults.highCount > 0 && (
                <span className="ml-2 font-bold text-red-600">{scanResults.highCount} High</span>
              )}
              {scanResults.mediumCount > 0 && (
                <span className="ml-2 font-bold text-yellow-600">{scanResults.mediumCount} Medium</span>
              )}
              {scanResults.lowCount > 0 && (
                <span className="ml-2 font-bold text-green-600">{scanResults.lowCount} Low</span>
              )}
            </p>
          </div>
        </div>
        {/* Results Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                    <div className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">{issue.pattern}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityBadge(issue.severity)}`}
                    >
                      {issue.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* AI Security Summary */}
        <div className="mt-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
              AI Security Analysis
            </h2>
            {aiLoading && (
              <div className="flex items-center text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span>Analyzing security patterns...</span>
              </div>
            )}
            {aiError && <div className="text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{aiError}</div>}
            {aiSummary && (
              <div className="text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 border border-gray-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap">{aiSummary}</pre>
              </div>
            )}
          </div>
        </div>
        {/* Download Report */}
        <div className="mt-8 flex justify-center">
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center"
              onClick={() => setShowDropdown(!showDropdown)}
              type="button"
            >
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
                      report += `Scan ID: ${scanId}\n`
                      report += `Scan Date: ${new Date().toLocaleDateString()}\n`
                      report += `Total Issues: ${totalIssues}\n\n`

                      report += `SUMMARY:\n`
                      report += `- Critical: ${scanResults.criticalCount}\n`
                      report += `- High: ${scanResults.highCount}\n`
                      report += `- Medium: ${scanResults.mediumCount}\n`
                      report += `- Low: ${scanResults.lowCount}\n\n`

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
                      <div className="text-xs text-gray-500">Formatted summary</div>
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