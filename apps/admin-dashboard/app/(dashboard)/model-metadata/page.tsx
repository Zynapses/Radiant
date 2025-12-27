'use client';

import React, { useState } from 'react';

// Mock data for demonstration
const mockModels = [
  {
    modelId: 'openai/gpt-4o',
    provider: 'openai',
    modelName: 'GPT-4o',
    modelFamily: 'gpt',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: { reasoning: 0.9, coding: 0.85, vision: 0.9, language: 0.95 },
    specialties: ['multimodal', 'reasoning', 'coding', 'analysis'],
    inputPricePer1M: 5.00,
    outputPricePer1M: 15.00,
    functionCallingSupport: true,
    jsonModeSupport: true,
    metadataCompleteness: 0.85,
    lastVerified: '2024-12-26T10:00:00Z',
    isAvailable: true,
  },
  {
    modelId: 'anthropic/claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    modelName: 'Claude 3.5 Sonnet',
    modelFamily: 'claude',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: { reasoning: 0.92, coding: 0.95, vision: 0.85, language: 0.93 },
    specialties: ['coding', 'analysis', 'reasoning', 'long context'],
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    functionCallingSupport: true,
    jsonModeSupport: true,
    metadataCompleteness: 0.90,
    lastVerified: '2024-12-26T08:00:00Z',
    isAvailable: true,
  },
  {
    modelId: 'google/gemini-1.5-pro',
    provider: 'google',
    modelName: 'Gemini 1.5 Pro',
    modelFamily: 'gemini',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    capabilities: { reasoning: 0.88, coding: 0.82, vision: 0.9, longContext: 0.95 },
    specialties: ['long context', 'multimodal', 'reasoning'],
    inputPricePer1M: 1.25,
    outputPricePer1M: 5.00,
    functionCallingSupport: true,
    jsonModeSupport: true,
    metadataCompleteness: 0.75,
    lastVerified: '2024-12-25T14:00:00Z',
    isAvailable: true,
  },
  {
    modelId: 'meta/llama-3.1-70b',
    provider: 'meta',
    modelName: 'Llama 3.1 70B',
    modelFamily: 'llama',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: { reasoning: 0.82, coding: 0.78, language: 0.85 },
    specialties: ['open source', 'general', 'reasoning'],
    inputPricePer1M: 0.99,
    outputPricePer1M: 0.99,
    functionCallingSupport: true,
    jsonModeSupport: false,
    metadataCompleteness: 0.65,
    lastVerified: '2024-12-24T12:00:00Z',
    isAvailable: true,
  },
  {
    modelId: 'mistral/codestral',
    provider: 'mistral',
    modelName: 'Codestral',
    modelFamily: 'mistral',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    capabilities: { coding: 0.92, reasoning: 0.75 },
    specialties: ['code generation', 'code completion', 'code review'],
    inputPricePer1M: 1.00,
    outputPricePer1M: 3.00,
    functionCallingSupport: true,
    jsonModeSupport: false,
    metadataCompleteness: 0.55,
    lastVerified: null,
    isAvailable: true,
  },
];

const mockSchedules = [
  { id: '1', name: 'Daily Quick Refresh', scope: 'all', scheduleType: 'cron', cronExpression: '0 6 * * *', researchDepth: 'quick', enabled: true, lastRun: '2024-12-26T06:00:00Z' },
  { id: '2', name: 'Weekly Deep Research', scope: 'all', scheduleType: 'cron', cronExpression: '0 2 * * 0', researchDepth: 'deep', enabled: true, lastRun: '2024-12-22T02:00:00Z' },
  { id: '3', name: 'Pricing Update', scope: 'all', scheduleType: 'cron', cronExpression: '0 0 * * 1', researchDepth: 'standard', enabled: true, lastRun: '2024-12-23T00:00:00Z' },
];

const mockResearchHistory = [
  { id: '1', modelId: 'openai/gpt-4o', researchType: 'scheduled', fieldsUpdated: ['inputPricePer1M', 'outputPricePer1M'], aiConfidence: 0.92, status: 'completed', completedAt: '2024-12-26T06:05:00Z' },
  { id: '2', modelId: 'anthropic/claude-3-5-sonnet-20241022', researchType: 'manual', fieldsUpdated: ['capabilities', 'benchmarks'], aiConfidence: 0.88, status: 'completed', completedAt: '2024-12-26T05:30:00Z' },
  { id: '3', modelId: 'google/gemini-1.5-pro', researchType: 'scheduled', fieldsUpdated: ['contextWindow'], aiConfidence: 0.95, status: 'completed', completedAt: '2024-12-25T14:10:00Z' },
];

export default function ModelMetadataPage() {
  const [selectedTab, setSelectedTab] = useState<'models' | 'schedules' | 'research' | 'sources'>('models');
  const [selectedModel, setSelectedModel] = useState<typeof mockModels[0] | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [isResearching, setIsResearching] = useState<string | null>(null);

  const filteredModels = mockModels.filter(model => 
    providerFilter === 'all' || model.provider === providerFilter
  );

  const providers = Array.from(new Set(mockModels.map(m => m.provider)));

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
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{mockModels.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Providers</p>
          <p className="text-2xl font-bold text-blue-600">{providers.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Avg Completeness</p>
          <p className="text-2xl font-bold text-green-600">
            {Math.round(mockModels.reduce((sum, m) => sum + m.metadataCompleteness, 0) / mockModels.length * 100)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Active Schedules</p>
          <p className="text-2xl font-bold text-purple-600">{mockSchedules.filter(s => s.enabled).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Research Today</p>
          <p className="text-2xl font-bold text-orange-600">{mockResearchHistory.length}</p>
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
                {mockSchedules.map((schedule) => (
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
              {mockResearchHistory.map((research) => (
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
