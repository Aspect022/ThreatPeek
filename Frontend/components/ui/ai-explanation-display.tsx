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
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  Info,
  Code,
  ExternalLink,
  BookOpen,
  Lightbulb,
  FileText,
} from "lucide-react";

export interface AIExplanation {
  id: string;
  findingId: string;
  title: string;
  summary: string;
  impact: {
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    businessImpact: string[];
    technicalImpact: string[];
  };
  explanation: {
    whatIsIt: string;
    whyDangerous: string;
    howItHappens: string;
    commonScenarios: string[];
  };
  remediation: {
    immediateSteps: RemediationStep[];
    longTermSteps: RemediationStep[];
    codeExamples: CodeExample[];
    bestPractices: string[];
  };
  references: Reference[];
  confidence: number;
  generatedAt: string;
}

export interface RemediationStep {
  step: number;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedTime: string;
  codeExample?: string;
}

export interface CodeExample {
  title: string;
  description: string;
  language: string;
  before?: string;
  after: string;
  explanation: string;
}

export interface Reference {
  title: string;
  url: string;
  type: "documentation" | "article" | "tool" | "standard";
}

interface AIExplanationDisplayProps {
  explanation: AIExplanation;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  showCopyButtons?: boolean;
}

export function AIExplanationDisplay({
  explanation,
  isExpanded = false,
  onToggle,
  showCopyButtons = true,
}: AIExplanationDisplayProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems((prev) => new Set(prev).add(itemId));

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getReferenceIcon = (type: string) => {
    switch (type) {
      case "documentation":
        return <BookOpen className="h-4 w-4" />;
      case "article":
        return <FileText className="h-4 w-4" />;
      case "tool":
        return <Code className="h-4 w-4" />;
      case "standard":
        return <Info className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  const CopyButton = ({
    text,
    itemId,
    className = "",
  }: {
    text: string;
    itemId: string;
    className?: string;
  }) => {
    if (!showCopyButtons) return null;

    const isCopied = copiedItems.has(itemId);

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(text, itemId)}
        className={`h-8 w-8 p-0 ${className}`}
        title="Copy to clipboard"
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    );
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <Collapsible open={expanded} onOpenChange={handleToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-white/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg text-gray-900">
                    {explanation.title}
                  </CardTitle>
                  <CardDescription className="flex items-center space-x-2">
                    <span>AI-Generated Analysis</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(explanation.confidence * 100)}% confidence
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(
                    explanation.impact.severity
                  )}`}
                >
                  {explanation.impact.severity.charAt(0).toUpperCase() +
                    explanation.impact.severity.slice(1)}{" "}
                  Impact
                </div>
                {expanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Summary
                </h3>
                <CopyButton text={explanation.summary} itemId="summary" />
              </div>
              <p className="text-gray-700 leading-relaxed">
                {explanation.summary}
              </p>
            </div>

            {/* Impact Analysis */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Impact Analysis
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-gray-700 mb-3">
                    {explanation.impact.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Business Impact
                    </h4>
                    <ul className="space-y-1">
                      {explanation.impact.businessImpact.map(
                        (impact, index) => (
                          <li
                            key={index}
                            className="flex items-start space-x-2 text-sm text-gray-600"
                          >
                            <span className="text-red-500 mt-1">•</span>
                            <span>{impact}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Technical Impact
                    </h4>
                    <ul className="space-y-1">
                      {explanation.impact.technicalImpact.map(
                        (impact, index) => (
                          <li
                            key={index}
                            className="flex items-start space-x-2 text-sm text-gray-600"
                          >
                            <span className="text-orange-500 mt-1">•</span>
                            <span>{impact}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Explanation */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Lightbulb className="h-4 w-4 mr-2" />
                Detailed Explanation
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    What is this issue?
                  </h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {explanation.explanation.whatIsIt}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Why is it dangerous?
                  </h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {explanation.explanation.whyDangerous}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    How does it happen?
                  </h4>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {explanation.explanation.howItHappens}
                  </p>
                </div>

                {explanation.explanation.commonScenarios.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Common Scenarios
                    </h4>
                    <ul className="space-y-1">
                      {explanation.explanation.commonScenarios.map(
                        (scenario, index) => (
                          <li
                            key={index}
                            className="flex items-start space-x-2 text-sm text-gray-600"
                          >
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{scenario}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Remediation Steps */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Code className="h-4 w-4 mr-2" />
                Remediation Steps
              </h3>

              {/* Immediate Steps */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">
                  Immediate Actions
                </h4>
                <div className="space-y-3">
                  {explanation.remediation.immediateSteps.map((step, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {step.step}
                          </span>
                          <h5 className="font-medium text-gray-900">
                            {step.title}
                          </h5>
                          <Badge className={getPriorityColor(step.priority)}>
                            {step.priority} priority
                          </Badge>
                          <span className="text-xs text-gray-500">
                            ~{step.estimatedTime}
                          </span>
                        </div>
                        {step.codeExample && (
                          <CopyButton
                            text={step.codeExample}
                            itemId={`immediate-${index}`}
                          />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {step.description}
                      </p>
                      {step.codeExample && (
                        <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto">
                          <code>{step.codeExample}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Long-term Steps */}
              {explanation.remediation.longTermSteps.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Long-term Improvements
                  </h4>
                  <div className="space-y-3">
                    {explanation.remediation.longTermSteps.map(
                      (step, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                {step.step}
                              </span>
                              <h5 className="font-medium text-gray-900">
                                {step.title}
                              </h5>
                              <Badge
                                className={getPriorityColor(step.priority)}
                              >
                                {step.priority} priority
                              </Badge>
                              <span className="text-xs text-gray-500">
                                ~{step.estimatedTime}
                              </span>
                            </div>
                            {step.codeExample && (
                              <CopyButton
                                text={step.codeExample}
                                itemId={`longterm-${index}`}
                              />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {step.description}
                          </p>
                          {step.codeExample && (
                            <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto">
                              <code>{step.codeExample}</code>
                            </pre>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Code Examples */}
              {explanation.remediation.codeExamples.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Code Examples
                  </h4>
                  <div className="space-y-4">
                    {explanation.remediation.codeExamples.map(
                      (example, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">
                              {example.title}
                            </h5>
                            <CopyButton
                              text={example.after}
                              itemId={`code-${index}`}
                            />
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {example.description}
                          </p>

                          {example.before && (
                            <div className="mb-3">
                              <h6 className="text-xs font-medium text-red-600 mb-1">
                                ❌ Before (Vulnerable)
                              </h6>
                              <pre className="bg-red-50 border border-red-200 rounded p-2 text-xs overflow-x-auto">
                                <code
                                  className={`language-${example.language}`}
                                >
                                  {example.before}
                                </code>
                              </pre>
                            </div>
                          )}

                          <div className="mb-3">
                            <h6 className="text-xs font-medium text-green-600 mb-1">
                              ✅ After (Secure)
                            </h6>
                            <pre className="bg-green-50 border border-green-200 rounded p-2 text-xs overflow-x-auto">
                              <code className={`language-${example.language}`}>
                                {example.after}
                              </code>
                            </pre>
                          </div>

                          <p className="text-xs text-gray-500 italic">
                            {example.explanation}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Best Practices */}
              {explanation.remediation.bestPractices.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Best Practices
                  </h4>
                  <ul className="space-y-2">
                    {explanation.remediation.bestPractices.map(
                      (practice, index) => (
                        <li
                          key={index}
                          className="flex items-start space-x-2 text-sm text-gray-600"
                        >
                          <span className="text-green-500 mt-1">✓</span>
                          <span>{practice}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* References */}
            {explanation.references.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  References & Further Reading
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {explanation.references.map((ref, index) => (
                    <a
                      key={index}
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 p-2 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      {getReferenceIcon(ref.type)}
                      <span className="text-sm text-blue-600 hover:text-blue-800 truncate">
                        {ref.title}
                      </span>
                      <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
              Generated on {new Date(explanation.generatedAt).toLocaleString()}{" "}
              • Confidence: {Math.round(explanation.confidence * 100)}%
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
