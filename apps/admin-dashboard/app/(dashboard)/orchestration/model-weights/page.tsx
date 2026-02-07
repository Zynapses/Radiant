'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Scale, AlertTriangle, Shield, ShieldOff, RefreshCw, TrendingUp, TrendingDown,
  Activity, Gauge, Sliders, History, ChevronDown, ChevronUp, Lock, Unlock,
  Zap, DollarSign, Clock, Wifi, Brain, BarChart3, Settings2, Play,
} from 'lucide-react';

interface ModelWeightConfig {
  id: string;
  tenantId: string;
  modelId: string;
  manualWeightOverride: number | null;
  driftFactorWeight: number;
  qualityFactorWeight: number;
  latencyFactorWeight: number;
  costFactorWeight: number;
  availabilityFactorWeight: number;
  currentDriftScore: number;
  currentQualityScore: number;
  currentLatencyScore: number;
  currentCostScore: number;
  currentAvailabilityScore: number;
  currentCompositeWeight: number;
  driftQuarantineThreshold: number;
  driftPenaltyThreshold: number;
  driftAutoQuarantine: boolean;
  driftAutoFallbackModelId: string | null;
  isQuarantined: boolean;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  quarantineExpiresAt: string | null;
  lastWeightCalculationAt: string | null;
  lastDriftCheckAt: string | null;
}

interface CorrectionAction {
  id: string;
  modelId: string;
  actionType: string;
  triggerType: string;
  reason: string;
  createdAt: string;
}

interface Dashboard {
  models: ModelWeightConfig[];
  recentActions: CorrectionAction[];
  quarantinedCount: number;
  averageCompositeWeight: number;
  driftAlertCount: number;
  weightHistory: Array<{ modelId: string; compositeWeight: number; createdAt: string }>;
}

