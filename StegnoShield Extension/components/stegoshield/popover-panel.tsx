"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/stegoshield/button";
import { YesNoBadge } from "@/components/stegoshield/yes-no-badge";
import { type OCRResult } from "~utils/ocr";

type PopoverPanelProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  className?: string;
  imageElement: HTMLImageElement;
  result: OCRResult | null;
  isProcessing: boolean;
  error: string | null;
  onRunOCR: () => void;
  settings: {
    ocrLang: string;
    ocrMode: "local" | "cloud";
  };
};

export function PopoverPanel({
  open,
  onOpenChange,
  className,
  imageElement,
  result,
  isProcessing,
  error,
  onRunOCR,
  settings,
}: PopoverPanelProps) {
  const [expandedOpen, setExpandedOpen] = React.useState(false);

  const copyAll = React.useCallback(() => {
    if (!result?.text) return;
    navigator.clipboard?.writeText(result.text).catch(() => {});
  }, [result]);

  const handleRunOCR = React.useCallback(() => {
    onRunOCR();
  }, [onRunOCR]);

  return (
    <>
      <div
        role="dialog"
        aria-modal="false"
        aria-label="StegoShield Panel"
        className={cn(
          "z-50 w-[280px] rounded-2xl border bg-white p-4 shadow-lg ring-1 ring-black/5",
          "transition-all duration-200 ease-out",
          "isolate-contain-layout-style-paint",
          "will-change-transform",
          "transform-gpu",
          "filter-none",
          "backdrop-filter-none",
          "mix-blend-normal",
          open
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 -translate-y-1",
          className
        )}
        style={{
          isolation: "isolate",
          contain: "layout style paint",
          willChange: "transform",
          transform: "translateZ(0)",
          filter: "none",
          backdropFilter: "none",
          mixBlendMode: "normal",
        }}
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-white text-[10px] font-medium">
              S
            </span>
            <h2 className="text-sm font-medium text-[#111827]">StegoShield</h2>
          </div>
          <button
            className="rounded-md p-2 text-[#6B7280] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <span aria-hidden>{"✕"}</span>
          </button>
        </header>

        <div className="mt-3">
          {/* Image Preview */}
          <div className="mb-3 rounded-lg border border-gray-200 overflow-hidden">
            <img
              src={imageElement.src}
              alt="Analysis target"
              className="w-full h-24 object-cover"
            />
          </div>

          {/* OCR Button */}
          <div className="flex justify-center mb-3">
            <Button
              size="sm"
              variant="primary"
              onClick={handleRunOCR}
              disabled={isProcessing}
              className="min-w-24"
            >
              {isProcessing ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Run OCR"
              )}
            </Button>
          </div>

          <div className="my-3 h-px bg-[#E5E7EB]" />

          {/* Results header with Yes/No badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[#6B7280]">Detected Text:</span>
            {result ? (
              <YesNoBadge value={result.hasText} />
            ) : error ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                Error
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-[#6B7280]">
                No run yet
              </span>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Scrollable results box */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white mb-3">
            {isProcessing ? (
              <div className="flex h-28 items-center justify-center gap-2 text-xs text-[#6B7280]">
                <svg
                  className="h-4 w-4 animate-spin text-[#3B82F6]"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Analyzing image...
              </div>
            ) : result && result.text ? (
              <div className="max-h-[150px] overflow-y-auto">
                <div className="px-3 py-2">
                  <p className="text-xs leading-5 text-[#111827] whitespace-pre-wrap">
                    {result.text}
                  </p>
                  {result.confidence && (
                    <p className="text-xs text-[#6B7280] mt-2">
                      Confidence: {Math.round(result.confidence * 100)}%
                    </p>
                  )}
                </div>
              </div>
            ) : result ? (
              <div className="px-3 py-2 text-xs text-[#6B7280]">
                No readable text found.
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-[#6B7280]">
                Run OCR to see results.
              </div>
            )}
          </div>

          {/* Actions row */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="justify-center"
              onClick={copyAll}
              disabled={!result || !result.text}
            >
              Copy
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="justify-center"
              onClick={() => setExpandedOpen(true)}
              disabled={!result}
            >
              Expand
            </Button>
          </div>

          {/* Settings info */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Mode: {settings.ocrMode}</span>
              <span>Lang: {settings.ocrLang}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Results Modal */}
      {expandedOpen && result && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Extracted Text"
          className="fixed inset-0 z-[60] grid place-items-center"
        >
          <button
            aria-label="Close overlay"
            className="fixed inset-0 bg-black/50"
            onClick={() => setExpandedOpen(false)}
          />
          <div className="relative z-[61] w-[min(90vw,640px)] rounded-2xl border bg-white p-4 shadow-xl ring-1 ring-black/10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111827]">
                Extracted Text
              </h3>
              <button
                className="rounded-md p-2 text-[#6B7280] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                onClick={() => setExpandedOpen(false)}
                aria-label="Close"
              >
                <span aria-hidden>{"✕"}</span>
              </button>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] mb-4">
              <img
                src={imageElement.src}
                alt="Analysis target"
                className="w-full h-32 object-cover rounded-t-xl"
              />
            </div>

            <div className="rounded-xl border border-[#E5E7EB]">
              {result.text ? (
                <div className="h-64 overflow-y-auto p-4">
                  <pre className="whitespace-pre-wrap text-sm leading-6 font-sans text-[#111827]">
                    {result.text}
                  </pre>
                  {result.confidence && (
                    <p className="text-sm text-gray-500 mt-3 pt-3 border-t">
                      Confidence: {Math.round(result.confidence * 100)}%
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 text-sm text-[#6B7280]">
                  No data to show.
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setExpandedOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={copyAll}
                disabled={!result.text}
              >
                Copy Text
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
