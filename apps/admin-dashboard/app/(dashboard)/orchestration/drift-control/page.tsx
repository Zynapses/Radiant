'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Shield, ShieldOff, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Gauge, Brain, BarChart3, Zap, Scale, Clock, Wifi,
  DollarSign, ChevronDown, ChevronUp, Layers, Lock, Unlock, Eye,
  Settings2, Heart, Thermometer, HelpCircle,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type RadiantApp = 'genesis' | 'cato' | 'cortex' | 'omega' | 'orchestrator' | 'thinktank' | 'curator';

interface AppWeightProfile {
  app: RadiantApp;
  driftWeight: number;
  qualityWeight: number;
  latencyWeight: number;
  costWeight: number;
  availabilityWeight: number;
  minAcceptableDriftScore: number;
  preferStableModels: boolean;
}

interface DriftSummary {
  tenantId: string;
  totalModels: number;
  healthyModels: number;
  driftWarningModels: number;
  quarantinedModels: number;
  avgDriftScore: number;
  worstModel: { modelId: string; driftScore: number } | null;
  lastCheckAt: string;
}

interface DriftAwareModelRecommendation {
  modelId: string;
  compositeScore: number;
  driftScore: number;
  qualityScore: number;
  latencyScore: number;
  costScore: number;
  availabilityScore: number;
  isQuarantined: boolean;
  hasDriftWarning: boolean;
  driftTrend: 'stable' | 'improving' | 'degrading' | 'unknown';
  fallbackModelId?: string;
  temperatureAdjustment?: number;
  promptPrefixCorrection?: string;
  manualOverride: boolean;
}

interface GenesisGateHealth {
  stage: string;
  healthy: boolean;
  avgDriftScore: number;
  quarantinedModels: number;
  reason?: string;
}

interface FullDriftCheckResult {
  modelsChecked: number;
  driftDetected: number;
  correctionsApplied: number;
  quarantined: number;
  results: Array<{ modelId: string; driftScore: number; action: string }>;
}

// =============================================================================
// API
// =============================================================================

const API_BASE = '/api/admin/drift-control';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// =============================================================================
// App metadata
// =============================================================================

const APP_META: Record<RadiantApp, { label: string; description: string; icon: React.ElementType; color: string }> = {
  genesis: { label: 'Genesis', description: 'Developmental safety gates', icon: Heart, color: 'text-pink-400' },
  cato: { label: 'Cato', description: 'Pipeline method execution', icon: Shield, color: 'text-blue-400' },
  cortex: { label: 'Cortex', description: 'Knowledge graph intelligence', icon: Brain, color: 'text-purple-400' },
  omega: { label: 'Omega', description: 'Shadow mode comparison', icon: Eye, color: 'text-cyan-400' },
  orchestrator: { label: 'Orchestrator', description: 'AGI model routing', icon: Layers, color: 'text-indigo-400' },
  thinktank: { label: 'Think Tank', description: 'User-facing AI chat', icon: Zap, color: 'text-amber-400' },
  curator: { label: 'Curator', description: 'Content curation', icon: BarChart3, color: 'text-emerald-400' },
};

const FACTOR_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  drift: { icon: Activity, color: 'text-cyan-400' },
  quality: { icon: Brain, color: 'text-purple-400' },
  latency: { icon: Clock, color: 'text-amber-400' },
  cost: { icon: DollarSign, color: 'text-emerald-400' },
  availability: { icon: Wifi, color: 'text-blue-400' },
};

// =============================================================================
// Components
// =============================================================================

function HealthRing({ score, size = 120 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * (size / 2 - 8);
  const strokeDash = circumference * score;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="none" stroke="#334155" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-white">{pct}%</div>
        <div className="text-xs text-slate-400">Health</div>
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving': return <span className="flex items-center gap-1 text-xs text-emerald-400"><TrendingUp className="h-3 w-3" /> Improving</span>;
    case 'degrading': return <span className="flex items-center gap-1 text-xs text-red-400"><TrendingDown className="h-3 w-3" /> Degrading</span>;
    case 'stable': return <span className="flex items-center gap-1 text-xs text-slate-400"><Minus className="h-3 w-3" /> Stable</span>;
    default: return <span className="flex items-center gap-1 text-xs text-slate-500"><HelpCircle className="h-3 w-3" /> Unknown</span>;
  }
}

function WeightBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-400">{label}</span>
          <span className="text-slate-300 font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function AppProfileCard({
  profile,
  recommendations,
  onEdit,
}: {
  profile: AppWeightProfile;
  recommendations: DriftAwareModelRecommendation[];
  onEdit: (app: RadiantApp, updates: Partial<AppWeightProfile>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localWeights, setLocalWeights] = useState({ ...profile });
  const meta = APP_META[profile.app];
  const Icon = meta.icon;
  const topModel = recommendations[0];

  return (
    <div className="border border-slate-700/50 bg-slate-800/30 rounded-xl overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-800 ${meta.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-white">{meta.label}</div>
              <div className="text-xs text-slate-400">{meta.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {topModel && (
              <div className="text-right hidden sm:block">
                <div className="text-xs text-slate-400">Best model</div>
                <div className="text-sm text-white font-mono">{topModel.modelId.split('/').pop()}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-xs text-slate-400">Min Drift</div>
              <div className="text-sm font-bold text-white">{Math.round(profile.minAcceptableDriftScore * 100)}%</div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          <WeightBar label="Drift" value={profile.driftWeight} icon={Activity} color="text-cyan-400" />
          <WeightBar label="Quality" value={profile.qualityWeight} icon={Brain} color="text-purple-400" />
          <WeightBar label="Latency" value={profile.latencyWeight} icon={Clock} color="text-amber-400" />
          <WeightBar label="Cost" value={profile.costWeight} icon={DollarSign} color="text-emerald-400" />
          <WeightBar label="Avail" value={profile.availabilityWeight} icon={Wifi} color="text-blue-400" />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400">
              Prefer stable: {profile.preferStableModels ? <span className="text-emerald-400">Yes</span> : <span className="text-slate-500">No</span>}
            </span>
            <span className="text-slate-600">|</span>
            <button onClick={(e) => { e.stopPropagation(); setEditing(!editing); }}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> {editing ? 'Cancel' : 'Edit Weights'}
            </button>
          </div>

          {editing && (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-5 gap-3">
                {(['driftWeight', 'qualityWeight', 'latencyWeight', 'costWeight', 'availabilityWeight'] as const).map(key => {
                  const label = key.replace('Weight', '');
                  return (
                    <div key={key}>
                      <label className="text-xs text-slate-400 capitalize">{label}</label>
                      <input type="number" step="0.05" min="0" max="1"
                        value={localWeights[key]}
                        onChange={(e) => setLocalWeights({ ...localWeights, [key]: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Min Drift Score</label>
                  <input type="number" step="0.05" min="0" max="1"
                    value={localWeights.minAcceptableDriftScore}
                    onChange={(e) => setLocalWeights({ ...localWeights, minAcceptableDriftScore: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={localWeights.preferStableModels}
                      onChange={(e) => setLocalWeights({ ...localWeights, preferStableModels: e.target.checked })}
                      className="rounded border-slate-600" />
                    Prefer stable models
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Sum: {(localWeights.driftWeight + localWeights.qualityWeight + localWeights.latencyWeight + localWeights.costWeight + localWeights.availabilityWeight).toFixed(2)}
                </span>
                <button onClick={() => {
                  const sum = localWeights.driftWeight + localWeights.qualityWeight + localWeights.latencyWeight + localWeights.costWeight + localWeights.availabilityWeight;
                  if (Math.abs(sum - 1.0) > 0.01) { alert('Factor weights must sum to 1.0'); return; }
                  onEdit(profile.app, localWeights);
                  setEditing(false);
                }}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
                  Save Profile
                </button>
              </div>
            </div>
          )}

          {recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Top Model Recommendations</h4>
              <div className="space-y-1.5">
                {recommendations.slice(0, 5).map((rec, i) => (
                  <div key={rec.modelId} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-4">{i + 1}.</span>
                      <span className="text-sm text-white">{rec.modelId}</span>
                      {rec.isQuarantined && <Lock className="h-3 w-3 text-red-400" />}
                      {rec.hasDriftWarning && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                      {rec.manualOverride && <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1 rounded">Override</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <TrendBadge trend={rec.driftTrend} />
                      <span className="text-xs text-slate-400">Drift: <span className={`font-mono ${rec.driftScore >= 0.7 ? 'text-emerald-400' : rec.driftScore >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(rec.driftScore * 100)}%</span></span>
                      <span className={`text-sm font-bold font-mono ${rec.compositeScore >= 0.7 ? 'text-emerald-400' : rec.compositeScore >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                        {Math.round(rec.compositeScore * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GenesisGateCard({ health }: { health: GenesisGateHealth }) {
  const stageColors: Record<string, string> = {
    EMBRYONIC: 'text-slate-400',
    NASCENT: 'text-blue-400',
    DEVELOPING: 'text-amber-400',
    MATURING: 'text-purple-400',
    MATURE: 'text-emerald-400',
  };

  return (
    <div className={`border rounded-xl p-4 ${health.healthy ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-red-500/30 bg-red-950/10'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Thermometer className={`h-4 w-4 ${stageColors[health.stage] || 'text-slate-400'}`} />
          <span className={`text-sm font-medium ${stageColors[health.stage] || 'text-white'}`}>{health.stage}</span>
        </div>
        {health.healthy ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400"><Shield className="h-3 w-3" /> Healthy</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400"><ShieldOff className="h-3 w-3" /> Blocked</span>
        )}
      </div>
      <div className="text-xs text-slate-400 space-y-1">
        <div>Avg drift: <span className="text-white font-mono">{Math.round(health.avgDriftScore * 100)}%</span></div>
        <div>Quarantined: <span className="text-white font-mono">{health.quarantinedModels}</span></div>
        {health.reason && <div className="text-red-400 mt-1">{health.reason}</div>}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function DriftControlPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles' | 'genesis'>('overview');
  const [summary, setSummary] = useState<DriftSummary | null>(null);
  const [profiles, setProfiles] = useState<AppWeightProfile[]>([]);
  const [appRecommendations, setAppRecommendations] = useState<Record<string, DriftAwareModelRecommendation[]>>({});
  const [genesisHealth, setGenesisHealth] = useState<GenesisGateHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkResult, setCheckResult] = useState<FullDriftCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [summaryData, profilesData, genesisData] = await Promise.all([
        fetchApi<DriftSummary>('/summary'),
        fetchApi<AppWeightProfile[]>('/profiles'),
        fetchApi<GenesisGateHealth[]>('/genesis-health'),
      ]);
      setSummary(summaryData);
      setProfiles(profilesData);
      setGenesisHealth(genesisData);

      // Load recommendations for each app
      const recs: Record<string, DriftAwareModelRecommendation[]> = {};
      for (const profile of profilesData) {
        try {
          const result = await fetchApi<{ recommendations: DriftAwareModelRecommendation[] }>(
            `/recommend/${profile.app}`
          );
          recs[profile.app] = result.recommendations;
        } catch {
          recs[profile.app] = [];
        }
      }
      setAppRecommendations(recs);
    } catch (err) {
      console.error('Failed to load drift control data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFullDriftCheck = async () => {
    setChecking(true);
    try {
      const result = await fetchApi<FullDriftCheckResult>('/run-full-check', { method: 'POST' });
      setCheckResult(result);
      await loadData();
    } catch (err) {
      console.error('Full drift check failed', err);
    } finally {
      setChecking(false);
    }
  };

  const handleEditProfile = async (app: RadiantApp, updates: Partial<AppWeightProfile>) => {
    try {
      await fetchApi(`/profiles/${app}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      await loadData();
    } catch (err) {
      console.error('Failed to update profile', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="h-7 w-7 text-cyan-400" />
            Drift Control Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Unified drift-aware weighting for all AI components — Genesis, Cato, Cortex, Omega
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleFullDriftCheck} disabled={checking}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
            {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Run Full Drift Check
          </button>
          <button onClick={loadData}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Check Result Banner */}
      {checkResult && (
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cyan-400">Full Drift Check Complete</h3>
            <button onClick={() => setCheckResult(null)} className="text-xs text-slate-400 hover:text-white">Dismiss</button>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-3">
            <div><span className="text-2xl font-bold text-white">{checkResult.modelsChecked}</span><div className="text-xs text-slate-400">Checked</div></div>
            <div><span className="text-2xl font-bold text-amber-400">{checkResult.driftDetected}</span><div className="text-xs text-slate-400">Drift Detected</div></div>
            <div><span className="text-2xl font-bold text-blue-400">{checkResult.correctionsApplied}</span><div className="text-xs text-slate-400">Corrections</div></div>
            <div><span className="text-2xl font-bold text-red-400">{checkResult.quarantined}</span><div className="text-xs text-slate-400">Quarantined</div></div>
          </div>
        </div>
      )}

      {/* Health Summary */}
      {summary && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 flex flex-col items-center justify-center">
            <HealthRing score={summary.avgDriftScore} />
            <div className="text-xs text-slate-400 mt-2">Average Drift Score</div>
          </div>
          <div className="col-span-9 grid grid-cols-4 gap-4">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Scale className="h-4 w-4 text-blue-400" /><span className="text-xs text-slate-400">Total Models</span></div>
              <div className="text-3xl font-bold text-white">{summary.totalModels}</div>
            </div>
            <div className="bg-slate-800/30 border border-emerald-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-emerald-400" /><span className="text-xs text-slate-400">Healthy</span></div>
              <div className="text-3xl font-bold text-emerald-400">{summary.healthyModels}</div>
            </div>
            <div className="bg-slate-800/30 border border-amber-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-400" /><span className="text-xs text-slate-400">Drift Warning</span></div>
              <div className="text-3xl font-bold text-amber-400">{summary.driftWarningModels}</div>
            </div>
            <div className="bg-slate-800/30 border border-red-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Lock className="h-4 w-4 text-red-400" /><span className="text-xs text-slate-400">Quarantined</span></div>
              <div className="text-3xl font-bold text-red-400">{summary.quarantinedModels}</div>
            </div>
            {summary.worstModel && (
              <div className="col-span-4 bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-slate-400">Worst performing model:</span>
                  <span className="text-sm text-white font-mono">{summary.worstModel.modelId}</span>
                </div>
                <span className={`text-sm font-bold font-mono ${summary.worstModel.driftScore >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                  {Math.round(summary.worstModel.driftScore * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {([
          { key: 'overview' as const, label: 'Overview' },
          { key: 'profiles' as const, label: 'App Weight Profiles' },
          { key: 'genesis' as const, label: 'Genesis Gate Health' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${activeTab === tab.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">How Drift Control Works</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <Activity className="h-6 w-6 text-cyan-400 mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">1. Detection</h3>
              <p className="text-xs text-slate-400">
                Statistical tests (KS, PSI, Chi-squared, Embedding Distance) compare current model output distributions against reference baselines.
              </p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <Scale className="h-6 w-6 text-blue-400 mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">2. Correction</h3>
              <p className="text-xs text-slate-400">
                Models with drift receive weight penalties, temperature adjustments, or quarantine. Fallback models activate automatically.
              </p>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <Layers className="h-6 w-6 text-indigo-400 mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">3. App Routing</h3>
              <p className="text-xs text-slate-400">
                Each app (Genesis, Cato, Cortex, Omega) has tuned weight profiles. Models are ranked by composite score per app.
              </p>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Integration Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(APP_META) as RadiantApp[]).map(app => {
                const meta = APP_META[app];
                const Icon = meta.icon;
                const recs = appRecommendations[app] || [];
                return (
                  <div key={app} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <span className="text-sm text-white">{meta.label}</span>
                    <span className="ml-auto text-xs text-emerald-400">{recs.length > 0 ? `${recs.length} models` : 'Active'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* App Weight Profiles Tab */}
      {activeTab === 'profiles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">App Weight Profiles</h2>
            <span className="text-xs text-slate-400">Each app has tuned drift sensitivity. Click to expand and edit.</span>
          </div>
          {profiles.map(profile => (
            <AppProfileCard key={profile.app} profile={profile}
              recommendations={appRecommendations[profile.app] || []}
              onEdit={handleEditProfile} />
          ))}
        </div>
      )}

      {/* Genesis Gate Health Tab */}
      {activeTab === 'genesis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Genesis Developmental Gate Health</h2>
            <span className="text-xs text-slate-400">Stage advancement requires healthy drift scores</span>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <p className="text-sm text-slate-300 mb-4">
              Genesis gates control AI capability advancement through developmental stages. Each stage has minimum drift health requirements.
              Higher stages require stricter drift control — MATURE stage requires ≥70% average drift score and zero quarantined models.
            </p>
            <div className="grid grid-cols-5 gap-3">
              {genesisHealth.length > 0 ? (
                genesisHealth.map(gate => (
                  <GenesisGateCard key={gate.stage} health={gate} />
                ))
              ) : (
                ['EMBRYONIC', 'NASCENT', 'DEVELOPING', 'MATURING', 'MATURE'].map(stage => (
                  <GenesisGateCard key={stage} health={{
                    stage,
                    healthy: true,
                    avgDriftScore: summary?.avgDriftScore ?? 1.0,
                    quarantinedModels: summary?.quarantinedModels ?? 0,
                  }} />
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Stage Requirements</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="text-left pb-2">Stage</th>
                  <th className="text-right pb-2">Min Avg Drift</th>
                  <th className="text-right pb-2">Max Quarantined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {[
                  { stage: 'EMBRYONIC', minDrift: 0.3, maxQ: 5 },
                  { stage: 'NASCENT', minDrift: 0.4, maxQ: 3 },
                  { stage: 'DEVELOPING', minDrift: 0.5, maxQ: 2 },
                  { stage: 'MATURING', minDrift: 0.6, maxQ: 1 },
                  { stage: 'MATURE', minDrift: 0.7, maxQ: 0 },
                ].map(req => (
                  <tr key={req.stage}>
                    <td className="py-2 text-white">{req.stage}</td>
                    <td className="py-2 text-right font-mono text-slate-300">{Math.round(req.minDrift * 100)}%</td>
                    <td className="py-2 text-right font-mono text-slate-300">{req.maxQ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
