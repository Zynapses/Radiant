'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cloud, RefreshCw, Zap, Settings2, ArrowUpCircle, Clock, Bot,
  DollarSign, BarChart3, ChevronDown, ChevronUp, Check, AlertTriangle,
  Globe, Cpu, Layers, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface BedrockModel {
  id: string;
  modelName: string;
  providerName: string;
  inputModalities: string[];
  outputModalities: string[];
  responseStreamingSupported: boolean;
  inferenceTypesSupported: string[];
  modelLifecycleStatus: string | null;
  isActive: boolean;
  isAvailableForInference: boolean;
  inputPricePer1kTokens: number | null;
  outputPricePer1kTokens: number | null;
  lastCheckedAt: string;
}

interface HelperConfig {
  tenantId: string;
  enabled: boolean;
  bedrockModelId: string;
  bedrockRegion: string;
  autoUpgradeModel: boolean;
  preferredModelFamily: string;
  maxTokens: number;
  temperature: number;
  modelPollIntervalHours: number;
  lastModelPollAt: string | null;
  lastAutoUpgradeAt: string | null;
  lastAutoUpgradeFrom: string | null;
  lastAutoUpgradeTo: string | null;
  includePageData: boolean;
  includeSystemMetrics: boolean;
  maxContextTokens: number;
  systemPromptOverride: string | null;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
}

interface Dashboard {
  config: HelperConfig;
  totalModels: number;
  providers: string[];
  modelsByProvider: Record<string, number>;
  currentModelId: string;
  autoUpgradeEnabled: boolean;
  pollIntervalHours: number;
  lastPollAt: string | null;
  totalAIHelperRequests: number;
  totalAIHelperCostCents: number;
}

const API_BASE = '/api/admin/bedrock';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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

