'use client';

// ============================================================================
// RADIANT Think Tank - Artifact Viewer Component
// apps/admin-dashboard/components/thinktank/artifact-viewer.tsx
// Version: 4.19.0
//
// Displays generated artifacts with real-time generation logs and sandboxed
// preview. The preview uses an iframe with strict CSP for security.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Code,
  RefreshCw,
  X,
  Copy,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ArtifactViewerProps {
  sessionId: string | null;
  onClose: () => void;
}

interface LogEntry {
  id: string;
  log_type: string;
  message: string;
  created_at: string;
}

interface Session {
  id: string;
  status: string;
  verification_status: string;
  final_code: string | null;
  intent_classification: string;
  selected_model: string;
  reflexion_attempts: number;
  total_tokens_used: number;
  estimated_cost: number;
}

export function ArtifactViewer({ sessionId, onClose }: ArtifactViewerProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll for updates
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/thinktank/artifacts/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');

        const data = await response.json();
        if (cancelled) return;

        setSession(data.session);
        setLogs(data.logs);
        setError(null);

        // Continue polling if not complete
        if (!['completed', 'failed', 'rejected'].includes(data.session.status)) {
          setTimeout(poll, 1000);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Render preview when validated
  useEffect(() => {
    if (session?.verification_status === 'validated' && session.final_code && iframeRef.current) {
      const icons = extractLucideIcons(session.final_code);
      const html = buildPreviewHtml(session.final_code, icons);
      iframeRef.current.srcdoc = html;
    }
  }, [session?.verification_status, session?.final_code]);

  const handleCopyCode = useCallback(() => {
    if (session?.final_code) {
      navigator.clipboard.writeText(session.final_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [session?.final_code]);

  const handleDownloadCode = useCallback(() => {
    if (session?.final_code) {
      const blob = new Blob([session.final_code], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artifact-${session.id.slice(0, 8)}.tsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [session]);

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20 text-muted-foreground">
        <div className="text-center">
          <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No artifact selected</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-destructive/10 text-destructive">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <StatusIcon status={session?.status} />
          <span className="font-medium capitalize">{session?.status || 'Loading...'}</span>
          {session?.intent_classification && session.intent_classification !== 'pending' && (
            <Badge variant="outline">{session.intent_classification}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <VerificationBadge status={session?.verification_status} />
          {session?.final_code && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCode(!showCode)}
                title={showCode ? 'Hide code' : 'Show code'}
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyCode}
                title="Copy code"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownloadCode}
                title="Download code"
              >
                <Download className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Logs pane */}
        <div className="w-1/3 border-r flex flex-col min-h-0">
          <div className="p-2 bg-muted/50 border-b text-sm font-medium flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generation Log
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1 text-xs font-mono bg-zinc-900 text-zinc-100 min-h-full">
              {logs.map((log) => (
                <LogLine key={log.id} log={log} />
              ))}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Preview/Code pane */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="p-2 bg-muted/50 border-b">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="code" disabled={!session?.final_code}>
                  Code
                </TabsTrigger>
                <TabsTrigger value="validation" disabled={!session?.cato_validation_result}>
                  Validation
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 m-0 relative">
              {session?.verification_status === 'validated' ? (
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title="Artifact Preview"
                />
              ) : session?.verification_status === 'rejected' ? (
                <div className="flex items-center justify-center h-full bg-destructive/10">
                  <div className="text-center p-4">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                    <p className="text-destructive font-medium">Validation Failed</p>
                    <p className="text-destructive/80 text-sm mt-1">
                      Security checks did not pass after {session?.reflexion_attempts || 3} attempts
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full bg-muted/20">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Generating artifact...</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">
                      {session?.selected_model?.split('/')[1] || 'Loading model...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Draft watermark */}
              {session?.verification_status === 'unverified' && session?.final_code && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-6xl font-bold text-muted/20 transform -rotate-45 select-none">
                    DRAFT
                  </span>
                </div>
              )}
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <pre className="p-4 text-xs font-mono bg-zinc-900 text-zinc-100 min-h-full">
                  <code>{session?.final_code || 'No code generated yet'}</code>
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="validation" className="flex-1 m-0 p-4">
              <ValidationDetails session={session} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Footer with stats */}
      {session && (
        <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
          <span>Tokens: {session.total_tokens_used?.toLocaleString() || 0}</span>
          <span>Cost: ${session.estimated_cost?.toFixed(4) || '0.0000'}</span>
          <span>Reflexion attempts: {session.reflexion_attempts || 0}</span>
        </div>
      )}
    </div>
  );
}

// Sub-components

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'failed':
    case 'rejected':
      return <AlertCircle className="w-5 h-5 text-destructive" />;
    default:
      return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  }
}

function VerificationBadge({ status }: { status?: string }) {
  switch (status) {
    case 'validated':
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" /> Verified
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">
          <RefreshCw className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
  }
}

function LogLine({ log }: { log: LogEntry }) {
  const colorClass: Record<string, string> = {
    error: 'text-red-400',
    success: 'text-green-400',
    thinking: 'text-blue-400',
    reflexion: 'text-yellow-400',
    planning: 'text-zinc-300',
    generating: 'text-zinc-300',
    validating: 'text-purple-400',
  };

  return (
    <div className={colorClass[log.log_type] || 'text-zinc-300'}>
      <span className="text-zinc-500">
        [{new Date(log.created_at).toLocaleTimeString()}]
      </span>{' '}
      {log.message}
    </div>
  );
}

function ValidationDetails({ session }: { session: Session | null }) {
  if (!session) return null;

  const validation = (session as unknown as { cato_validation_result?: {
    passedCBFs: string[];
    failedCBFs: string[];
    warnings: Array<{ rule: string; message: string }>;
    securityScore: number;
  } }).cato_validation_result;

  if (!validation) {
    return <p className="text-muted-foreground">No validation data available</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Security Score</h4>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${
                validation.securityScore >= 0.8
                  ? 'bg-green-500'
                  : validation.securityScore >= 0.5
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${validation.securityScore * 100}%` }}
            />
          </div>
          <span className="text-sm font-mono">{(validation.securityScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-2 text-green-500">Passed CBFs ({validation.passedCBFs.length})</h4>
        <ul className="text-sm space-y-1">
          {validation.passedCBFs.map((cbf) => (
            <li key={cbf} className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {cbf}
            </li>
          ))}
        </ul>
      </div>

      {validation.failedCBFs.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-red-500">Failed CBFs ({validation.failedCBFs.length})</h4>
          <ul className="text-sm space-y-1">
            {validation.failedCBFs.map((cbf) => (
              <li key={cbf} className="flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-red-500" />
                {cbf}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-yellow-500">Warnings ({validation.warnings.length})</h4>
          <ul className="text-sm space-y-1">
            {validation.warnings.map((warning, i) => (
              <li key={i} className="text-yellow-500/80">
                {warning.rule}: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper functions

function extractLucideIcons(code: string): string {
  const iconRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]lucide-react['"]/;
  const match = code.match(iconRegex);
  return match ? match[1].trim() : '';
}

function buildPreviewHtml(code: string, icons: string): string {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    ${icons ? '<script src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.min.js"></script>' : ''}
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; }
    </style>
</head>
<body class="bg-gray-50 p-4">
    <div id="root"></div>
    <script type="text/babel">
        ${icons ? `const { ${icons} } = window.LucideReact || {};` : ''}
        ${code}
        
        // Find and render the default export
        const Component = (() => {
            if (typeof exports !== 'undefined' && exports.default) return exports.default;
            if (typeof module !== 'undefined' && module.exports?.default) return module.exports.default;
            const possibleComponents = Object.keys(window).filter(k => /^[A-Z]/.test(k) && typeof window[k] === 'function');
            if (possibleComponents.length > 0) return window[possibleComponents[possibleComponents.length - 1]];
            return null;
        })();
        
        if (Component) {
            ReactDOM.render(
                React.createElement(Component),
                document.getElementById('root')
            );
        } else {
            document.getElementById('root').innerHTML = '<p style="color: red;">Could not find component to render</p>';
        }
    </script>
</body>
</html>`;
}

export default ArtifactViewer;
