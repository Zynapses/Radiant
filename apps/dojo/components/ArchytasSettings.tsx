'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Loader2,
  Code2,
  FlaskConical,
  Globe,
  BarChart3,
  Plug,
  FileOutput,
  Shield,
  ShieldAlert,
  ShieldOff,
  Zap,
  Clock,
  Hash,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  fetchArchytasConfig,
  updateArchytasConfig,
  type ArchytasConfig,
  type ArchytasToolType,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

const TOOL_META: Record<ArchytasToolType, { label: string; icon: typeof Code2; color: string; description: string }> = {
  code_execution:  { label: 'Code Execution',   icon: Code2,        color: 'text-green-400',  description: 'Run Python, JS, SQL snippets in a sandboxed environment' },
  simulation:      { label: 'Simulations',       icon: FlaskConical, color: 'text-purple-400', description: 'Monte Carlo, agent-based, or scenario simulations' },
  web_research:    { label: 'Web Research',       icon: Globe,        color: 'text-blue-400',   description: 'Search and synthesize external information' },
  data_analysis:   { label: 'Data Analysis',      icon: BarChart3,    color: 'text-orange-400', description: 'Statistical analysis, charting, and data transformation' },
  api_call:        { label: 'API Calls',          icon: Plug,         color: 'text-cyan-400',   description: 'Call external APIs for live data (weather, stocks, etc.)' },
  file_generation: { label: 'File Generation',    icon: FileOutput,   color: 'text-dojo-400',   description: 'Generate PDFs, CSVs, or other downloadable artifacts' },
};

const SANDBOX_META: Record<string, { label: string; icon: typeof Shield; color: string; description: string }> = {
  strict:     { label: 'Strict',     icon: Shield,      color: 'text-green-400',  description: 'No network, no file system — pure computation only' },
  standard:   { label: 'Standard',   icon: ShieldAlert, color: 'text-yellow-400', description: 'Limited network for research, sandboxed file system' },
  permissive: { label: 'Permissive', icon: ShieldOff,   color: 'text-red-400',    description: 'Full network and file access — for trusted environments only' },
};

