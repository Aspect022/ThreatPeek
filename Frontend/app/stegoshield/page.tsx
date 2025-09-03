"use client";
import { useState, useRef } from "react";

export default function StegoShieldPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-950 text-gray-100">
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              StegoShield
            </h1>
            <p className="mt-3 text-gray-300 max-w-2xl">
              Understand prompt injection and how hidden content in images or UI
              can coerce LLMs to leak data, execute unintended actions, or
              bypass safety guardrails. StegoShield explains risks and
              mitigation patterns, and lets you try our analyzer.
            </p>
          </div>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-8">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-xl font-semibold">What is Prompt Injection?</h2>
            <p className="mt-3 text-gray-300">
              Prompt injection is a technique where malicious instructions are
              embedded in content the model processes (text, images, tool
              outputs). These instructions try to override system prompts or
              manipulate the model to exfiltrate secrets, change behavior, or
              perform harmful actions.
            </p>
            <ul className="mt-4 list-disc pl-5 text-gray-300 space-y-2">
              <li>
                <span className="font-medium">Data exfiltration</span>: coaxing
                the model to reveal secrets or internal notes.
              </li>
              <li>
                <span className="font-medium">Tool abuse</span>: triggering
                unintended API calls or actions via toolformer flows.
              </li>
              <li>
                <span className="font-medium">Policy bypass</span>: instructing
                the model to ignore safety rules.
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-xl font-semibold">
              How can images be harmful?
            </h2>
            <p className="mt-3 text-gray-300">
              Images can hide instructions in pixels or text regions that OCR
              can read but humans may overlook. Combined with UI flows, these
              can trick automated agents. Heuristics like entropy, blockiness,
              OCR, and resampling consistency help flag suspicious content.
            </p>
            <ul className="mt-4 list-disc pl-5 text-gray-300 space-y-2">
              <li>Hidden text or QR-like patterns with commands.</li>
              <li>Steganographic bits in low-order channels.</li>
              <li>JPEG artifacts aligned with embedded payloads.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">Mitigations</h2>
          <ul className="mt-3 list-disc pl-5 text-gray-300 space-y-2">
            <li>
              Constrain tool use and apply allowlists for external actions.
            </li>
            <li>
              Separate and sanitize OCR outputs before feeding to the model.
            </li>
            <li>
              Score content with heuristics; quarantine or downrank suspicious
              inputs.
            </li>
            <li>Strip/blur high-risk regions; watermark trusted outputs.</li>
          </ul>
        </div>

        <div className="mt-10 rounded-lg border border-blue-900/40 bg-blue-950/30 p-6">
          <h2 className="text-xl font-semibold">Try the Analyzer</h2>
          <p className="mt-3 text-gray-300">
            Upload an image to score risk and extract OCR signals. This demo
            calls the backend at
            <code className="mx-1">/api/stegoshield/analyze</code>.
          </p>
          <AnalyzerWidget />
        </div>
      </section>
    </main>
  );
}

function AnalyzerWidget() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select an image.");
      return;
    }
    const form = new FormData();
    form.append("image", file);
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        purger_ncomp: "0",
        watermark_enabled: "false",
      });
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const url = `${apiBase}/stegoshield/analyze?${q.toString()}`;
      const res = await fetch(url, {
        method: "POST",
        body: form,
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : await res.text();
      if (!res.ok) {
        const msg =
          typeof data === "string"
            ? data.slice(0, 300)
            : data?.error || "Request failed";
        throw new Error(msg);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="block w-full text-sm text-gray-300"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Analyzing..." : "Analyze Image"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className="mt-4 rounded-md border border-gray-800 p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Decision</h3>
              <p className="text-gray-300">{result.decision}</p>
              <h3 className="font-semibold mt-3">Scores</h3>
              <p className="text-gray-300 text-sm">
                stego_score: {result.stego_score?.toFixed?.(3)}
              </p>
              <p className="text-gray-300 text-sm">
                rdr_score: {result.rdr_score?.toFixed?.(3)}
              </p>
            </div>
            <div className="md:col-span-2">
              <h3 className="font-semibold">OCR Texts</h3>
              <div className="mt-2 max-h-40 overflow-auto rounded bg-gray-950/50 p-2 text-sm">
                {(result.ocr_texts || []).map((t: string, i: number) => (
                  <div key={i} className="text-gray-300">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {result.watermarked_base64 && (
            <div className="mt-4">
              <h3 className="font-semibold">Watermarked Preview</h3>
              <img
                alt="watermarked"
                className="mt-2 max-h-64 rounded border border-gray-800"
                src={`data:image/png;base64,${result.watermarked_base64}`}
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}
