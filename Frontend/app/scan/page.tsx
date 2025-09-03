"use client";

import { Button } from "@/components/ui/button";
import {
  EnhancedResultsDisplay,
  type Finding,
  type ScanResultCategory,
} from "@/components/ui/enhanced-results-display";
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
  BookOpenText,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  normalizeScanData,
  extractAllFindings,
  convertToLegacyFormat,
  type EnhancedScanData,
} from "@/lib/scan-utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type ScanResult = {
  issue: string;
  matches?: string[]; // just an array of strings
  severity: string;
  file?: string;
};

type ScanData = {
  results: ScanResult[];
  status?: string;
  progress?: {
    current: number;
    total: number;
    phases?: Array<{
      type: string;
      status: string;
      progress: number;
    }>;
  };
  filesScanned?: number;
  filesSkipped?: number;
  jsFilesFound?: number;
  jsFilesScanned?: number;
  scanType?: string;
  timestamp?: string;
};

// Transform legacy scan data to enhanced format
function transformScanDataToEnhanced(scanData: any): ScanResultCategory[] {
  const normalizedData = normalizeScanData(scanData);

  // Map categories to the expected enum values
  return normalizedData.results.categories.map((category: any) => ({
    ...category,
    category: mapCategoryToEnum(category.category),
  }));
}

// Helper function to map category strings to the expected enum values
function mapCategoryToEnum(
  category: string
): "secrets" | "files" | "headers" | "owasp" | "misconfig" {
  switch (category.toLowerCase()) {
    case "secrets":
    case "secret":
      return "secrets";
    case "files":
    case "file":
    case "exposed files":
      return "files";
    case "headers":
    case "header":
    case "security headers":
      return "headers";
    case "owasp":
    case "vulnerabilities":
    case "vulnerability":
      return "owasp";
    case "misconfig":
    case "misconfiguration":
    case "configuration":
      return "misconfig";
    default:
      return "misconfig"; // Default fallback
  }
}

