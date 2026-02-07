'use client';

import { useState } from 'react';
import {
  Wrench,
  Code2,
  FlaskConical,
  Globe,
  BarChart3,
  Plug,
  FileOutput,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  invokeArchytasTool,
  fetchArchytasSuggestions,
  type ArchytasToolType,
  type ArchytasToolCall,
  type ArchytasSuggestion,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const TOOL_ICONS: Record<ArchytasToolType, typeof Code2> = {
  code_execution: Code2,
  simulation: FlaskConical,
  web_research: Globe,
  data_analysis: BarChart3,
  api_call: Plug,
  file_generation: FileOutput,
};

const TOOL_COLORS: Record<ArchytasToolType, string> = {
  code_execution: 'text-green-400',
  simulation: 'text-purple-400',
  web_research: 'text-blue-400',
  data_analysis: 'text-orange-400',
  api_call: 'text-cyan-400',
  file_generation: 'text-dojo-400',
};

const TOOL_LABELS: Record<ArchytasToolType, string> = {
  code_execution: 'Run Code',
  simulation: 'Simulate',
  web_research: 'Research',
  data_analysis: 'Analyze',
  api_call: 'API Call',
  file_generation: 'Generate File',
};

function StatusIcon({ status }: { status: ArchytasToolCall['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-white/30" />;
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-dojo-400 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'timeout':
      return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
  }
}

interface ArchytasToolPanelProps {
  sessionId: string;
}

export function ArchytasToolPanel({ sessionId }: ArchytasToolPanelProps) {
  const {
    archytasConfig,
    archytasToolCalls,
    addArchytasToolCall,
    updateArchytasToolCall,
    archytasSuggestions,
    setArchytasSuggestions,
  } = useDojoStore();

  const [expanded, setExpanded] = useState(true);
  const [selectedTool, setSelectedTool] = useState<ArchytasToolType | null>(null);
  const [toolInput, setToolInput] = useState('');
  const [isInvoking, setIsInvoking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (!archytasConfig?.enabled) return null;

  const allowedTools = archytasConfig.allowed_tools;
  const callsRemaining = archytasConfig.max_tool_calls_per_session - archytasToolCalls.length;

  const handleInvoke = async () => {
    if (!selectedTool || !toolInput.trim() || isInvoking) return;

    setIsInvoking(true);
    try {
      const result = await invokeArchytasTool(sessionId, selectedTool, toolInput.trim());
      addArchytasToolCall(result.tool_call);
      setToolInput('');
      setSelectedTool(null);
    } catch (err) {
      const errorCall: ArchytasToolCall = {
        id: `err-${Date.now()}`,
        session_id: sessionId,
        tool_type: selectedTool,
        input: toolInput.trim(),
        output: null,
        status: 'failed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        execution_time_ms: 0,
        error: err instanceof Error ? err.message : 'Tool invocation failed',
        sandbox_id: '',
      };
      addArchytasToolCall(errorCall);
    } finally {
      setIsInvoking(false);
    }
  };

  const handleSuggestion = async (suggestion: ArchytasSuggestion) => {
    setSelectedTool(suggestion.tool_type);
    setToolInput(suggestion.suggested_input);
  };

  const loadSuggestions = async () => {
    if (!archytasConfig.auto_suggest) return;
    try {
      const result = await fetchArchytasSuggestions(sessionId, 'current training context');
      setArchytasSuggestions(result.suggestions);
    } catch {
      // Suggestions are best-effort
    }
  };

  return (
    <div className="glass-panel rounded-xl border border-emerald-500/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white/70">Archytas — Tool Master</span>
          {callsRemaining <= 5 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
              {callsRemaining} left
            </span>
          )}
          {archytasToolCalls.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
              {archytasToolCalls.length} call{archytasToolCalls.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-white/20" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white/20" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04]">
          {/* Tool selector */}
          <div className="flex flex-wrap gap-1.5 pt-3">
            {allowedTools.map((tool) => {
              const Icon = TOOL_ICONS[tool];
              const active = selectedTool === tool;
              return (
                <button
                  key={tool}
                  onClick={() => setSelectedTool(active ? null : tool)}
                  disabled={callsRemaining <= 0}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all',
                    active
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60',
                    callsRemaining <= 0 && 'opacity-30 cursor-not-allowed'
                  )}
                >
                  <Icon className={cn('w-3 h-3', active ? TOOL_COLORS[tool] : '')} />
                  {TOOL_LABELS[tool]}
                </button>
              );
            })}
          </div>

          {/* Input area */}
          {selectedTool && callsRemaining > 0 && (
            <div className="space-y-2">
              <textarea
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                placeholder={
                  selectedTool === 'code_execution' ? 'Enter code to execute...' :
                  selectedTool === 'web_research' ? 'Enter search query...' :
                  selectedTool === 'simulation' ? 'Describe simulation parameters...' :
                  selectedTool === 'data_analysis' ? 'Describe the analysis...' :
                  selectedTool === 'api_call' ? 'Enter API endpoint and parameters...' :
                  'Describe what to generate...'
                }
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/15 resize-none focus:border-emerald-500/30 focus:outline-none font-mono text-xs"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/20">
                  Sandbox: {archytasConfig.sandbox_mode} | Max: {archytasConfig.max_execution_time_seconds}s
                </span>
                <button
                  onClick={handleInvoke}
                  disabled={!toolInput.trim() || isInvoking}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isInvoking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Execute
                </button>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {archytasConfig.auto_suggest && archytasSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-white/20 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Suggested Tools
              </p>
              {archytasSuggestions.slice(0, 3).map((s) => {
                const Icon = TOOL_ICONS[s.tool_type];
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSuggestion(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <Icon className={cn('w-3.5 h-3.5', TOOL_COLORS[s.tool_type])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/60 truncate">{s.description}</p>
                    </div>
                    <span className="text-[10px] text-white/20">{Math.round(s.relevance_score * 100)}%</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent tool calls */}
          {archytasToolCalls.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-[10px] text-white/20 hover:text-white/40 flex items-center gap-1 transition-colors"
              >
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {archytasToolCalls.length} tool call{archytasToolCalls.length !== 1 ? 's' : ''}
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {archytasToolCalls.map((tc) => {
                    const Icon = TOOL_ICONS[tc.tool_type];
                    return (
                      <div
                        key={tc.id}
                        className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn('w-3 h-3', TOOL_COLORS[tc.tool_type])} />
                            <span className="text-[11px] text-white/50">{TOOL_LABELS[tc.tool_type]}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {tc.execution_time_ms && (
                              <span className="text-[10px] text-white/15">{tc.execution_time_ms}ms</span>
                            )}
                            <StatusIcon status={tc.status} />
                          </div>
                        </div>
                        <pre className="text-[10px] text-white/25 font-mono truncate">{tc.input}</pre>
                        {tc.output && (
                          <pre className="text-[10px] text-green-400/50 font-mono mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {tc.output}
                          </pre>
                        )}
                        {tc.error && (
                          <p className="text-[10px] text-red-400/60 mt-1">{tc.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
