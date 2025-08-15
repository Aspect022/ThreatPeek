"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Globe,
  GitBranch,
  Search,
  Shield,
  Settings,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";

export type ScanType = "url" | "repository" | "deep";

export interface ScanConfig {
  scanType: ScanType;
  url?: string;
  repositoryUrl?: string;
  options: {
    includeSecrets: boolean;
    includeFiles: boolean;
    includeHeaders: boolean;
    includeOwasp: boolean;
    maxDepth: number;
    timeout: number;
    confidenceThreshold: number;
  };
}

interface ScanTypeSelectorProps {
  onScanStart: (config: ScanConfig) => void;
  isLoading?: boolean;
}

export function ScanTypeSelector({
  onScanStart,
  isLoading = false,
}: ScanTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<ScanType>("url");
  const [url, setUrl] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [repoError, setRepoError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [options, setOptions] = useState({
    includeSecrets: true,
    includeFiles: true,
    includeHeaders: true,
    includeOwasp: true,
    maxDepth: 3,
    timeout: 30,
    confidenceThreshold: 0.7,
  });

  const validateUrl = (inputUrl: string): boolean => {
    try {
      const urlObj = new URL(inputUrl);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const validateRepositoryUrl = (inputUrl: string): boolean => {
    const githubPattern =
      /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?(?:\/)?$/;
    const gitlabPattern =
      /^https:\/\/gitlab\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?(?:\/)?$/;
    return githubPattern.test(inputUrl) || gitlabPattern.test(inputUrl);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value && !validateUrl(value)) {
      setUrlError("Please enter a valid HTTP or HTTPS URL");
    } else {
      setUrlError("");
    }
  };

  const handleRepositoryUrlChange = (value: string) => {
    setRepositoryUrl(value);
    if (value && !validateRepositoryUrl(value)) {
      setRepoError(
        "Please enter a valid GitHub or GitLab repository URL (e.g., https://github.com/user/repo)"
      );
    } else {
      setRepoError("");
    }
  };

  const handleScan = () => {
    const config: ScanConfig = {
      scanType: selectedType,
      options,
    };

    if (selectedType === "url" || selectedType === "deep") {
      if (!url || !validateUrl(url)) {
        setUrlError("Please enter a valid URL");
        return;
      }
      config.url = url;
    }

    if (selectedType === "repository") {
      if (!repositoryUrl || !validateRepositoryUrl(repositoryUrl)) {
        setRepoError("Please enter a valid repository URL");
        return;
      }
      config.repositoryUrl = repositoryUrl;
    }

    onScanStart(config);
  };

  const scanTypes = [
    {
      type: "url" as ScanType,
      title: "URL Scan",
      description:
        "Scan a web application by URL for exposed secrets and basic vulnerabilities",
      icon: Globe,
      features: [
        "API Key Detection",
        "Basic Security Headers",
        "Exposed Files",
      ],
      recommended: false,
    },
    {
      type: "repository" as ScanType,
      title: "Repository Scan",
      description:
        "Clone and scan a GitHub/GitLab repository for security issues in source code",
      icon: GitBranch,
      features: [
        "Source Code Analysis",
        "Secret Detection",
        "Configuration Issues",
      ],
      recommended: false,
    },
    {
      type: "deep" as ScanType,
      title: "Deep Scan",
      description:
        "Comprehensive security assessment with OWASP checks and advanced analysis",
      icon: Search,
      features: [
        "All URL Scan Features",
        "OWASP Top 10 Checks",
        "Security Headers Analysis",
        "AI-Powered Insights",
      ],
      recommended: true,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Scan Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scanTypes.map((scanType) => {
          const Icon = scanType.icon;
          const isSelected = selectedType === scanType.type;

          return (
            <Card
              key={scanType.type}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                isSelected
                  ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setSelectedType(scanType.type)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon
                      className={`h-5 w-5 ${
                        isSelected ? "text-blue-600" : "text-gray-600"
                      }`}
                    />
                    <CardTitle className="text-lg">{scanType.title}</CardTitle>
                  </div>
                  {scanType.recommended && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      Recommended
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm">
                  {scanType.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {scanType.features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 text-sm text-gray-600"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Scan Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Input for URL and Deep scans */}
          {(selectedType === "url" || selectedType === "deep") && (
            <div className="space-y-2">
              <Label htmlFor="url">Target URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={urlError ? "border-red-500" : ""}
              />
              {urlError && (
                <div className="flex items-center space-x-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>
          )}

          {/* Repository URL Input */}
          {selectedType === "repository" && (
            <div className="space-y-2">
              <Label htmlFor="repositoryUrl">Repository URL</Label>
              <Input
                id="repositoryUrl"
                type="url"
                placeholder="https://github.com/username/repository"
                value={repositoryUrl}
                onChange={(e) => handleRepositoryUrlChange(e.target.value)}
                className={repoError ? "border-red-500" : ""}
              />
              {repoError && (
                <div className="flex items-center space-x-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{repoError}</span>
                </div>
              )}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Info className="h-4 w-4" />
                <span>Supports public GitHub and GitLab repositories</span>
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="advanced-options"
                className="flex items-center space-x-2"
              >
                <Settings className="h-4 w-4" />
                <span>Advanced Options</span>
              </Label>
              <Switch
                id="advanced-options"
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
              />
            </div>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Scan Types */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Detection Types
                    </Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="secrets" className="text-sm">
                          Secret Detection
                        </Label>
                        <Switch
                          id="secrets"
                          checked={options.includeSecrets}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({
                              ...prev,
                              includeSecrets: checked,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="files" className="text-sm">
                          File Detection
                        </Label>
                        <Switch
                          id="files"
                          checked={options.includeFiles}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({
                              ...prev,
                              includeFiles: checked,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="headers" className="text-sm">
                          Security Headers
                        </Label>
                        <Switch
                          id="headers"
                          checked={options.includeHeaders}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({
                              ...prev,
                              includeHeaders: checked,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="owasp" className="text-sm">
                          OWASP Checks
                        </Label>
                        <Switch
                          id="owasp"
                          checked={options.includeOwasp}
                          onCheckedChange={(checked) =>
                            setOptions((prev) => ({
                              ...prev,
                              includeOwasp: checked,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Performance Options */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Performance Settings
                    </Label>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="maxDepth" className="text-sm">
                          Max Scan Depth: {options.maxDepth}
                        </Label>
                        <input
                          id="maxDepth"
                          type="range"
                          min="1"
                          max="5"
                          value={options.maxDepth}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              maxDepth: parseInt(e.target.value),
                            }))
                          }
                          className="w-full mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="timeout" className="text-sm">
                          Timeout (seconds): {options.timeout}
                        </Label>
                        <input
                          id="timeout"
                          type="range"
                          min="10"
                          max="120"
                          value={options.timeout}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              timeout: parseInt(e.target.value),
                            }))
                          }
                          className="w-full mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confidence" className="text-sm">
                          Confidence Threshold:{" "}
                          {Math.round(options.confidenceThreshold * 100)}%
                        </Label>
                        <input
                          id="confidence"
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={options.confidenceThreshold}
                          onChange={(e) =>
                            setOptions((prev) => ({
                              ...prev,
                              confidenceThreshold: parseFloat(e.target.value),
                            }))
                          }
                          className="w-full mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Scan Button */}
          <Button
            onClick={handleScan}
            disabled={
              isLoading ||
              (selectedType !== "repository" && !url) ||
              (selectedType === "repository" && !repositoryUrl)
            }
            className="w-full h-12 text-lg font-semibold"
            size="lg"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Scanning...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5" />
                <span>
                  Start{" "}
                  {selectedType === "deep"
                    ? "Deep"
                    : selectedType === "repository"
                    ? "Repository"
                    : "URL"}{" "}
                  Scan
                </span>
              </div>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
