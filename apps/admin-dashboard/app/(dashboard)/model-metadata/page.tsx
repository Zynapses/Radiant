'use client';

import React, { useState, useEffect } from 'react';

interface ModelMetadata {
  modelId: string;
  provider: string;
  modelName: string;
  modelFamily: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: Record<string, number>;
  specialties: string[];
  inputPricePer1M: number;
  outputPricePer1M: number;
  functionCallingSupport: boolean;
  jsonModeSupport: boolean;
  metadataCompleteness: number;
  lastVerified: string | null;
  isAvailable: boolean;
}

interface ResearchSchedule { id: string; name: string; scope: string; scheduleType: string; cronExpression: string; researchDepth: string; enabled: boolean; lastRun: string; }
interface ResearchHistory { id: string; modelId: string; researchType: string; fieldsUpdated: string[]; aiConfidence: number; status: string; completedAt: string; }

export default function ModelMetadataPage() {
  const [selectedTab, setSelectedTab] = useState<'models' | 'schedules' | 'research' | 'sources'>('models');
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [schedules, setSchedules] = useState<ResearchSchedule[]>([]);
  const [researchHistory, setResearchHistory] = useState<ResearchHistory[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [isResearching, setIsResearching] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [modelsRes, schedulesRes, historyRes] = await Promise.all([
        fetch(`${API}/admin/model-metadata/models`),
        fetch(`${API}/admin/model-metadata/schedules`),
        fetch(`${API}/admin/model-metadata/research-history`),
      ]);
      if (modelsRes.ok) { const { data } = await modelsRes.json(); setModels(data || []); }
      else setError('Failed to load model metadata.');
      if (schedulesRes.ok) { const { data } = await schedulesRes.json(); setSchedules(data || []); }
      if (historyRes.ok) { const { data } = await historyRes.json(); setResearchHistory(data || []); }
    } catch { setError('Failed to connect to model metadata service.'); }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p><button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Retry</button></div>;

  const filteredModels = models.filter(model => providerFilter === 'all' || model.provider === providerFilter);
  const providers = Array.from(new Set(models.map(m => m.provider)));

  const getCompletenessColor = (completeness: number) => {
    if (completeness >= 0.8) return 'bg-green-500';
    if (completeness >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const handleResearch = async (modelId: string) => {
    setIsResearching(modelId);
    // Simulate research
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsResearching(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Model Metadata Engine</h1>
          <p className="text-gray-600 dark:text-gray-400">Comprehensive metadata for AI model orchestration</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            + Add New Model
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Run Research
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Total Models</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{models.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Providers</p>
          <p className="text-2xl font-bold text-blue-600">{providers.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Avg Completeness</p>
          <p className="text-2xl font-bold text-green-600">
            {Math.round(models.reduce((sum, m) => sum + m.metadataCompleteness, 0) / models.length * 100)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Active Schedules</p>
          <p className="text-2xl font-bold text-purple-600">{schedules.filter(s => s.enabled).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Research Today</p>
          <p className="text-2xl font-bold text-orange-600">{researchHistory.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {['models', 'schedules', 'research', 'sources'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as typeof selectedTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Models Tab */}
      {selectedTab === 'models' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select 
              value={providerFilter} 
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="all">All Providers</option>
              {providers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input 
              type="text"
              placeholder="Search models..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>

          {/* Models Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredModels.map((model) => (
              <div 
                key={model.modelId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedModel(model)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{model.modelName}</h3>
                    <p className="text-sm text-gray-500">{model.modelId}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {model.provider}
                  </span>
                </div>

                {/* Capabilities */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Capabilities</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(model.capabilities).slice(0, 4).map(([cap, score]) => (
                      <span 
                        key={cap}
                        className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700"
                        title={`${cap}: ${Math.round(Number(score) * 100)}%`}
                      >
                        {cap}: {Math.round(Number(score) * 100)}%
                      </span>
                    ))}
                  </div>
                </div>

                {/* Specs Row */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Context</p>
                    <p className="font-medium">{formatNumber(model.contextWindow)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Input $/1M</p>
                    <p className="font-medium">${model.inputPricePer1M.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Output $/1M</p>
                    <p className="font-medium">${model.outputPricePer1M.toFixed(2)}</p>
                  </div>
                </div>

                {/* Completeness & Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Completeness:</span>
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getCompletenessColor(model.metadataCompleteness)}`}
                        style={{ width: `${model.metadataCompleteness * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{Math.round(model.metadataCompleteness * 100)}%</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResearch(model.modelId);
                    }}
                    disabled={isResearching === model.modelId}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    {isResearching === model.modelId ? 'Researching...' : 'Research'}
                  </button>
                </div>

                {model.lastVerified && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last verified: {new Date(model.lastVerified).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {selectedTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + New Schedule
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Depth</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Run</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">{schedule.name}</td>
                    <td className="px-4 py-3 capitalize">{schedule.scope}</td>
                    <td className="px-4 py-3 font-mono text-sm">{schedule.cronExpression}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        schedule.researchDepth === 'deep' ? 'bg-purple-100 text-purple-800' :
                        schedule.researchDepth === 'standard' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.researchDepth}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(schedule.lastRun).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                          Run Now
                        </button>
                        <button className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Schedule Editor Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Schedule Configuration</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Configure when the AI researches and updates model metadata. Use cron expressions for precise scheduling.
              Research depth affects how thoroughly the AI investigates each model:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 ml-4 list-disc">
              <li><strong>Quick:</strong> Price and availability checks only (~30 seconds/model)</li>
              <li><strong>Standard:</strong> Capabilities, pricing, benchmarks (~2 minutes/model)</li>
              <li><strong>Deep:</strong> Comprehensive research including news and papers (~5 minutes/model)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Research History Tab */}
      {selectedTab === 'research' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Research History</h2>
            <p className="text-sm text-gray-500">AI-powered metadata updates and their findings</p>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fields Updated</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {researchHistory.map((research) => (
                <tr key={research.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3 font-mono text-sm">{research.modelId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      research.researchType === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {research.researchType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {research.fieldsUpdated.map(field => (
                        <span key={field} className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                          {field}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full" 
                          style={{ width: `${research.aiConfidence * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{Math.round(research.aiConfidence * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      {research.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(research.completedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sources Tab */}
      {selectedTab === 'sources' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Metadata Sources</h2>
              <p className="text-sm text-gray-500">Configure where the AI researches model information</p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {[
                { name: 'OpenAI API Models', type: 'official_api', trustScore: 1.0, isOfficial: true, enabled: true },
                { name: 'Anthropic Models', type: 'official_api', trustScore: 1.0, isOfficial: true, enabled: true },
                { name: 'Google AI Models', type: 'official_api', trustScore: 1.0, isOfficial: true, enabled: true },
                { name: 'Hugging Face Hub', type: 'documentation', trustScore: 0.9, isOfficial: false, enabled: true },
                { name: 'Papers With Code', type: 'benchmark', trustScore: 0.85, isOfficial: false, enabled: true },
                { name: 'AI News Sources', type: 'news', trustScore: 0.6, isOfficial: false, enabled: false },
              ].map((source, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${source.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{source.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{source.type}</span>
                        {source.isOfficial && (
                          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Official</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Trust Score</p>
                      <p className="font-medium">{Math.round(source.trustScore * 100)}%</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={source.enabled} className="sr-only peer" readOnly />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Model Detail Modal */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedModel.modelName}</h2>
                <p className="text-sm text-gray-500">{selectedModel.modelId}</p>
              </div>
              <button 
                onClick={() => setSelectedModel(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Provider</p>
                  <p className="font-medium capitalize">{selectedModel.provider}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Family</p>
                  <p className="font-medium">{selectedModel.modelFamily}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Context Window</p>
                  <p className="font-medium">{formatNumber(selectedModel.contextWindow)} tokens</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Max Output</p>
                  <p className="font-medium">{formatNumber(selectedModel.maxOutputTokens)} tokens</p>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Capabilities</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedModel.capabilities).map(([cap, score]) => (
                    <div key={cap} className="flex items-center gap-2">
                      <span className="text-sm w-20 capitalize">{cap}</span>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Number(score) * 100}%` }} />
                      </div>
                      <span className="text-sm w-12 text-right">{Math.round(Number(score) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Specialties */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedModel.specialties.map(s => (
                    <span key={s} className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Pricing</h3>
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Input (per 1M tokens)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">${selectedModel.inputPricePer1M.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Output (per 1M tokens)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">${selectedModel.outputPricePer1M.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedModel.functionCallingSupport && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">Function Calling</span>
                  )}
                  {selectedModel.jsonModeSupport && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">JSON Mode</span>
                  )}
                </div>
              </div>

              {/* Metadata Status */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Metadata Completeness</span>
                  <span className="font-medium">{Math.round(selectedModel.metadataCompleteness * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getCompletenessColor(selectedModel.metadataCompleteness)}`}
                    style={{ width: `${selectedModel.metadataCompleteness * 100}%` }}
                  />
                </div>
                {selectedModel.lastVerified && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last verified: {new Date(selectedModel.lastVerified).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button 
                  onClick={() => handleResearch(selectedModel.modelId)}
                  disabled={isResearching === selectedModel.modelId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isResearching === selectedModel.modelId ? 'Researching...' : 'Research Now'}
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Edit Metadata
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Admin Override
                </button>
                <button 
                  onClick={() => setSelectedModel(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