function ScanResultsContent() {
  const searchParams = useSearchParams();
  const scannedUrl = searchParams.get("url") || "https://example.com";
  const scanId = searchParams.get("scanId");
  const [scanData, setScanData] = useState<ScanData>({ results: [] });
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
    let pollInterval: NodeJS.Timeout;

    const fetchScanResults = async () => {
      if (!scanId) {
        setError("No scan ID provided");
        setIsLoading(false);
        return;
      }

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
        const response = await fetch(
          `${apiBase}/enhanced-scan/${scanId}/results`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch scan results");
        }
        const data = await response.json();
        // console.log("Received scan data:", data); // Removed for production

        // Check if scan is still running
        if (data.status === "running" || data.status === "initializing") {
          // console.log(`Scan still ${data.status}, continuing to poll...`); // Removed for production
          setScanData(data); // Update with current progress
          // Continue polling every 2 seconds
          pollInterval = setTimeout(fetchScanResults, 2000);
        } else {
          // Scan is complete (completed, failed, partial, timeout)
          // console.log(`Scan finished with status: ${data.status}`); // Removed for production
          setScanData(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error fetching scan results:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    };

    fetchScanResults();

    // Cleanup function to clear polling interval
    return () => {
      if (pollInterval) {
        clearTimeout(pollInterval);
      }
    };
  }, [scanId]);

  // AI Summary using Gemini API
  useEffect(() => {
    if (!scanData || !scanData.results) return;

    const generateAiSummary = async () => {
      setAiLoading(true);
      setAiError(null);

      try {
        // console.log("Requesting AI summary for scan data:", scanData); // Removed for production

        const response = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: scanData }),
        });

        // console.log("AI summary response status:", response.status); // Removed for production

        if (!response.ok) {
          const errorText = await response.text();
          console.error("AI summary error response:", errorText);
          throw new Error(
            `Failed to generate AI summary: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        // console.log("AI summary response data:", data); // Removed for production

        if (data.error) {
          throw new Error(data.error);
        }

        setAiSummary(data.summary);
      } catch (err) {
        console.error("AI Summary Error:", err);
        setAiError(
          err instanceof Error ? err.message : "Failed to generate summary"
        );
        // Fallback to basic summary using normalized data
        const normalizedData = normalizeScanData(scanData);
        const allFindings = extractAllFindings(normalizedData);
        const totalIssues = allFindings.length;
        const criticalIssues = allFindings.filter(
          (f: any) => f.severity === "critical"
        ).length;
        const highIssues = allFindings.filter(
          (f: any) => f.severity === "high"
        ).length;

        let fallbackSummary = `Security Analysis Summary:\n\n`;
        if (criticalIssues > 0) {
          fallbackSummary += `🚨 CRITICAL: Found ${criticalIssues} critical security issue${
            criticalIssues > 1 ? "s" : ""
          } requiring immediate attention.\n\n`;
        }
        if (highIssues > 0) {
          fallbackSummary += `⚠️ HIGH RISK: Detected ${highIssues} high-risk vulnerability${
            highIssues > 1 ? "ies" : "y"
          }.\n\n`;
        }
        fallbackSummary += `📊 RECOMMENDATION: Address critical and high-severity issues first.`;
        setAiSummary(fallbackSummary);
      } finally {
        setAiLoading(false);
      }
    };

    generateAiSummary();
  }, [scanData]);

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

  const generatePDF = async () => {
    try {
      // Create a temporary div to render the report content
      const reportDiv = document.createElement("div");
      reportDiv.style.position = "absolute";
      reportDiv.style.left = "-9999px";
      reportDiv.style.top = "0";
      reportDiv.style.width = "800px";
      reportDiv.style.padding = "20px";
      reportDiv.style.fontFamily = "Arial, sans-serif";
      reportDiv.style.fontSize = "12px";
      reportDiv.style.backgroundColor = "white";
      reportDiv.style.color = "black";

      // Generate the report content
      let reportHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0; font-size: 24px;">ThreatPeek Security Scan Report</h1>
          <p style="color: #6b7280; margin: 5px 0;">Comprehensive Security Analysis</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
          <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 18px;">Scan Information</h2>
          <p style="margin: 5px 0;"><strong>Scanned URL:</strong> ${scannedUrl}</p>
          <p style="margin: 5px 0;"><strong>Scan Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Total Issues:</strong> ${totalIssues}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">Summary</h2>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div style="padding: 10px; background-color: #dc2626; color: white; text-align: center; border-radius: 4px;">
              <div style="font-size: 20px; font-weight: bold;">${criticalCount}</div>
              <div style="font-size: 10px;">Critical</div>
            </div>
            <div style="padding: 10px; background-color: #ea580c; color: white; text-align: center; border-radius: 4px;">
              <div style="font-size: 20px; font-weight: bold;">${highCount}</div>
              <div style="font-size: 10px;">High</div>
            </div>
            <div style="padding: 10px; background-color: #ca8a04; color: white; text-align: center; border-radius: 4px;">
              <div style="font-size: 20px; font-weight: bold;">${mediumCount}</div>
              <div style="font-size: 10px;">Medium</div>
            </div>
            <div style="padding: 10px; background-color: #16a34a; color: white; text-align: center; border-radius: 4px;">
              <div style="font-size: 20px; font-weight: bold;">${lowCount}</div>
              <div style="font-size: 10px;">Low</div>
            </div>
          </div>
        </div>
      `;

      if (aiSummary) {
        reportHTML += `
          <div style="margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 18px;">AI Analysis</h2>
            <div style="padding: 15px; background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <pre style="margin: 0; white-space: pre-wrap; font-family: inherit;">${aiSummary}</pre>
            </div>
          </div>
        `;
      }

      reportHTML += `
        <div style="margin-bottom: 20px;">
          <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">Detailed Findings</h2>
      `;

      allFindings.forEach((finding, index) => {
        const severityColor =
          finding.severity === "critical"
            ? "#dc2626"
            : finding.severity === "high"
            ? "#ea580c"
            : finding.severity === "medium"
            ? "#ca8a04"
            : "#16a34a";

        reportHTML += `
          <div style="margin-bottom: 15px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span style="background-color: ${severityColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 10px;">
                ${finding.severity.toUpperCase()}
              </span>
              <h3 style="margin: 0; font-size: 14px; color: #1f2937;">${
                index + 1
              }. ${finding.title}</h3>
            </div>
            <div style="font-size: 11px; color: #6b7280;">
              <p style="margin: 5px 0;"><strong>Category:</strong> ${
                finding.category
              }</p>
              <p style="margin: 5px 0;"><strong>Pattern:</strong> ${
                finding.evidence.pattern || "N/A"
              }</p>
              <p style="margin: 5px 0;"><strong>File:</strong> ${
                finding.location.file || finding.location.url || "N/A"
              }</p>
              <p style="margin: 5px 0;"><strong>Confidence:</strong> ${Math.round(
                finding.confidence * 100
              )}%</p>
            </div>
          </div>
        `;
      });

      reportHTML += `</div>`;

      reportDiv.innerHTML = reportHTML;
      document.body.appendChild(reportDiv);

      // Convert to canvas and then to PDF
      const canvas = await html2canvas(reportDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(reportDiv);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`ThreatPeek-report-${scanId || "scan"}.pdf`);
      setShowDropdown(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600 mb-2">
            {scanData.status === "running"
              ? "Scanning in progress..."
              : "Loading scan results..."}
          </p>
          {scanData.status === "running" && scanData.progress && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (scanData.progress.current / scanData.progress.total) * 100
                  }%`,
                }}
              ></div>
            </div>
          )}
          {scanData.status === "running" && (
            <p className="text-sm text-gray-500">
              Please wait while we analyze your target for security
              vulnerabilities...
            </p>
          )}
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

  // Transform scan data to enhanced format
  const enhancedResults = transformScanDataToEnhanced(scanData);

  // Calculate severity counts for backward compatibility
  const allFindings = enhancedResults.flatMap((category) => category.findings);
  const criticalCount = allFindings.filter(
    (f) => f.severity === "critical"
  ).length;
  const highCount = allFindings.filter((f) => f.severity === "high").length;
  const mediumCount = allFindings.filter((f) => f.severity === "medium").length;
  const lowCount = allFindings.filter((f) => f.severity === "low").length;

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

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "medium":
        return <Info className="h-4 w-4 text-yellow-600" />;
      case "low":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const totalIssues = criticalCount + highCount + mediumCount + lowCount;

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
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  Security Scan Results
                </h1>
                <p className="text-blue-100 text-lg mb-4">
                  Comprehensive security analysis for your application
                </p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    <span className="text-sm">Scanned: {scannedUrl}</span>
                  </div>
                  {scanData.timestamp && (
                    <div className="flex items-center">
                      <span className="text-sm text-blue-100">
                        Completed:{" "}
                        {new Date(scanData.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">{totalIssues}</div>
                <div className="text-blue-100 text-sm">Total Issues Found</div>
              </div>
            </div>
          </div>

          {/* Scan Information */}
          <div
            className={`border rounded-lg p-4 mb-6 ${
              scanData.status === "running"
                ? "bg-yellow-50 border-yellow-200"
                : scanData.status === "completed"
                ? "bg-green-50 border-green-200"
                : scanData.status === "partial"
                ? "bg-orange-50 border-orange-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-center mb-2">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  scanData.status === "running"
                    ? "bg-yellow-500 animate-pulse"
                    : scanData.status === "completed"
                    ? "bg-green-500"
                    : scanData.status === "partial"
                    ? "bg-orange-500"
                    : "bg-blue-500"
                }`}
              ></div>
              <span
                className={`text-sm font-medium ${
                  scanData.status === "running"
                    ? "text-yellow-800"
                    : scanData.status === "completed"
                    ? "text-green-800"
                    : scanData.status === "partial"
                    ? "text-orange-800"
                    : "text-blue-800"
                }`}
              >
                {scanData.status === "running"
                  ? "Scan In Progress..."
                  : scanData.status === "completed"
                  ? `${
                      scanData.scanType === "deep"
                        ? "Deep Scan"
                        : "Standard Scan"
                    } Completed`
                  : scanData.status === "partial"
                  ? "Scan Completed with Partial Results"
                  : `${
                      scanData.scanType === "deep"
                        ? "Deep Scan"
                        : "Standard Scan"
                    } Completed`}
              </span>
            </div>
            {scanData.timestamp && (
              <div className="text-xs text-gray-500 mt-2">
                Scan completed: {new Date(scanData.timestamp).toLocaleString()}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-red-600 mb-1">
                    {criticalCount}
                  </p>
                  <p className="text-sm font-medium text-red-700">
                    Critical Issues
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Immediate action required
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-orange-600 mb-1">
                    {highCount}
                  </p>
                  <p className="text-sm font-medium text-orange-700">
                    High Risk
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    Address promptly
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-yellow-600 mb-1">
                    {mediumCount}
                  </p>
                  <p className="text-sm font-medium text-yellow-700">
                    Medium Risk
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Monitor closely
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center">
                  <Info className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-green-600 mb-1">
                    {lowCount}
                  </p>
                  <p className="text-sm font-medium text-green-700">Low Risk</p>
                  <p className="text-xs text-green-600 mt-1">Minor concerns</p>
                </div>
                <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
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
                  <h2 className="text-xl font-bold text-white">
                    AI Security Analysis
                  </h2>
                  <p className="text-purple-100 text-sm">
                    Powered by advanced threat intelligence
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {aiLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center text-purple-600">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3"></div>
                    <span className="text-lg font-medium">
                      Analyzing security patterns with AI...
                    </span>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-red-800 font-medium">
                      Analysis Error
                    </span>
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
                      <span className="font-semibold text-gray-900">
                        Security Assessment
                      </span>
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
                          <p className="text-lg font-bold text-gray-900">
                            {totalIssues}
                          </p>
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
                          <p
                            className={`text-lg font-bold ${
                              scanData.status === "running"
                                ? "text-yellow-600"
                                : scanData.status === "completed"
                                ? "text-green-600"
                                : scanData.status === "partial"
                                ? "text-orange-600"
                                : "text-green-600"
                            }`}
                          >
                            {scanData.status === "running"
                              ? "Running..."
                              : scanData.status === "completed"
                              ? "Complete"
                              : scanData.status === "partial"
                              ? "Partial"
                              : "Complete"}
                          </p>
                        </div>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            scanData.status === "running"
                              ? "bg-yellow-100"
                              : scanData.status === "completed"
                              ? "bg-green-100"
                              : scanData.status === "partial"
                              ? "bg-orange-100"
                              : "bg-green-100"
                          }`}
                        >
                          {scanData.status === "running" ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                          ) : (
                            <CheckCircle
                              className={`h-4 w-4 ${
                                scanData.status === "partial"
                                  ? "text-orange-600"
                                  : "text-green-600"
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guide and Explain Buttons */}
        {aiSummary && (
          <div className="mb-8 space-y-6">
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

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-lg mr-4">
                    <BookOpenText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      AI-Powered Assistance
                    </h2>
                    <p className="text-emerald-100 text-sm">
                      Get personalized explanations and step-by-step guidance
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Explain Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <BookOpenText className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Explain Security Issues
                        </h3>
                        <p className="text-sm text-gray-600">
                          Get simple explanations of what each issue means
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={callExplain}
                      disabled={!user || explainLoading}
                      className={`px-6 py-2 ${
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
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans text-sm">
                          {explainText}
                        </pre>
                      </div>
                    </div>
                  )}
                  {!user && (
                    <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> You must be logged in to use
                      this feature.
                    </p>
                  )}
                </div>

                {/* Guide Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Get Remediation Guide
                        </h3>
                        <p className="text-sm text-gray-600">
                          Step-by-step instructions to fix security issues
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={callGuide}
                      disabled={!user || guideLoading}
                      className={`px-6 py-2 ${
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
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans text-sm">
                          {guideText}
                        </pre>
                      </div>
                    </div>
                  )}
                  {!user && (
                    <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> You must be logged in to use
                      this feature.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Running Scan Notice */}
        {scanData.status === "running" && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Scan in Progress
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Results will update automatically as the scan progresses.
                  {scanData.progress &&
                    ` Progress: ${scanData.progress.current}/${scanData.progress.total} phases completed.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Results Display */}
        <EnhancedResultsDisplay
          results={enhancedResults}
          isLoading={scanData.status === "running"}
        />

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
                      a.download = `ThreatPeek-report-${scanId || "scan"}.json`;
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
                      report += `Scanned URL: ${scannedUrl}\n`;
                      report += `Scan Date: ${new Date().toLocaleDateString()}\n`;
                      report += `Total Issues: ${totalIssues}\n\n`;

                      report += `SUMMARY:\n`;
                      report += `- Critical: ${criticalCount}\n`;
                      report += `- High: ${highCount}\n`;
                      report += `- Medium: ${mediumCount}\n`;
                      report += `- Low: ${lowCount}\n\n`;

                      if (aiSummary) {
                        report += `AI ANALYSIS:\n`;
                        report += `${"-".repeat(20)}\n`;
                        report += `${aiSummary}\n\n`;
                      }

                      report += `DETAILED FINDINGS:\n`;
                      report += `${"-".repeat(20)}\n\n`;

                      allFindings.forEach((finding, index) => {
                        report += `${index + 1}. ${finding.title}\n`;
                        report += `   Severity: ${
                          finding.severity.charAt(0).toUpperCase() +
                          finding.severity.slice(1)
                        }\n`;
                        report += `   Category: ${finding.category}\n`;
                        report += `   Pattern: ${
                          finding.evidence.pattern || "N/A"
                        }\n`;
                        report += `   File: ${
                          finding.location.file || finding.location.url || "N/A"
                        }\n`;
                        report += `   Confidence: ${Math.round(
                          finding.confidence * 100
                        )}%\n\n`;
                      });

                      const blob = new Blob([report], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ThreatPeek-report-${scanId || "scan"}.txt`;
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
                      <div className="font-medium">Download as Text Report</div>
                      <div className="text-xs text-gray-500">
                        Formatted summary with AI analysis
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center"
                    onClick={generatePDF}
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <div>
                      <div className="font-medium">Download as PDF</div>
                      <div className="text-xs text-gray-500">
                        Professional formatted report
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

export default function ScanResults() {
  return <ScanResultsContent />;
}
