"use client";

import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { normalizeScanData, extractAllFindings } from "@/lib/scan-utils";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, BookOpenText, Info, Lock } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

type ScanResult = {
  issue: string;
  matches?: string[];
  severity: string;
  file?: string;
};

type ScanStatus = "running" | "completed" | "failed" | "pending";

type ScanData = {
  status: ScanStatus;
  results?: ScanResult[];
  error?: string;
};

export default function ScanResultPage({
  params,
}: {
  params: { scanId: string };
}) {
  const scanId = params.scanId;
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const [explainLoading, setExplainLoading] = useState(false);
  const [guideLoading, setGuideLoading] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [guideText, setGuideText] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      setError("No scan ID provided");
      setIsLoading(false);
      return;
    }

    let interval: NodeJS.Timeout;

    const fetchScanResults = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
        const response = await fetch(
          `${apiBase}/enhanced-scan/${scanId}/results`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch scan results");
        }

        const data = await response.json();

        // Handle different response formats from backend
        if (data.status === "running") {
          setScanData({ status: "running" });
        } else if (data.status === "completed") {
          let results: ScanResult[] = [];

          if (Array.isArray(data.results)) {
            results = data.results;
          } else if (Array.isArray(data.findings)) {
            results = data.findings;
          } else if (Array.isArray(data)) {
            results = data;
          }

          setScanData({
            status: "completed",
            results,
          });

          // Stop polling when scan is completed
          clearInterval(interval);
        } else if (data.status === "failed") {
          setScanData({
            status: "failed",
            error: data.error || "Scan failed",
          });

          // Stop polling when scan fails
          clearInterval(interval);
        } else {
          // Fallback for unknown status
          setScanData({ status: "pending" });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        clearInterval(interval);
      } finally {
        setIsLoading(false);
      }
    };

    // Poll every 2 seconds until scan completes or fails
    interval = setInterval(fetchScanResults, 2000);
    fetchScanResults(); // First call immediately

    return () => clearInterval(interval);
  }, [scanId]);

  useEffect(() => {
    if (!scanData || scanData.status !== "completed" || !scanData.results)
      return;

    setAiLoading(true);
    setTimeout(() => {
      // Use the normalization utility
      const normalizedData = normalizeScanData({ results: scanData.results });
      const allFindings = extractAllFindings(normalizedData);

      const totalIssues = allFindings.length;
      const criticalIssues = allFindings.filter(
        (f: any) => f.severity === "critical"
      ).length;
      const highIssues = allFindings.filter(
        (f: any) => f.severity === "high"
      ).length;
      let summary = `Security Analysis Summary:\n\n`;
      if (criticalIssues > 0) {
        summary += `🚨 CRITICAL: Found ${criticalIssues} critical security issue${
          criticalIssues > 1 ? "s" : ""
        } that require immediate attention. These expose sensitive credentials that could lead to data breaches.\n\n`;
      }
      if (highIssues > 0) {
        summary += `⚠️ HIGH RISK: Detected ${highIssues} high-risk vulnerability${
          highIssues > 1 ? "ies" : "y"
        } that should be addressed promptly to prevent potential security compromises.\n\n`;
      }
      summary += `📊 RECOMMENDATION: Prioritize fixing critical and high-severity issues first. Consider implementing environment variables for sensitive data and regular security audits.`;
      setAiSummary(summary);
      setAiLoading(false);
    }, 2000);
  }, [scanData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const callExplain = async () => {
    if (!user) {
      setActionError("Please log in to use Explain.");
      return;
    }
    setActionError(null);
    setExplainLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: scanData }),
      });
      const data = await res.json();
      setExplainText(data.text || "No explanation available.");
    } catch (e: any) {
      setExplainText("Unable to generate explanation right now.");
    } finally {
      setExplainLoading(false);
    }
  };

  const callGuide = async () => {
    if (!user) {
      setActionError("Please log in to use the Guide.");
      return;
    }
    setActionError(null);
    setGuideLoading(true);
    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: scanData }),
      });
      const data = await res.json();
      setGuideText(data.text || "No guide available.");
    } catch (e: any) {
      setGuideText("Unable to generate a guide right now.");
    } finally {
      setGuideLoading(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading scan results...</p>
        </div>
      </div>
    );
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
    );
  }

  if (!scanData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">No scan data available</p>
        </div>
      </div>
    );
  }

  // Handle running scan status
  if (scanData.status === "running") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Simple Navbar */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link href="/" className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-gray-900 text-xl font-bold">
                  ThreatPeek
                </span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Scan in Progress
            </h1>
            <p className="text-xl text-gray-600 mb-4">Scan ID: {scanId}</p>
            <p className="text-gray-600">
              Your security scan is currently running. This may take a few
              minutes.
            </p>
            <div className="mt-8">
              <Button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Refresh Results
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle failed scan status
  if (scanData.status === "failed") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Simple Navbar */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link href="/" className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-gray-900 text-xl font-bold">
                  ThreatPeek
                </span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="h-32 w-32 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Scan Failed
            </h1>
            <p className="text-xl text-gray-600 mb-4">Scan ID: {scanId}</p>
            <p className="text-red-600 mb-8">
              {scanData.error ||
                "The scan encountered an error and could not complete."}
            </p>
            <div className="space-x-4">
              <Button
                onClick={() => window.history.back()}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded"
              >
                Go Back
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle completed scan with no results
  if (
    scanData.status === "completed" &&
    (!scanData.results || scanData.results.length === 0)
  ) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Simple Navbar */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link href="/" className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-gray-900 text-xl font-bold">
                  ThreatPeek
                </span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-green-600 mb-4">
              <svg
                className="h-32 w-32 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Scan Complete
            </h1>
            <p className="text-xl text-gray-600 mb-4">Scan ID: {scanId}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-green-800 mb-2">
                No Issues Found
              </h2>
              <p className="text-green-700">
                Great news! Your security scan completed successfully and no
                security vulnerabilities were detected.
              </p>
            </div>
            <div className="mt-8">
              <Link href="/">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle completed scan with results
  if (
    scanData.status === "completed" &&
    scanData.results &&
    scanData.results.length > 0
  ) {
    const processedResults = scanData.results.map((result, index) => ({
      id: index + 1,
      issue: result.issue,
      pattern: result.matches?.[0] || "Pattern matched",
      severity:
        result.severity.charAt(0).toUpperCase() + result.severity.slice(1),
      file: result.file,
      matchCount: result.matches?.length || 1,
    }));

    const criticalCount = processedResults.filter(
      (r) => r.severity === "Critical"
    ).length;
    const highCount = processedResults.filter(
      (r) => r.severity === "High"
    ).length;
    const mediumCount = processedResults.filter(
      (r) => r.severity === "Medium"
    ).length;
    const lowCount = processedResults.filter(
      (r) => r.severity === "Low"
    ).length;

    const scanResults = {
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      issues: processedResults,
    };

    const getSeverityBadge = (severity: string) => {
      switch (severity.toLowerCase()) {
        case "critical":
          return "bg-red-100 text-red-800 border border-red-200";
        case "high":
          return "bg-red-100 text-red-800 border border-red-200";
        case "medium":
          return "bg-yellow-100 text-yellow-800 border border-yellow-200";
        case "low":
          return "bg-green-100 text-green-800 border border-green-200";
        default:
          return "bg-gray-100 text-gray-800 border border-gray-200";
      }
    };

    const totalIssues =
      scanResults.criticalCount +
      scanResults.highCount +
      scanResults.mediumCount +
      scanResults.lowCount;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Simple Navbar */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link href="/" className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600 mr-2" />
                <span className="text-gray-900 text-xl font-bold">
                  ThreatPeek
                </span>
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Scan Results
            </h1>
            <p className="text-gray-600 mb-4">Scan ID: {scanId}</p>

            {/* Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
              <p className="text-lg">
                <span className="font-bold text-gray-900">
                  Found {totalIssues} issues:
                </span>
                {scanResults.criticalCount > 0 && (
                  <span className="ml-2 font-bold text-red-600">
                    {scanResults.criticalCount} Critical
                  </span>
                )}
                {scanResults.highCount > 0 && (
                  <span className="ml-2 font-bold text-red-600">
                    {scanResults.highCount} High
                  </span>
                )}
                {scanResults.mediumCount > 0 && (
                  <span className="ml-2 font-bold text-yellow-600">
                    {scanResults.mediumCount} Medium
                  </span>
                )}
                {scanResults.lowCount > 0 && (
                  <span className="ml-2 font-bold text-green-600">
                    {scanResults.lowCount} Low
                  </span>
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
                      <div className="text-sm font-medium text-gray-900">
                        {issue.issue}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                        {issue.pattern}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityBadge(
                          issue.severity
                        )}`}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 text-balance">
                  <span className="inline-flex h-2 w-2 rounded-full bg-blue-600" />
                  AI-powered Insights
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                    Critical {criticalCount}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                    High {highCount}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-800 border border-yellow-200">
                    Medium {mediumCount}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                    Low {lowCount}
                  </span>
                </div>
              </div>

              {aiLoading ? (
                <div className="flex items-center text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                  <span>Analyzing security patterns...</span>
                </div>
              ) : aiError ? (
                <div className="text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {aiError}
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 border border-gray-200 rounded-md p-4">
                      <pre className="whitespace-pre-wrap">
                        {aiSummary || "No insights available."}
                      </pre>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5" />
                      <p>
                        Start with Critical and High issues. Rotate exposed
                        secrets and move them to environment variables.
                      </p>
                    </div>
                    <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <p>
                        Re-scan after fixes to verify reductions in issue
                        counts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Guide and Explain Buttons */}
          <div className="mt-8 space-y-6">
            {actionError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                {actionError}{" "}
                {!user && (
                  <Link href="/login" className="underline font-medium">
                    Log in
                  </Link>
                )}
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpenText className="h-5 w-5 text-blue-600" />
                  Explain me!
                </h3>
                <Button
                  onClick={callExplain}
                  disabled={!user || explainLoading}
                  className={`px-4 ${
                    !user ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {explainLoading
                    ? "Generating..."
                    : user
                    ? "Generate"
                    : "Login required"}
                </Button>
              </div>
              {explainText && (
                <div className="text-gray-800 leading-relaxed bg-gray-50 border border-gray-200 rounded-md p-4 whitespace-pre-wrap">
                  {explainText}
                </div>
              )}
              {!user && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> You must be logged in to use this
                  feature.
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Guide me
                </h3>
                <Button
                  onClick={callGuide}
                  disabled={!user || guideLoading}
                  className={`px-4 ${
                    !user ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {guideLoading
                    ? "Preparing..."
                    : user
                    ? "Generate"
                    : "Login required"}
                </Button>
              </div>
              {guideText && (
                <div className="text-gray-800 leading-relaxed bg-gray-50 border border-gray-200 rounded-md p-4 whitespace-pre-wrap">
                  {guideText}
                </div>
              )}
              {!user && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> You must be logged in to use this
                  feature.
                </p>
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
                  className={`ml-2 w-4 h-4 transition-transform duration-200 ${
                    showDropdown ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>

              {showDropdown && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 border border-gray-200 z-50">
                  <div className="py-2">
                    <button
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                      onClick={() => {
                        // JSON download
                        const dataStr = JSON.stringify(scanData, null, 2);
                        const blob = new Blob([dataStr], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ThreatPeek-report-${
                          scanId || "scan"
                        }.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        setShowDropdown(false);
                      }}
                    >
                      <svg
                        className="w-4 h-4 mr-3 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <div className="font-medium">Download as JSON</div>
                        <div className="text-xs text-gray-500">
                          Raw data format
                        </div>
                      </div>
                    </button>

                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                      onClick={() => {
                        // Simple text report download instead of PDF to avoid jsPDF dependency
                        let report = `ThreatPeek SECURITY SCAN REPORT\n`;
                        report += `${"=".repeat(40)}\n\n`;
                        report += `Scan ID: ${scanId}\n`;
                        report += `Scan Date: ${new Date().toLocaleDateString()}\n`;
                        report += `Total Issues: ${totalIssues}\n\n`;

                        report += `SUMMARY:\n`;
                        report += `- Critical: ${scanResults.criticalCount}\n`;
                        report += `- High: ${scanResults.highCount}\n`;
                        report += `- Medium: ${scanResults.mediumCount}\n`;
                        report += `- Low: ${scanResults.lowCount}\n\n`;

                        report += `DETAILED FINDINGS:\n`;
                        report += `${"-".repeat(20)}\n\n`;

                        scanResults.issues.forEach((issue, index) => {
                          report += `${index + 1}. ${issue.issue}\n`;
                          report += `   Severity: ${issue.severity}\n`;
                          report += `   Pattern: ${issue.pattern}\n`;
                          report += `   File: ${issue.file || "N/A"}\n\n`;
                        });

                        const blob = new Blob([report], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ThreatPeek-report-${
                          scanId || "scan"
                        }.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        setShowDropdown(false);
                      }}
                    >
                      <svg
                        className="w-4 h-4 mr-3 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <div className="font-medium">
                          Download as Text Report
                        </div>
                        <div className="text-xs text-gray-500">
                          Formatted summary
                        </div>
                      </div>
                    </button>

                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                      onClick={() => {
                        // PDF report generation using jsPDF
                        const doc = new jsPDF();
                        
                        // Add title
                        doc.setFontSize(20);
                        doc.text("ThreatPeek Security Scan Report", 105, 20, { align: "center" });
                        
                        // Add scan info
                        doc.setFontSize(12);
                        doc.text(`Scan ID: ${scanId}`, 20, 35);
                        doc.text(`Scan Date: ${new Date().toLocaleDateString()}`, 20, 42);
                        doc.text(`Total Issues: ${totalIssues}`, 20, 49);
                        
                        // Add summary
                        doc.setFontSize(14);
                        doc.text("Summary", 20, 65);
                        doc.setFontSize(12);
                        doc.text(`Critical: ${scanResults.criticalCount}`, 25, 75);
                        doc.text(`High: ${scanResults.highCount}`, 25, 82);
                        doc.text(`Medium: ${scanResults.mediumCount}`, 25, 89);
                        doc.text(`Low: ${scanResults.lowCount}`, 25, 96);
                        
                        // Add detailed findings table
                        doc.setFontSize(14);
                        doc.text("Detailed Findings", 20, 110);
                        
                        // Prepare table data
                        const tableData = scanResults.issues.map((issue, index) => [
                          index + 1,
                          issue.issue,
                          issue.severity,
                          issue.pattern,
                          issue.file || "N/A"
                        ]);
                        
                        // Add table
                        (doc as any).autoTable({
                          head: [["#", "Issue", "Severity", "Pattern", "File"]],
                          body: tableData,
                          startY: 115,
                          styles: { fontSize: 8 },
                          headStyles: { fillColor: [66, 139, 202] },
                          alternateRowStyles: { fillColor: [245, 245, 245] }
                        });
                        
                        // Add AI summary if available
                        if (aiSummary) {
                          const finalY = (doc as any).lastAutoTable.finalY || 120;
                          doc.setFontSize(14);
                          doc.text("AI-Powered Insights", 20, finalY + 15);
                          doc.setFontSize(10);
                          
                          // Split summary into lines that fit the page
                          const splitText = doc.splitTextToSize(aiSummary, 170);
                          doc.text(splitText, 20, finalY + 25);
                        }
                        
                        // Save the PDF
                        doc.save(`ThreatPeek-report-${scanId || "scan"}.pdf`);
                        setShowDropdown(false);
                      }}
                    >
                      <svg
                        className="w-4 h-4 mr-3 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <div className="font-medium">
                          Download as PDF
                        </div>
                        <div className="text-xs text-gray-500">
                          Professional report
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unexpected states
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-xl text-gray-600">Unexpected scan state</p>
        <Button
          onClick={() => window.history.back()}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
        >
          Go Back
        </Button>
      </div>
    </div>
  );
}
