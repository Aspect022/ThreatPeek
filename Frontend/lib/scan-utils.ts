/**
 * Utility functions for handling scan data
 */

export interface ScanResult {
  issue: string;
  severity: string;
  file?: string;
  matches?: string[];
}

export interface Finding {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  title: string;
  description: string;
  category: string;
  location?: {
    file?: string;
    url?: string;
    line?: number;
  };
  evidence?: {
    pattern?: string;
    value?: string;
    context?: string;
  };
}

export interface ScanResultCategory {
  category: string;
  findings: Finding[];
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

export interface EnhancedScanData {
  scanId: string;
  status: string;
  target?: {
    type: string;
    value: string;
  };
  results: {
    categories: ScanResultCategory[];
    summary: {
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
    };
  };
  errors?: any[];
}

export interface LegacyScanData {
  scanId: string;
  status: string;
  results: ScanResult[];
}

/**
 * Normalize scan data to handle both legacy and enhanced formats
 */
export function normalizeScanData(data: any): EnhancedScanData {
  // console.log('Normalizing scan data:', JSON.stringify(data, null, 2)); // Removed for production
  
  // If it's already in enhanced format with proper structure, return as-is
  if (data.results && data.results.categories && Array.isArray(data.results.categories)) {
    // Transform backend findings to frontend format
    const transformedCategories = data.results.categories.map((category: any) => ({
      category: category.category,
      findings: (category.findings || []).map((finding: any, index: number) => ({
        id: finding.id || `finding-${category.category}-${index}`,
        type: finding.type || finding.title || 'Unknown Issue',
        severity: (finding.severity || 'medium').toLowerCase() as "critical" | "high" | "medium" | "low",
        confidence: finding.confidence || 0.8,
        title: finding.type || finding.title || 'Security Issue',
        description: finding.description || `Security issue detected: ${finding.type || 'Unknown'}`,
        category: finding.pattern?.category || category.category,
        location: {
          file: finding.file,
          url: finding.location?.url || (finding.file ? undefined : "Web Application"),
          line: finding.location?.line,
        },
        evidence: {
          pattern: finding.pattern?.id || finding.value || "Pattern matched",
          value: finding.value,
          context: finding.context ? `${finding.context.before || ''}${finding.value || ''}${finding.context.after || ''}` : undefined,
        },
      })),
      summary: category.summary || calculateCategorySummary(category.findings || [])
    }));

    return {
      scanId: data.scanId,
      status: data.status,
      target: data.target,
      results: {
        categories: transformedCategories,
        summary: data.results.summary || calculateOverallSummary(transformedCategories)
      },
      errors: data.errors || []
    };
  }

  // If it's legacy format, transform it
  if (data.results && Array.isArray(data.results)) {
    const legacyResults = data.results as ScanResult[];
    
    // Group findings by category
    const categoriesMap = new Map<string, Finding[]>();
    
    legacyResults.forEach((result, index) => {
      const category = determineCategory(result.issue);
      const finding: Finding = {
        id: `finding-${index}`,
        type: result.issue,
        severity: result.severity.toLowerCase() as "critical" | "high" | "medium" | "low",
        confidence: 0.8, // Default confidence for legacy data
        title: result.issue,
        description: `Security issue detected: ${result.issue}`,
        category,
        location: {
          file: result.file,
          url: result.file ? undefined : "Web Application",
        },
        evidence: {
          pattern: result.matches?.[0] || "Pattern matched",
        },
      };

      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, []);
      }
      categoriesMap.get(category)!.push(finding);
    });

    // Convert to categories array
    const categories: ScanResultCategory[] = Array.from(categoriesMap.entries()).map(([category, findings]) => ({
      category,
      findings,
      summary: calculateCategorySummary(findings)
    }));

    // Calculate overall summary
    const summary = {
      totalFindings: legacyResults.length,
      criticalCount: legacyResults.filter(r => r.severity === "critical").length,
      highCount: legacyResults.filter(r => r.severity === "high").length,
      mediumCount: legacyResults.filter(r => r.severity === "medium").length,
      lowCount: legacyResults.filter(r => r.severity === "low").length,
    };

    return {
      scanId: data.scanId,
      status: data.status,
      results: {
        categories,
        summary
      },
      errors: []
    };
  }

  // Return empty structure if no valid data
  return {
    scanId: data.scanId || 'unknown',
    status: data.status || 'unknown',
    results: {
      categories: [],
      summary: {
        totalFindings: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      }
    },
    errors: []
  };
}

/**
 * Extract all findings from enhanced scan data
 */
export function extractAllFindings(data: EnhancedScanData): Finding[] {
  return data.results.categories.flatMap(category => category.findings);
}

/**
 * Convert enhanced findings back to legacy format for compatibility
 */
export function convertToLegacyFormat(data: EnhancedScanData): ScanResult[] {
  return extractAllFindings(data).map(finding => ({
    issue: finding.type || finding.title,
    severity: finding.severity,
    file: finding.location?.file || finding.location?.url,
    matches: finding.evidence ? [finding.evidence.pattern || finding.evidence.value] : []
  }));
}

/**
 * Determine category based on issue type
 */
function determineCategory(issue: string): string {
  const lowerIssue = issue.toLowerCase();
  
  if (lowerIssue.includes("key") || lowerIssue.includes("token") || lowerIssue.includes("secret") || lowerIssue.includes("password")) {
    return "secrets";
  }
  if (lowerIssue.includes("header") || lowerIssue.includes("csp") || lowerIssue.includes("cors")) {
    return "headers";
  }
  if (lowerIssue.includes("file") || lowerIssue.includes("directory") || lowerIssue.includes("backup")) {
    return "files";
  }
  if (lowerIssue.includes("injection") || lowerIssue.includes("xss") || lowerIssue.includes("owasp")) {
    return "owasp";
  }
  
  return "misconfiguration";
}

/**
 * Calculate summary for a category of findings
 */
function calculateCategorySummary(findings: Finding[]) {
  return {
    totalFindings: findings.length,
    criticalCount: findings.filter(f => f.severity === "critical").length,
    highCount: findings.filter(f => f.severity === "high").length,
    mediumCount: findings.filter(f => f.severity === "medium").length,
    lowCount: findings.filter(f => f.severity === "low").length,
  };
}

/**
 * Calculate overall summary from all categories
 */
function calculateOverallSummary(categories: ScanResultCategory[]) {
  const allFindings = categories.flatMap(cat => cat.findings);
  return {
    totalFindings: allFindings.length,
    criticalCount: allFindings.filter(f => f.severity === "critical").length,
    highCount: allFindings.filter(f => f.severity === "high").length,
    mediumCount: allFindings.filter(f => f.severity === "medium").length,
    lowCount: allFindings.filter(f => f.severity === "low").length,
  };
}