export function ArchytasSettings() {
  const { tenantId, archytasConfig, setArchytasConfig } = useDojoStore();
  const queryClient = useQueryClient();
  const delight = useRadiantDelightOptional();

  const { data, isLoading } = useQuery({
    queryKey: ['archytas-config', tenantId],
    queryFn: () => fetchArchytasConfig(tenantId),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (data?.config) setArchytasConfig(data.config);
  }, [data, setArchytasConfig]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<ArchytasConfig>) => updateArchytasConfig(tenantId, updates),
    onSuccess: (data) => {
      setArchytasConfig(data.config);
      queryClient.invalidateQueries({ queryKey: ['archytas-config'] });
      delight?.triggerDelight('action_complete');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const config = archytasConfig || data?.config;

  const toggleTool = (tool: ArchytasToolType) => {
    if (!config) return;
    const current = config.allowed_tools;
    const next = current.includes(tool)
      ? current.filter((t) => t !== tool)
      : [...current, tool];
    updateMutation.mutate({ allowed_tools: next });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Archytas — The Tool Master</h2>
            <p className="text-xs text-white/30">
              Give your Dojo sessions access to code execution, simulations, and live research
            </p>
          </div>
        </div>
      </div>

      {/* Master toggle */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className={cn('w-5 h-5', config?.enabled ? 'text-green-400' : 'text-white/20')} />
            <div>
              <p className="text-sm font-semibold text-white">Enable Archytas</p>
              <p className="text-[10px] text-white/30">
                When enabled, training sessions can invoke tools for code execution, research, and simulations
              </p>
            </div>
          </div>
          <button
            onClick={() => updateMutation.mutate({ enabled: !config?.enabled })}
            disabled={updateMutation.isPending}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              config?.enabled ? 'bg-green-500' : 'bg-white/10'
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              config?.enabled ? 'translate-x-6' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      </div>

      {!config?.enabled && (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/40">Archytas is Disabled</h3>
          <p className="text-sm text-white/25 mt-1">
            Enable the toggle above to configure tool access for training sessions
          </p>
        </div>
      )}

      {config?.enabled && (
        <>
          {/* Allowed Tools */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Allowed Tools</h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(TOOL_META) as [ArchytasToolType, typeof TOOL_META[ArchytasToolType]][]).map(
                ([key, meta]) => {
                  const active = config.allowed_tools.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTool(key)}
                      disabled={updateMutation.isPending}
                      className={cn(
                        'glass-panel rounded-xl p-4 text-left transition-all',
                        active
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'hover:bg-white/[0.03] opacity-50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <meta.icon className={cn('w-4 h-4', active ? meta.color : 'text-white/20')} />
                          <span className={cn('text-sm font-medium', active ? 'text-white' : 'text-white/40')}>
                            {meta.label}
                          </span>
                        </div>
                        {active && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                      </div>
                      <p className="text-[10px] text-white/30 leading-relaxed">{meta.description}</p>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Sandbox Mode */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Sandbox Mode</h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(SANDBOX_META) as [string, typeof SANDBOX_META[string]][]).map(
                ([key, meta]) => {
                  const active = config.sandbox_mode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => updateMutation.mutate({ sandbox_mode: key as ArchytasConfig['sandbox_mode'] })}
                      disabled={updateMutation.isPending}
                      className={cn(
                        'glass-panel rounded-xl p-4 text-center transition-all',
                        active
                          ? 'border-dojo-500/30 bg-dojo-500/5'
                          : 'hover:bg-white/[0.03]'
                      )}
                    >
                      <meta.icon className={cn('w-5 h-5 mx-auto mb-2', active ? meta.color : 'text-white/20')} />
                      <p className={cn('text-sm font-medium', active ? 'text-white' : 'text-white/40')}>
                        {meta.label}
                      </p>
                      <p className="text-[10px] text-white/25 mt-1">{meta.description}</p>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Limits */}
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Limits</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/30" />
                <span className="text-sm text-white/60">Max Execution Time</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={config.max_execution_time_seconds}
                  onChange={(e) => updateMutation.mutate({ max_execution_time_seconds: Number(e.target.value) })}
                  className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-sm text-white text-right focus:border-dojo-500/40 focus:outline-none"
                />
                <span className="text-xs text-white/30">seconds</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-white/30" />
                <span className="text-sm text-white/60">Max Tool Calls per Session</span>
              </div>
              <input
                type="number"
                min={1}
                max={100}
                value={config.max_tool_calls_per_session}
                onChange={(e) => updateMutation.mutate({ max_tool_calls_per_session: Number(e.target.value) })}
                className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-sm text-white text-right focus:border-dojo-500/40 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-white/30" />
                <span className="text-sm text-white/60">Auto-Suggest Tools</span>
              </div>
              <button
                onClick={() => updateMutation.mutate({ auto_suggest: !config.auto_suggest })}
                disabled={updateMutation.isPending}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  config.auto_suggest ? 'bg-dojo-500' : 'bg-white/10'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  config.auto_suggest ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          </div>

          {/* Languages */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Supported Languages (Code Execution)</h3>
            <div className="flex flex-wrap gap-2">
              {['python', 'javascript', 'typescript', 'sql', 'r', 'bash', 'rust', 'go'].map((lang) => {
                const active = config.languages?.includes(lang);
                return (
                  <button
                    key={lang}
                    onClick={() => {
                      const next = active
                        ? (config.languages || []).filter((l) => l !== lang)
                        : [...(config.languages || []), lang];
                      updateMutation.mutate({ languages: next });
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                      active
                        ? 'border-green-500/30 bg-green-500/10 text-green-400'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/50'
                    )}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
