"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type LogEntry = {
  id: string;
  ts: string; // ISO
  type: "auth" | "api" | "error" | "db" | "file" | "config" | "user";
  message: string;
  level?: "info" | "warn" | "error";
  isAnomaly?: boolean;
};

type Buckets = {
  auth: LogEntry[];
  api: LogEntry[];
  error: LogEntry[];
  db: LogEntry[];
  file: LogEntry[];
  config: LogEntry[];
  user: LogEntry[];
};

const initialBuckets: Buckets = {
  auth: [],
  api: [],
  error: [],
  db: [],
  file: [],
  config: [],
  user: [],
};

function nowISO() {
  return new Date().toISOString();
}

function isAnomalyMessage(msg: string) {
  const s = msg.toLowerCase();
  return [
    "failed",
    "unauthorized",
    "forbidden",
    "timeout",
    "error",
    "exception",
    "sql injection",
    "xss",
    "suspicious",
    "leak",
    "secret",
  ].some((k) => s.includes(k));
}

export default function LogsPage() {
  const [buckets, setBuckets] = useState<Buckets>(initialBuckets);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeLogType, setActiveLogType] = useState<"merged" | "bad">("merged");
  const streamingRef = useRef(false);
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ingest = useCallback(
    (
      entry: Omit<LogEntry, "id" | "ts" | "isAnomaly"> &
        Partial<Pick<LogEntry, "isAnomaly" | "level">>
    ) => {
      const isAnom = entry.isAnomaly ?? isAnomalyMessage(entry.message);
      const full: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ts: nowISO(),
        level: entry.level ?? (isAnom ? "error" : "info"),
        isAnomaly: isAnom,
        ...entry,
      };

      setBuckets((prev) => ({
        ...prev,
        [full.type]: [full, ...prev[full.type]].slice(0, 2000), // keep recent 2000
      }));

      if (full.isAnomaly) {
        // Fire-and-forget workflow trigger
        try {
          fetch("/api/workflows/anomaly", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entry: full }),
          }).catch(() => {});
        } catch {
          // ignore in demo
        }
      }
    },
    []
  );

  const streamLogs = useCallback(
    async (logs: LogEntry[], baseDelay: number = 100) => {
      setIsStreaming(true);
      streamingRef.current = true;
      
      // Clear any existing timeouts
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
      
      // Reset buckets for new stream
      setBuckets(initialBuckets);
      
      // Add a small initial delay to make the streaming effect more noticeable
      await new Promise(resolve => setTimeout(resolve, 500));
      
      for (let i = 0; i < logs.length; i++) {
        if (!streamingRef.current) break;
        
        // Add the log entry
        ingest(logs[i]);
        
        // Use a variable delay to make the streaming more realistic
        // For normal logs: random delay around baseDelay (±50%)
        // For bad logs: faster streaming with shorter delays
        const minDelay = Math.max(10, Math.floor(baseDelay * 0.5));
        const maxDelay = Math.floor(baseDelay * 1.5);
        const delay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        
        // Wait for the specified delay before adding the next log
        await new Promise(resolve => {
          streamTimeoutRef.current = setTimeout(resolve, delay);
        });
      }
      
      setIsStreaming(false);
      streamingRef.current = false;
    },
    [ingest]
  );

  const loadLogsFromCSV = useCallback(
    async (type: "merged" | "bad" = "merged", shouldStream: boolean = false) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/logs?type=${type}`);
        if (!response.ok) throw new Error("Failed to fetch logs");

        const data = await response.json();
        
        // For initial load, just add all logs directly
        if (!shouldStream) {
          const newBuckets: Buckets = { ...initialBuckets };
          data.logs.forEach((log: LogEntry) => {
            newBuckets[log.type].push(log);
          });
          setBuckets(newBuckets);
        } else {
          // For streaming, use the streamLogs function
          // For bad logs, use faster streaming (50ms delay)
          // For normal logs, use slower streaming (100ms delay)
          streamLogs(data.logs, type === "bad" ? 50 : 100);
        }
      } catch (error) {
        console.error("Error loading logs:", error);
      } finally {
        setLoading(false);
      }
    },
    [streamLogs]
  );

  const injectAnomalies = useCallback(() => {
    if (streamingRef.current) return;
    
    setIsStreaming(true);
    setActiveLogType("bad");
    // Show a visual indication that anomalies are being injected
    setBuckets(initialBuckets); // Clear current logs first
    loadLogsFromCSV("bad", true);
  }, [loadLogsFromCSV]);

  const startStreaming = useCallback(() => {
    if (streamingRef.current) return;
    
    setIsStreaming(true);
    setActiveLogType("merged");
    loadLogsFromCSV("merged", true);
  }, [loadLogsFromCSV]);

  // Load initial logs on component mount
  useEffect(() => {
    loadLogsFromCSV("merged", false);
    
    // Cleanup on unmount
    return () => {
      streamingRef.current = false;
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
    };
  }, [loadLogsFromCSV]);

  const sections = useMemo(
    () => [
      {
        key: "auth" as const,
        title: "Authentication & Access Logs",
        description: "Sign-ins, token usage, access decisions",
      },
      {
        key: "api" as const,
        title: "API & Request Logs",
        description: "Incoming requests and responses",
      },
      {
        key: "error" as const,
        title: "Error & Exception Logs",
        description: "Unhandled errors, exceptions and stack traces",
      },
      {
        key: "db" as const,
        title: "Database Query Logs",
        description: "Queries, durations, slow queries",
      },
      {
        key: "file" as const,
        title: "File Upload / Download Logs",
        description: "Blob/file storage operations",
      },
      {
        key: "config" as const,
        title: "Config & Deployment Logs",
        description: "Changes to config, releases and deploys",
      },
      {
        key: "user" as const,
        title: "User Behavior Logs",
        description: "Actions taken by end users",
      },
    ],
    []
  );

  return (
    <main>
      <DashboardTabs />

      <section className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between py-6">
          <div>
            <h1 className="text-xl font-semibold">Logs</h1>
            <p className="text-sm text-muted-foreground">
              {isStreaming 
                ? "Logs are streaming in real-time..." 
                : activeLogType === "bad"
                ? "Anomaly logs loaded. Click 'Start Streaming' to see anomalies appear in real-time."
                : "Normal logs loaded. Click 'Start Streaming' to see logs appear in real-time."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isStreaming ? (
              <>
                <Button
                  onClick={startStreaming}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={loading}
                >
                  Start Streaming
                </Button>
                <Button
                  onClick={injectAnomalies}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Inject Anomalies"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  streamingRef.current = false;
                  setIsStreaming(false);
                  if (streamTimeoutRef.current) {
                    clearTimeout(streamTimeoutRef.current);
                  }
                }}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                Stop Streaming
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {sections.slice(0, 6).map((sec) => (
            <LogPanel
              key={sec.key}
              title={sec.title}
              description={sec.description}
              logs={buckets[sec.key]}
            />
          ))}
        </div>

        <div className="mt-6">
          <LogPanel
            title={sections[6].title}
            description={sections[6].description}
            logs={buckets["user"]}
          />
        </div>

        {/* Log statistics */}
        <div className="mt-6 p-4 bg-muted/20 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Log Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Total Logs:</span>
              <div className="font-mono">
                {Object.values(buckets).reduce(
                  (sum, logs) => sum + logs.length,
                  0
                )}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Anomalies:</span>
              <div className="font-mono text-red-600">
                {Object.values(buckets).reduce(
                  (sum, logs) => sum + logs.filter((l) => l.isAnomaly).length,
                  0
                )}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Current Type:</span>
              <div className="font-mono capitalize">{activeLogType}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <div className="font-mono">
                {loading ? "Loading..." : isStreaming ? "Streaming" : "Ready"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LogPanel({
  title,
  description,
  logs,
}: {
  title: string;
  description?: string;
  logs: LogEntry[];
}) {
  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="h-56 overflow-y-auto rounded-md border bg-muted/20 p-2">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No logs yet.</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start gap-2 rounded p-2 hover:bg-muted/60 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                >
                  <Badge
                    variant={
                      l.isAnomaly
                        ? "destructive"
                        : l.level === "warn"
                        ? "secondary"
                        : "outline"
                    }
                    className="min-w-[64px] justify-center"
                  >
                    {l.isAnomaly
                      ? "ANOMALY"
                      : (l.level || "info").toUpperCase()}
                  </Badge>
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.ts).toLocaleTimeString()} •{" "}
                      <span className="uppercase">{l.type}</span>
                    </div>
                    <pre className="text-xs leading-5 whitespace-pre-wrap break-words font-mono text-foreground">
                      {l.message}
                    </pre>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
