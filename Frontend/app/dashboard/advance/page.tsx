"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardTabs from "@/components/dashboard/dashboard-tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal, Shield, Zap, Bug, Network, Code, Play } from "lucide-react";

/**
 * Advanced tools dashboard with integrated sandbox.
 * - WSL terminal integration via iframe
 * - Security testing tools with command injection
 * - Network scanning capabilities
 * - Code analysis tools
 */

export default function AdvancePage() {
  const { toast } = useToast();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [sandboxActive, setSandboxActive] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<any>(null);
  const [terminalStatus, setTerminalStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  // WSL Sandbox Configuration
  const WSL_IP = "172.31.74.84";
  const SANDBOX_PORT = "7685";
  const SANDBOX_URL = `/sandbox/terminal-wrapper.html`;

  const securityTools = [
    {
      name: "Good SQLi Test",
      description: "Safe SQL query test",
      icon: <Bug className="h-4 w-4" />,
      command: "curl 'http://172.31.74.84:5002/sqli?id=1'",
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      name: "Bad SQLi Test",
      description: "Malicious SQL injection test",
      icon: <Bug className="h-4 w-4" />,
      command:
        "curl 'http://172.31.74.84:5002/sqli?id=1%27%20OR%20%271%27=%271'",
      color: "bg-red-500 hover:bg-red-600",
    },
    {
      name: "XSS Detector",
      description: "Cross-site scripting vulnerability scanner",
      icon: <Code className="h-4 w-4" />,
      command: "python3 ~/demo_targets/xss_demo.py",
      color: "bg-orange-500 hover:bg-orange-600",
    },
    {
      name: "Network Scanner",
      description: "Port scanning and network reconnaissance",
      icon: <Network className="h-4 w-4" />,
      command: "nmap -sS -sV 127.0.0.1",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      name: "Vulnerability Assessment",
      description: "Comprehensive security assessment",
      icon: <Shield className="h-4 w-4" />,
      command: "nikto -h http://localhost",
      color: "bg-purple-500 hover:bg-purple-600",
    },
  ];

  const injectCommand = (command: string) => {
    if (!sandboxActive || !iframeRef.current) {
      toast({
        title: "Sandbox not ready",
        description: "Please activate the sandbox first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Send command to the wrapper iframe
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "command",
          command: command,
        },
        "*"
      );

      toast({
        title: "Command sent",
        description: `Executing: ${command}`,
      });

      // Simulate scan results
      setTimeout(() => {
        setScanResults({
          tool: command.split(" ")[0],
          timestamp: new Date().toISOString(),
          status: "completed",
          findings: [
            {
              severity: "high",
              description: `Command executed: ${command}`,
            },
            {
              severity: "medium",
              description: "Scan completed successfully",
            },
          ],
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Command injection failed",
        description: "Could not send command to terminal.",
        variant: "destructive",
      });
    }
  };

  const simulate = (tool: any) => {
    setCurrentTool(tool.name);
    injectCommand(tool.command);
  };

  const activateSandbox = () => {
    setSandboxActive(true);
    toast({
      title: "WSL Sandbox Activated",
      description:
        "Terminal access enabled. You can now run security tools safely.",
    });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="border-b">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-pretty">
              Advanced Security Tools
            </h1>
            <div className="hidden md:block">
              <Button
                variant="secondary"
                onClick={() => router.push("/dashboard/logs")}
              >
                View Logs
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            WSL-powered security sandbox with integrated terminal access and
            automated security testing tools.
          </p>
        </div>
        <div className="container mx-auto max-w-7xl px-4 pb-2">
          <DashboardTabs />
        </div>
      </section>

      <section>
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <Tabs defaultValue="sandbox" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sandbox">WSL Sandbox</TabsTrigger>
              <TabsTrigger value="tools">Security Tools</TabsTrigger>
              <TabsTrigger value="results">Scan Results</TabsTrigger>
            </TabsList>

            <TabsContent value="sandbox" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    WSL Terminal Sandbox
                  </CardTitle>
                  <CardDescription>
                    Secure terminal access to your WSL environment for running
                    security tools.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={sandboxActive ? "default" : "secondary"}>
                        {sandboxActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        WSL IP: {WSL_IP}:{SANDBOX_PORT}
                      </span>
                    </div>
                    <Button
                      onClick={activateSandbox}
                      variant={sandboxActive ? "default" : "secondary"}
                      disabled={sandboxActive}
                    >
                      {sandboxActive ? "Sandbox Active" : "Activate Sandbox"}
                    </Button>
                  </div>

                  {sandboxActive ? (
                    <div className="space-y-4">
                      <Alert>
                        <Terminal className="h-4 w-4" />
                        <AlertDescription>
                          Terminal sandbox is active. You can now run security
                          commands safely in the WSL environment.
                          {terminalStatus === "connecting" &&
                            " Connecting to WSL terminal..."}
                          {terminalStatus === "connected" &&
                            " Terminal connected successfully!"}
                          {terminalStatus === "error" &&
                            " Failed to connect to terminal. Please check if ttyd is running on WSL."}
                        </AlertDescription>
                      </Alert>

                      <div className="border rounded-lg overflow-hidden">
                        <iframe
                          ref={iframeRef}
                          src={SANDBOX_URL}
                          className="w-full h-[500px] border-0"
                          title="WSL Terminal Sandbox"
                          allow="fullscreen"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation allow-top-navigation-by-user-activation"
                          frameBorder="0"
                          scrolling="no"
                          style={{ backgroundColor: "black" }}
                          onLoad={() => setTerminalStatus("connected")}
                          onError={() => setTerminalStatus("error")}
                        />
                      </div>

                      {/* Security Tools Panel */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5" />
                            Quick Security Tools
                          </CardTitle>
                          <CardDescription>
                            Click to inject commands directly into the terminal
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* SQLi Section */}
                            <div>
                              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Bug className="h-4 w-4" />
                                SQL Injection Tests
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {securityTools.slice(0, 2).map((tool) => (
                                  <Button
                                    key={tool.name}
                                    onClick={() => simulate(tool)}
                                    variant="outline"
                                    className={`h-auto p-4 flex flex-col items-start gap-2 border-l-4 ${
                                      tool.name.includes("Good")
                                        ? "border-l-green-500 hover:border-l-green-600"
                                        : "border-l-red-500 hover:border-l-red-600"
                                    }`}
                                    disabled={!sandboxActive}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      {tool.icon}
                                      <span className="font-medium">
                                        {tool.name}
                                      </span>
                                      <Play className="h-3 w-3 ml-auto" />
                                    </div>
                                    <span className="text-xs text-muted-foreground text-left">
                                      {tool.description}
                                    </span>
                                    {sandboxActive && (
                                      <code className="text-xs bg-muted p-1 rounded mt-1 w-full text-left">
                                        {tool.command}
                                      </code>
                                    )}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Other Tools Section */}
                            <div>
                              <h3 className="text-sm font-semibold mb-2">
                                Other Tools
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {securityTools.slice(2).map((tool) => (
                                  <Button
                                    key={tool.name}
                                    onClick={() => simulate(tool)}
                                    variant="outline"
                                    className="h-auto p-4 flex flex-col items-start gap-2"
                                    disabled={!sandboxActive}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      {tool.icon}
                                      <span className="font-medium">
                                        {tool.name}
                                      </span>
                                      <Play className="h-3 w-3 ml-auto" />
                                    </div>
                                    <span className="text-xs text-muted-foreground text-left">
                                      {tool.description}
                                    </span>
                                    {sandboxActive && (
                                      <code className="text-xs bg-muted p-1 rounded mt-1 w-full text-left">
                                        {tool.command}
                                      </code>
                                    )}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {currentTool && (
                            <Alert className="mt-4">
                              <Zap className="h-4 w-4" />
                              <AlertDescription>
                                Running {currentTool} in WSL sandbox...
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="min-h-[400px] rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Activate the sandbox to access the WSL terminal</p>
                        <p className="text-sm">
                          This will enable secure command execution
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tools" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Security Testing Tools
                  </CardTitle>
                  <CardDescription>
                    Automated security scanning tools that run in the WSL
                    sandbox environment.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* SQLi Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Bug className="h-5 w-5" />
                        SQL Injection Tests
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {securityTools.slice(0, 2).map((tool) => (
                          <Card
                            key={tool.name}
                            className="p-4 border-l-4"
                            style={{
                              borderLeftColor: tool.name.includes("Good")
                                ? "#10b981"
                                : "#ef4444",
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                {tool.icon}
                                <div>
                                  <h3 className="font-medium">{tool.name}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => simulate(tool)}
                                variant={
                                  sandboxActive ? "default" : "secondary"
                                }
                                disabled={!sandboxActive}
                                size="sm"
                                className={
                                  tool.name.includes("Good")
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-600 hover:bg-red-700"
                                }
                              >
                                Run
                              </Button>
                            </div>
                            {sandboxActive && (
                              <div className="mt-3 p-2 bg-muted rounded text-xs font-mono">
                                {tool.command}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Other Tools Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Other Security Tools
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {securityTools.slice(2).map((tool) => (
                          <Card key={tool.name} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                {tool.icon}
                                <div>
                                  <h3 className="font-medium">{tool.name}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                              <Button
                                onClick={() => simulate(tool)}
                                variant={
                                  sandboxActive ? "default" : "secondary"
                                }
                                disabled={!sandboxActive}
                                size="sm"
                              >
                                Run
                              </Button>
                            </div>
                            {sandboxActive && (
                              <div className="mt-3 p-2 bg-muted rounded text-xs font-mono">
                                {tool.command}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>

                  {currentTool && (
                    <Alert className="mt-4">
                      <Zap className="h-4 w-4" />
                      <AlertDescription>
                        Running {currentTool} scan in WSL sandbox...
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Scan Results
                  </CardTitle>
                  <CardDescription>
                    Results from security scans and vulnerability assessments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scanResults ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{scanResults.tool}</h3>
                        <Badge variant="outline">
                          {new Date(scanResults.timestamp).toLocaleString()}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {scanResults.findings.map(
                          (finding: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-3 border rounded"
                            >
                              <Badge
                                variant={
                                  finding.severity === "high"
                                    ? "destructive"
                                    : finding.severity === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {finding.severity}
                              </Badge>
                              <span className="text-sm">
                                {finding.description}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No scan results available</p>
                      <p className="text-sm">
                        Run a security scan to see results here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}