export default function BedrockSettingsPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [models, setModels] = useState<BedrockModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'models' | 'usage'>('settings');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  // Form state
  const [formState, setFormState] = useState<Partial<HelperConfig>>({});

  const loadDashboard = useCallback(async () => {
    try {
      const [dash, modelsData] = await Promise.all([
        fetchApi('/dashboard'),
        fetchApi('/models'),
      ]);
      setDashboard(dash);
      setModels(modelsData.models || []);
      setFormState({
        bedrockModelId: dash.config.bedrockModelId,
        bedrockRegion: dash.config.bedrockRegion,
        autoUpgradeModel: dash.config.autoUpgradeModel,
        preferredModelFamily: dash.config.preferredModelFamily,
        maxTokens: dash.config.maxTokens,
        temperature: dash.config.temperature,
        modelPollIntervalHours: dash.config.modelPollIntervalHours,
        enabled: dash.config.enabled,
        includePageData: dash.config.includePageData,
        includeSystemMetrics: dash.config.includeSystemMetrics,
        maxContextTokens: dash.config.maxContextTokens,
        systemPromptOverride: dash.config.systemPromptOverride,
      });
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handlePoll = async () => {
    setPolling(true);
    try {
      const result = await fetchApi('/poll', { method: 'POST' });
      alert(`Poll complete: ${result.newModels} new, ${result.updatedModels} updated, ${result.deactivatedModels} deactivated`);
      await loadDashboard();
    } catch (err) {
      alert(`Poll failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPolling(false);
    }
  };

  const handleAutoUpgrade = async () => {
    setUpgrading(true);
    try {
      const result = await fetchApi('/auto-upgrade', { method: 'POST' });
      if (result.upgraded) {
        alert(`Upgraded: ${result.previousModelId} → ${result.newModelId}`);
      } else {
        alert(`No upgrade available: ${result.reason}`);
      }
      await loadDashboard();
    } catch (err) {
      alert(`Auto-upgrade failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpgrading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi('/config', { method: 'PUT', body: JSON.stringify(formState) });
      await loadDashboard();
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!dashboard) {
    return <div className="text-center text-slate-400 mt-12">Failed to load Bedrock settings</div>;
  }

  const modelsByProvider: Record<string, BedrockModel[]> = {};
  for (const model of models) {
    if (!modelsByProvider[model.providerName]) modelsByProvider[model.providerName] = [];
    modelsByProvider[model.providerName].push(model);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Cloud className="h-7 w-7 text-orange-400" />
            Bedrock Model Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure the AI helper model, auto-upgrade, and Bedrock model discovery
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePoll} disabled={polling}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
            {polling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Poll Models
          </button>
          <button onClick={handleAutoUpgrade} disabled={upgrading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
            {upgrading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
            Check Upgrade
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatCard icon={Layers} label="Models Available" value={dashboard.totalModels} color="text-blue-400" />
        <StatCard icon={Globe} label="Providers" value={dashboard.providers.length} color="text-purple-400" />
        <StatCard icon={Bot} label="Current Model" value={dashboard.currentModelId.split('.').pop() || ''} sub={dashboard.currentModelId} color="text-orange-400" />
        <StatCard icon={BarChart3} label="AI Helper Requests" value={dashboard.totalAIHelperRequests} color="text-cyan-400" />
        <StatCard icon={DollarSign} label="AI Helper Cost" value={`$${(dashboard.totalAIHelperCostCents / 100).toFixed(2)}`} color="text-emerald-400" />
      </div>

      {dashboard.config.lastAutoUpgradeAt && (
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4 flex items-center gap-3">
          <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
          <div>
            <span className="text-sm text-emerald-300 font-medium">Last auto-upgrade: </span>
            <span className="text-sm text-slate-300">
              {dashboard.config.lastAutoUpgradeFrom} → {dashboard.config.lastAutoUpgradeTo}
            </span>
            <span className="text-xs text-slate-500 ml-2">
              ({new Date(dashboard.config.lastAutoUpgradeAt).toLocaleString()})
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['settings', 'models', 'usage'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'settings' ? 'Configuration' : tab === 'models' ? 'Model Registry' : 'Usage Stats'}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-400" /> AI Helper Model
              </h3>

              <div>
                <label className="text-xs text-slate-400">Bedrock Model ID</label>
                <select value={formState.bedrockModelId || ''} onChange={(e) => setFormState({ ...formState, bedrockModelId: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  {models.filter(m => m.isAvailableForInference && m.inputModalities.includes('TEXT')).map(m => (
                    <option key={m.id} value={m.id}>{m.modelName} ({m.id})</option>
                  ))}
                  <option value={formState.bedrockModelId}>{formState.bedrockModelId} (current)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">AWS Region</label>
                <select value={formState.bedrockRegion || 'us-east-1'} onChange={(e) => setFormState({ ...formState, bedrockRegion: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  {['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Temperature</label>
                  <input type="number" step="0.1" min="0" max="1" value={formState.temperature ?? 0.3}
                    onChange={(e) => setFormState({ ...formState, temperature: parseFloat(e.target.value) })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Max Tokens</label>
                  <input type="number" step="256" min="256" max="8192" value={formState.maxTokens ?? 4096}
                    onChange={(e) => setFormState({ ...formState, maxTokens: parseInt(e.target.value) })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Max Context Tokens</label>
                <input type="number" step="1000" min="1000" max="32000" value={formState.maxContextTokens ?? 8000}
                  onChange={(e) => setFormState({ ...formState, maxContextTokens: parseInt(e.target.value) })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-emerald-400" /> Auto-Upgrade & Polling
              </h3>

              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div>
                    <span className="text-sm text-white">AI Helper Enabled</span>
                    <p className="text-xs text-slate-500">Show AI assistant on all admin pages</p>
                  </div>
                  <button onClick={() => setFormState({ ...formState, enabled: !formState.enabled })}
                    className={`p-0.5 rounded-full transition-colors ${formState.enabled ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                    {formState.enabled ? <ToggleRight className="h-6 w-6 text-white" /> : <ToggleLeft className="h-6 w-6 text-slate-400" />}
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div>
                    <span className="text-sm text-white">Auto-Upgrade Model</span>
                    <p className="text-xs text-slate-500">Automatically upgrade to latest model in family</p>
                  </div>
                  <button onClick={() => setFormState({ ...formState, autoUpgradeModel: !formState.autoUpgradeModel })}
                    className={`p-0.5 rounded-full transition-colors ${formState.autoUpgradeModel ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                    {formState.autoUpgradeModel ? <ToggleRight className="h-6 w-6 text-white" /> : <ToggleLeft className="h-6 w-6 text-slate-400" />}
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div>
                    <span className="text-sm text-white">Include Page Data</span>
                    <p className="text-xs text-slate-500">Send current page data as context to AI helper</p>
                  </div>
                  <button onClick={() => setFormState({ ...formState, includePageData: !formState.includePageData })}
                    className={`p-0.5 rounded-full transition-colors ${formState.includePageData ? 'bg-blue-600' : 'bg-slate-600'}`}>
                    {formState.includePageData ? <ToggleRight className="h-6 w-6 text-white" /> : <ToggleLeft className="h-6 w-6 text-slate-400" />}
                  </button>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400">Preferred Model Family (for auto-upgrade)</label>
                <select value={formState.preferredModelFamily || 'anthropic.claude'}
                  onChange={(e) => setFormState({ ...formState, preferredModelFamily: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="anthropic.claude">Anthropic Claude</option>
                  <option value="meta.llama">Meta Llama</option>
                  <option value="amazon.titan">Amazon Titan</option>
                  <option value="mistral">Mistral</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Poll Interval (hours)</label>
                <input type="number" step="1" min="1" max="168" value={formState.modelPollIntervalHours ?? 24}
                  onChange={(e) => setFormState({ ...formState, modelPollIntervalHours: parseInt(e.target.value) })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                <p className="text-xs text-slate-500 mt-1">
                  {dashboard.config.lastModelPollAt
                    ? `Last poll: ${new Date(dashboard.config.lastModelPollAt).toLocaleString()}`
                    : 'No polls yet'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Custom System Prompt Override (optional)</label>
            <textarea value={formState.systemPromptOverride || ''} rows={3}
              onChange={(e) => setFormState({ ...formState, systemPromptOverride: e.target.value || null })}
              placeholder="Leave empty to use page-specific defaults..."
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none" />
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-3">
          {Object.entries(modelsByProvider).sort().map(([provider, provModels]) => (
            <div key={provider} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedProvider(expandedProvider === provider ? null : provider)}>
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-white capitalize">{provider}</span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{provModels.length} models</span>
                </div>
                {expandedProvider === provider ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {expandedProvider === provider && (
                <div className="border-t border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="text-left p-3 text-slate-400 font-medium">Model ID</th>
                        <th className="text-left p-3 text-slate-400 font-medium">Name</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Streaming</th>
                        <th className="text-right p-3 text-slate-400 font-medium">Input $/1k</th>
                        <th className="text-right p-3 text-slate-400 font-medium">Output $/1k</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Current</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {provModels.map(model => (
                        <tr key={model.id} className="hover:bg-slate-800/30">
                          <td className="p-3 text-white font-mono text-xs">{model.id}</td>
                          <td className="p-3 text-slate-300">{model.modelName}</td>
                          <td className="p-3 text-center">
                            {model.isAvailableForInference ? (
                              <span className="text-emerald-400 text-xs">Available</span>
                            ) : (
                              <span className="text-red-400 text-xs">Unavailable</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {model.responseStreamingSupported ? <Check className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-slate-300">
                            {model.inputPricePer1kTokens != null ? `$${model.inputPricePer1kTokens.toFixed(5)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-slate-300">
                            {model.outputPricePer1kTokens != null ? `$${model.outputPricePer1kTokens.toFixed(5)}` : '-'}
                          </td>
                          <td className="p-3 text-center">
                            {model.id === dashboard.config.bedrockModelId && (
                              <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">Active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-6">
          <h3 className="text-sm font-semibold text-white">AI Helper Usage Statistics</h3>
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={BarChart3} label="Total Requests" value={dashboard.config.totalRequests} color="text-blue-400" />
            <StatCard icon={Zap} label="Input Tokens" value={dashboard.config.totalInputTokens.toLocaleString()} color="text-cyan-400" />
            <StatCard icon={Zap} label="Output Tokens" value={dashboard.config.totalOutputTokens.toLocaleString()} color="text-purple-400" />
            <StatCard icon={DollarSign} label="Total Cost" value={`$${(dashboard.config.totalCostCents / 100).toFixed(4)}`} color="text-emerald-400" />
          </div>
          <div className="text-xs text-slate-500">
            These statistics reflect all AI helper interactions across all admin pages for this tenant.
          </div>
        </div>
      )}
    </div>
  );
}