const API_BASE = '/api/admin/model-weights';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function ScoreBar({ score, label, icon: Icon, color }: { score: number; label: string; icon: React.ElementType; color: string }) {
  const pct = Math.round(score * 100);
  const barColor = score >= 0.7 ? 'bg-emerald-500' : score >= 0.4 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{label}</span>
          <span className="text-slate-300 font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function ModelCard({
  model,
  onQuarantine,
  onUnquarantine,
  onCheckDrift,
  onRecalculate,
  onUpdateConfig,
}: {
  model: ModelWeightConfig;
  onQuarantine: (modelId: string) => void;
  onUnquarantine: (modelId: string) => void;
  onCheckDrift: (modelId: string) => void;
  onRecalculate: (modelId: string) => void;
  onUpdateConfig: (modelId: string, updates: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [factorWeights, setFactorWeights] = useState({
    drift: model.driftFactorWeight,
    quality: model.qualityFactorWeight,
    latency: model.latencyFactorWeight,
    cost: model.costFactorWeight,
    availability: model.availabilityFactorWeight,
  });

  const compositePct = Math.round(model.currentCompositeWeight * 100);
  const compositeColor = model.isQuarantined ? 'text-red-400' : compositePct >= 70 ? 'text-emerald-400' : compositePct >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${model.isQuarantined ? 'border-red-500/50 bg-red-950/20' : 'border-slate-700/50 bg-slate-800/30'}`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {model.isQuarantined ? (
              <Lock className="h-5 w-5 text-red-400" />
            ) : (
              <Scale className="h-5 w-5 text-blue-400" />
            )}
            <div>
              <div className="font-medium text-white">{model.modelId}</div>
              <div className="text-xs text-slate-400">
                {model.isQuarantined ? (
                  <span className="text-red-400">Quarantined{model.quarantineExpiresAt ? ` until ${new Date(model.quarantineExpiresAt).toLocaleString()}` : ''}</span>
                ) : model.manualWeightOverride != null ? (
                  <span className="text-purple-400">Manual override: {Math.round(model.manualWeightOverride * 100)}%</span>
                ) : (
                  <span>Auto-weighted</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-bold font-mono ${compositeColor}`}>
              {model.isQuarantined ? '0%' : `${compositePct}%`}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          <ScoreBar score={model.currentDriftScore} label="Drift" icon={Activity} color="text-cyan-400" />
          <ScoreBar score={model.currentQualityScore} label="Quality" icon={Brain} color="text-purple-400" />
          <ScoreBar score={model.currentLatencyScore} label="Latency" icon={Clock} color="text-amber-400" />
          <ScoreBar score={model.currentCostScore} label="Cost" icon={DollarSign} color="text-emerald-400" />
          <ScoreBar score={model.currentAvailabilityScore} label="Avail" icon={Wifi} color="text-blue-400" />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); onCheckDrift(model.modelId); }}
              className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1">
              <Activity className="h-3 w-3" /> Check Drift
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRecalculate(model.modelId); }}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Recalculate
            </button>
            {model.isQuarantined ? (
              <button onClick={(e) => { e.stopPropagation(); onUnquarantine(model.modelId); }}
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1">
                <Unlock className="h-3 w-3" /> Unquarantine
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onQuarantine(model.modelId); }}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-1">
                <Lock className="h-3 w-3" /> Quarantine
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setEditing(!editing); }}
              className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded-lg flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> {editing ? 'Close' : 'Configure'}
            </button>
          </div>

          {editing && (
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-semibold text-white">Factor Weights (must sum to 1.0)</h4>
              <div className="grid grid-cols-5 gap-3">
                {(['drift', 'quality', 'latency', 'cost', 'availability'] as const).map(factor => (
                  <div key={factor}>
                    <label className="text-xs text-slate-400 capitalize">{factor}</label>
                    <input
                      type="number" step="0.05" min="0" max="1"
                      value={factorWeights[factor]}
                      onChange={(e) => setFactorWeights({ ...factorWeights, [factor]: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Sum: {Object.values(factorWeights).reduce((a, b) => a + b, 0).toFixed(2)}
                </span>
                <button
                  onClick={() => {
                    const sum = Object.values(factorWeights).reduce((a, b) => a + b, 0);
                    if (Math.abs(sum - 1.0) > 0.01) { alert('Factor weights must sum to 1.0'); return; }
                    onUpdateConfig(model.modelId, {
                      driftFactorWeight: factorWeights.drift,
                      qualityFactorWeight: factorWeights.quality,
                      latencyFactorWeight: factorWeights.latency,
                      costFactorWeight: factorWeights.cost,
                      availabilityFactorWeight: factorWeights.availability,
                    });
                  }}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  Save Weights
                </button>
              </div>

              <h4 className="text-sm font-semibold text-white mt-4">Drift Correction Settings</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Quarantine Threshold</label>
                  <input type="number" step="0.05" min="0" max="1" defaultValue={model.driftQuarantineThreshold}
                    onBlur={(e) => onUpdateConfig(model.modelId, { driftQuarantineThreshold: parseFloat(e.target.value) })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Penalty Threshold</label>
                  <input type="number" step="0.05" min="0" max="1" defaultValue={model.driftPenaltyThreshold}
                    onBlur={(e) => onUpdateConfig(model.modelId, { driftPenaltyThreshold: parseFloat(e.target.value) })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Fallback Model</label>
                  <input type="text" defaultValue={model.driftAutoFallbackModelId || ''}
                    placeholder="e.g., anthropic/claude-3-haiku"
                    onBlur={(e) => onUpdateConfig(model.modelId, { driftAutoFallbackModelId: e.target.value || null })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" defaultChecked={model.driftAutoQuarantine}
                    onChange={(e) => onUpdateConfig(model.modelId, { driftAutoQuarantine: e.target.checked })}
                    className="rounded border-slate-600" />
                  Auto-quarantine on drift
                </label>
              </div>

              <h4 className="text-sm font-semibold text-white mt-4">Manual Override</h4>
              <div className="flex items-center gap-3">
                <input type="number" step="0.05" min="0" max="1"
                  defaultValue={model.manualWeightOverride ?? ''}
                  placeholder="Leave empty for auto"
                  onBlur={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : null;
                    onUpdateConfig(model.modelId, { manualWeightOverride: val });
                  }}
                  className="w-48 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm" />
                <span className="text-xs text-slate-500">Set to override auto-calculation (0.0 - 1.0)</span>
              </div>

              {model.lastDriftCheckAt && (
                <div className="text-xs text-slate-500 mt-2">
                  Last drift check: {new Date(model.lastDriftCheckAt).toLocaleString()}
                  {model.lastWeightCalculationAt && ` | Last weight calc: ${new Date(model.lastWeightCalculationAt).toLocaleString()}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModelWeightsPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'models' | 'actions' | 'history'>('models');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchApi('/dashboard');
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleQuarantine = async (modelId: string) => {
    const reason = prompt('Quarantine reason:');
    if (!reason) return;
    setActionLoading(modelId);
    try {
      await fetchApi(`/quarantine/${encodeURIComponent(modelId)}`, {
        method: 'POST', body: JSON.stringify({ reason, durationHours: 24 }),
      });
      await loadDashboard();
    } finally { setActionLoading(null); }
  };

  const handleUnquarantine = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await fetchApi(`/unquarantine/${encodeURIComponent(modelId)}`, { method: 'POST' });
      await loadDashboard();
    } finally { setActionLoading(null); }
  };

  const handleCheckDrift = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await fetchApi(`/check-drift/${encodeURIComponent(modelId)}`, { method: 'POST' });
      await loadDashboard();
    } finally { setActionLoading(null); }
  };

  const handleRecalculate = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await fetchApi(`/recalculate/${encodeURIComponent(modelId)}`, { method: 'POST' });
      await loadDashboard();
    } finally { setActionLoading(null); }
  };

  const handleUpdateConfig = async (modelId: string, updates: Record<string, unknown>) => {
    try {
      await fetchApi(`/model/${encodeURIComponent(modelId)}`, {
        method: 'PUT', body: JSON.stringify(updates),
      });
      await loadDashboard();
    } catch (err) {
      console.error('Failed to update config', err);
    }
  };

  const handleCheckDriftAll = async () => {
    setActionLoading('all');
    try {
      await fetchApi('/check-drift-all', { method: 'POST' });
      await loadDashboard();
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!dashboard) {
    return <div className="text-center text-slate-400 mt-12">Failed to load dashboard data</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scale className="h-7 w-7 text-blue-400" />
            Model Weights & Drift Correction
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage model routing weights, drift detection, and automatic correction policies
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCheckDriftAll} disabled={actionLoading === 'all'}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
            {actionLoading === 'all' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Check All Drift
          </button>
          <button onClick={loadDashboard}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Scale} label="Total Models" value={dashboard.models.length} color="text-blue-400" />
        <StatCard icon={AlertTriangle} label="Quarantined" value={dashboard.quarantinedCount} color="text-red-400" />
        <StatCard icon={Gauge} label="Avg Weight" value={`${Math.round(dashboard.averageCompositeWeight * 100)}%`} color="text-emerald-400" />
        <StatCard icon={Activity} label="Drift Alerts (24h)" value={dashboard.driftAlertCount} color="text-amber-400" />
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['models', 'actions', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'models' ? 'Model Weights' : tab === 'actions' ? 'Correction Actions' : 'Weight History'}
          </button>
        ))}
      </div>

      {activeTab === 'models' && (
        <div className="space-y-3">
          {dashboard.models.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No model weight configurations yet. Models will be added automatically when drift detection runs.
            </div>
          ) : (
            dashboard.models.map(model => (
              <ModelCard key={model.modelId} model={model}
                onQuarantine={handleQuarantine} onUnquarantine={handleUnquarantine}
                onCheckDrift={handleCheckDrift} onRecalculate={handleRecalculate}
                onUpdateConfig={handleUpdateConfig} />
            ))
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Time</th>
                <th className="text-left p-3 text-slate-400 font-medium">Model</th>
                <th className="text-left p-3 text-slate-400 font-medium">Action</th>
                <th className="text-left p-3 text-slate-400 font-medium">Trigger</th>
                <th className="text-left p-3 text-slate-400 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {dashboard.recentActions.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No correction actions yet</td></tr>
              ) : (
                dashboard.recentActions.map(action => (
                  <tr key={action.id} className="hover:bg-slate-800/30">
                    <td className="p-3 text-slate-300 font-mono text-xs">{new Date(action.createdAt).toLocaleString()}</td>
                    <td className="p-3 text-white">{action.modelId}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        action.actionType === 'quarantine' ? 'bg-red-900/50 text-red-300' :
                        action.actionType === 'unquarantine' ? 'bg-emerald-900/50 text-emerald-300' :
                        action.actionType === 'weight_penalty' ? 'bg-amber-900/50 text-amber-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>{action.actionType.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="p-3 text-slate-400 text-xs">{action.triggerType.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-slate-400 text-xs max-w-xs truncate">{action.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Time</th>
                <th className="text-left p-3 text-slate-400 font-medium">Model</th>
                <th className="text-right p-3 text-slate-400 font-medium">Composite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {dashboard.weightHistory.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-slate-500">No weight history yet</td></tr>
              ) : (
                dashboard.weightHistory.map((entry, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="p-3 text-slate-300 font-mono text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="p-3 text-white">{entry.modelId}</td>
                    <td className="p-3 text-right font-mono">
                      <span className={entry.compositeWeight >= 0.7 ? 'text-emerald-400' : entry.compositeWeight >= 0.4 ? 'text-amber-400' : 'text-red-400'}>
                        {Math.round(entry.compositeWeight * 100)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
