'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, Cpu, Zap, Eye, Heart, Code, Search, Sparkles, 
  Settings, Play, Pause, RefreshCw, Plus, ChevronRight,
  Activity, TrendingUp, Clock, DollarSign
} from 'lucide-react';

interface BrainRegion {
  regionId: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  cognitiveFunction: string;
  humanBrainAnalog?: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  priority: number;
  isActive: boolean;
  isSystem: boolean;
  metrics: {
    totalActivations: number;
    successfulActivations: number;
    avgLatencyMs: number;
    avgSatisfactionScore: number;
  };
}

interface CognitiveBrainSettings {
  cognitiveBrainEnabled: boolean;
  learningEnabled: boolean;
  adaptationEnabled: boolean;
  maxConcurrentRegions: number;
  maxTokensPerRequest: number;
  dailyCostLimitCents: number;
  globalLearningRate: number;
  enableMetacognition: boolean;
  enableTheoryOfMind: boolean;
  enableCreativeSynthesis: boolean;
  enableSelfCorrection: boolean;
}

interface Analytics {
  totalRegions: number;
  activeRegions: number;
  totalActivations: number;
  successRate: number;
  avgLatencyMs: number;
  topRegions: Array<{
    name: string;
    slug: string;
    activations: number;
    successRate: number;
  }>;
}

const iconMap: Record<string, React.ElementType> = {
  brain: Brain, cpu: Cpu, zap: Zap, eye: Eye, heart: Heart,
  code: Code, search: Search, sparkles: Sparkles, lightbulb: Sparkles,
  database: Cpu, 'message-square': Brain, ear: Brain,
};

export default function CognitiveBrainPage() {
  const [regions, setRegions] = useState<BrainRegion[]>([]);
  const [settings, setSettings] = useState<CognitiveBrainSettings | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<BrainRegion | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [regionsRes, settingsRes, analyticsRes] = await Promise.all([
        fetch(`${API}/admin/cognitive-brain/regions`),
        fetch(`${API}/admin/cognitive-brain/settings`),
        fetch(`${API}/admin/cognitive-brain/analytics`),
      ]);
      if (regionsRes.ok) { const { data } = await regionsRes.json(); setRegions(data || []); }
      else setError('Failed to load cognitive brain data.');
      if (settingsRes.ok) { const { data } = await settingsRes.json(); setSettings(data); }
      if (analyticsRes.ok) { const { data } = await analyticsRes.json(); setAnalytics(data); }
    } catch { setError('Failed to connect to cognitive brain service.'); }
    setLoading(false);
  }

  async function toggleRegion(regionId: string, isActive: boolean) {
    setRegions(regions.map(r => 
      r.regionId === regionId ? { ...r, isActive } : r
    ));
  }

  async function updateSetting(key: keyof CognitiveBrainSettings, value: boolean | number) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="h-7 w-7 text-indigo-600" />
            Cognitive Brain
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AGI-like cognitive mesh with specialized brain regions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Region
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <AnalyticsCard
            title="Active Regions"
            value={`${analytics.activeRegions}/${analytics.totalRegions}`}
            icon={Brain}
            color="indigo"
          />
          <AnalyticsCard
            title="Total Activations"
            value={analytics.totalActivations.toLocaleString()}
            icon={Activity}
            color="green"
          />
          <AnalyticsCard
            title="Success Rate"
            value={`${analytics.successRate}%`}
            icon={TrendingUp}
            color="blue"
          />
          <AnalyticsCard
            title="Avg Latency"
            value={`${analytics.avgLatencyMs}ms`}
            icon={Clock}
            color="orange"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Brain Regions */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Brain Regions
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Specialized AI models mapped to cognitive functions
            </p>
          </div>
          <div className="p-4 space-y-3">
            {regions.map(region => (
              <RegionCard
                key={region.regionId}
                region={region}
                selected={selectedRegion?.regionId === region.regionId}
                onSelect={() => setSelectedRegion(region)}
                onToggle={(active) => toggleRegion(region.regionId, active)}
              />
            ))}
          </div>
        </div>

        {/* Settings & Details */}
        <div className="space-y-6">
          {/* Global Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </h2>
            </div>
            {settings && (
              <div className="p-4 space-y-4">
                <SettingToggle
                  label="Cognitive Brain"
                  description="Enable the cognitive brain system"
                  checked={settings.cognitiveBrainEnabled}
                  onChange={(v) => updateSetting('cognitiveBrainEnabled', v)}
                />
                <SettingToggle
                  label="Learning"
                  description="Learn from interactions"
                  checked={settings.learningEnabled}
                  onChange={(v) => updateSetting('learningEnabled', v)}
                />
                <SettingToggle
                  label="Metacognition"
                  description="Self-awareness of knowledge"
                  checked={settings.enableMetacognition}
                  onChange={(v) => updateSetting('enableMetacognition', v)}
                />
                <SettingToggle
                  label="Theory of Mind"
                  description="Model user mental state"
                  checked={settings.enableTheoryOfMind}
                  onChange={(v) => updateSetting('enableTheoryOfMind', v)}
                />
                <SettingToggle
                  label="Creative Synthesis"
                  description="Novel idea generation"
                  checked={settings.enableCreativeSynthesis}
                  onChange={(v) => updateSetting('enableCreativeSynthesis', v)}
                />
                <SettingToggle
                  label="Self-Correction"
                  description="Detect and fix errors"
                  checked={settings.enableSelfCorrection}
                  onChange={(v) => updateSetting('enableSelfCorrection', v)}
                />
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Daily Cost Limit
                  </label>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={settings.dailyCostLimitCents / 100}
                      onChange={(e) => updateSetting('dailyCostLimitCents', parseFloat(e.target.value) * 100)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Learning Rate
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.1"
                    step="0.001"
                    value={settings.globalLearningRate}
                    onChange={(e) => updateSetting('globalLearningRate', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-500 text-center">
                    {settings.globalLearningRate.toFixed(3)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Region Details */}
          {selectedRegion && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Region Details
                </h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Primary Model</label>
                  <p className="font-mono text-sm text-gray-900 dark:text-white">{selectedRegion.primaryModelId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Human Brain Analog</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedRegion.humanBrainAnalog || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Fallback Models</label>
                  <div className="space-y-1">
                    {selectedRegion.fallbackModelIds.length > 0 ? (
                      selectedRegion.fallbackModelIds.map(id => (
                        <p key={id} className="font-mono text-xs text-gray-600 dark:text-gray-400">{id}</p>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">None configured</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Activations</label>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedRegion.metrics.totalActivations.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</label>
                    <p className="text-xl font-bold text-green-600">
                      {selectedRegion.metrics.totalActivations > 0
                        ? Math.round((selectedRegion.metrics.successfulActivations / selectedRegion.metrics.totalActivations) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ title, value, icon: Icon, color }: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'indigo' | 'green' | 'blue' | 'orange';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function RegionCard({ region, selected, onSelect, onToggle }: {
  region: BrainRegion;
  selected: boolean;
  onSelect: () => void;
  onToggle: (active: boolean) => void;
}) {
  const Icon = iconMap[region.icon] || Brain;
  const successRate = region.metrics.totalActivations > 0
    ? Math.round((region.metrics.successfulActivations / region.metrics.totalActivations) * 100)
    : 0;

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${region.color}20`, color: region.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{region.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {region.cognitiveFunction} • {region.humanBrainAnalog || 'Custom'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {region.metrics.totalActivations.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{successRate}% success</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(!region.isActive);
            }}
            className={`p-2 rounded-lg transition-colors ${
              region.isActive
                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {region.isActive ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function SettingToggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

