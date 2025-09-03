"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  XCircle,
  Info,
  CheckCircle2,
  Shield,
  Globe,
  FileText,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";

export interface Finding {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  title: string;
  description: string;
  category: "secrets" | "files" | "headers" | "owasp" | "misconfig";
  location: {
    file?: string;
    line?: number;
    url?: string;
  };
  evidence: {
    pattern?: string;
    value?: string;
    context?: string;
  };
  remediation?: {
    steps: string[];
    references: string[];
  };
}

export interface ScanResultCategory {
  category: "secrets" | "files" | "headers" | "owasp" | "misconfig";
  findings: Finding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface EnhancedResultsDisplayProps {
  results: ScanResultCategory[];
  isLoading?: boolean;
}

type SortOption = "severity" | "confidence" | "category" | "title";
type FilterOption = "all" | "critical" | "high" | "medium" | "low";

export function EnhancedResultsDisplay({
  results,
  isLoading = false,
}: EnhancedResultsDisplayProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<FilterOption>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("severity");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["secrets", "owasp"])
  );
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  // Flatten all findings from all categories
  const allFindings = useMemo(() => {
    return results.flatMap((category) =>
      category.findings.map((finding) => ({
        ...finding,
        categoryName: category.category,
      }))
    );
  }, [results]);

  // Filter and sort findings
  const filteredAndSortedFindings = useMemo(() => {
    let filtered = allFindings;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (finding) =>
          finding.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          finding.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          finding.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter(
        (finding) => finding.severity === severityFilter
      );
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (finding) => finding.category === categoryFilter
      );
    }

    // Apply "show only issues" filter
    if (showOnlyIssues) {
      filtered = filtered.filter(
        (finding) =>
          finding.severity === "critical" || finding.severity === "high"
      );
    }

    // Sort findings
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "severity":
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        case "confidence":
          return b.confidence - a.confidence;
        case "category":
          return a.category.localeCompare(b.category);
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    allFindings,
    searchTerm,
    severityFilter,
    categoryFilter,
    sortBy,
    showOnlyIssues,
  ]);

  // Group filtered findings by category for display
  const groupedFindings = useMemo(() => {
    const groups: Record<string, Finding[]> = {};
    filteredAndSortedFindings.forEach((finding) => {
      if (!groups[finding.category]) {
        groups[finding.category] = [];
      }
      groups[finding.category].push(finding);
    });
    return groups;
  }, [filteredAndSortedFindings]);

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "medium":
        return <Info className="h-4 w-4 text-yellow-600" />;
      case "low":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "secrets":
        return <Shield className="h-4 w-4" />;
      case "files":
        return <FileText className="h-4 w-4" />;
      case "headers":
        return <Globe className="h-4 w-4" />;
      case "owasp":
        return <AlertTriangle className="h-4 w-4" />;
      case "misconfig":
        return <Settings className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "secrets":
        return "Secret Detection";
      case "files":
        return "Exposed Files";
      case "headers":
        return "Security Headers";
      case "owasp":
        return "OWASP Vulnerabilities";
      case "misconfig":
        return "Misconfigurations";
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const totalFindings = allFindings.length;
  const criticalCount = allFindings.filter(
    (f) => f.severity === "critical"
  ).length;
  const highCount = allFindings.filter((f) => f.severity === "high").length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold">{totalFindings}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical</p>
                <p className="text-2xl font-bold text-red-600">
                  {criticalCount}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Risk</p>
                <p className="text-2xl font-bold text-orange-600">
                  {highCount}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-blue-600">
                  {results.length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filter & Search Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search findings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Severity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <Select
                value={severityFilter}
                onValueChange={(value: FilterOption) =>
                  setSeverityFilter(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="secrets">Secrets</SelectItem>
                  <SelectItem value="files">Files</SelectItem>
                  <SelectItem value="headers">Headers</SelectItem>
                  <SelectItem value="owasp">OWASP</SelectItem>
                  <SelectItem value="misconfig">Misconfig</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select
                value={sortBy}
                onValueChange={(value: SortOption) => setSortBy(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showOnlyIssues ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyIssues(!showOnlyIssues)}
              className="flex items-center space-x-1"
            >
              {showOnlyIssues ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              <span>Critical & High Only</span>
            </Button>
            <Badge variant="secondary">
              {filteredAndSortedFindings.length} of {totalFindings} findings
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Results by Category */}
      <div className="space-y-4">
        {Object.entries(groupedFindings).map(([category, findings]) => (
          <Card key={category}>
            <Collapsible
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategoryExpansion(category)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getCategoryIcon(category)}
                      <div>
                        <CardTitle className="text-lg">
                          {getCategoryTitle(category)}
                        </CardTitle>
                        <CardDescription>
                          {findings.length} finding
                          {findings.length !== 1 ? "s" : ""} in this category
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{findings.length}</Badge>
                      {expandedCategories.has(category) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getSeverityIcon(finding.severity)}
                            <h4 className="font-medium text-gray-900">
                              {finding.title}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityBadge(
                                finding.severity
                              )}`}
                            >
                              {finding.severity.charAt(0).toUpperCase() +
                                finding.severity.slice(1)}
                            </span>
                            <Badge
                              variant="outline"
                              className={getConfidenceColor(finding.confidence)}
                            >
                              {Math.round(finding.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">
                          {finding.description}
                        </p>

                        {finding.evidence?.pattern && (
                          <div className="bg-gray-100 rounded p-2 mb-2">
                            <p className="text-xs text-gray-500 mb-1">
                              Pattern Matched:
                            </p>
                            <code className="text-sm font-mono text-gray-800">
                              {finding.evidence.pattern}
                            </code>
                          </div>
                        )}

                        {finding.location.file && (
                          <div className="text-xs text-gray-500">
                            <FileText className="inline h-3 w-3 mr-1" />
                            {finding.location.file}
                            {finding.location.line &&
                              `:${finding.location.line}`}
                          </div>
                        )}

                        {finding.location.url && (
                          <div className="text-xs text-gray-500">
                            <Globe className="inline h-3 w-3 mr-1" />
                            {finding.location.url}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {filteredAndSortedFindings.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No findings match your filters
            </h3>
            <p className="text-gray-600">
              Try adjusting your search terms or filters to see more results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
