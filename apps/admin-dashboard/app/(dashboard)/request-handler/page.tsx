'use client';

import React, { useState, useEffect } from 'react';

interface IRHConfig {
  enabled: boolean;
  moralCompass: { enabled: boolean; enforcementMode: string; blockOnViolation: boolean; includeReasoningInResponse: boolean; };
  confidenceCalibration: { enabled: boolean; domain: string; includeUncertaintySources: boolean; minConfidenceThreshold: number; };
  selfImprovement: { enabled: boolean; recordPerformance: boolean; generateImprovementIdeas: boolean; };
  contextAdaptation: { enabled: boolean; detectContext: boolean; applyAdaptations: boolean; };
  proactiveAssistance: { enabled: boolean; detectPatterns: boolean; generateSuggestions: boolean; };
  knowledgeGraph: { enabled: boolean; queryRelevantKnowledge: boolean; extractAndStore: boolean; };
}

interface IRHStats {
  totalRequests: number;
  irhProcessedRequests: number;
  moralBlockedRequests: number;
  avgIRHLatencyMs: number;
  confidenceWarnings: number;
  improvementIdeasGenerated: number;
  knowledgeNodesCreated: number;
  adaptationsApplied: number;
}

interface RecentDecision {
  id: string;
  task: string;
  moralApproved: boolean;
  confidence: number;
  specialty: string;
  latencyMs: number;
}

const defaultConfig: IRHConfig = {
  enabled: true,
  moralCompass: { enabled: true, enforcementMode: 'strict', blockOnViolation: true, includeReasoningInResponse: false },
  confidenceCalibration: { enabled: true, domain: 'general', includeUncertaintySources: true, minConfidenceThreshold: 0.3 },
  selfImprovement: { enabled: true, recordPerformance: true, generateImprovementIdeas: false },
  contextAdaptation: { enabled: true, detectContext: true, applyAdaptations: true },
  proactiveAssistance: { enabled: false, detectPatterns: false, generateSuggestions: false },
  knowledgeGraph: { enabled: false, queryRelevantKnowledge: false, extractAndStore: false },
};

const defaultStats: IRHStats = { totalRequests: 0, irhProcessedRequests: 0, moralBlockedRequests: 0, avgIRHLatencyMs: 0, confidenceWarnings: 0, improvementIdeasGenerated: 0, knowledgeNodesCreated: 0, adaptationsApplied: 0 };

export default function IntelligentRequestHandlerPage() {
  const [config, setConfig] = useState<IRHConfig>(defaultConfig);
  const [mockIRHStats, setMockIRHStats] = useState<IRHStats>(defaultStats);
  const [mockRecentDecisions, setMockRecentDecisions] = useState<RecentDecision[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'moral' | 'confidence' | 'improvement' | 'context' | 'proactive' | 'knowledge'>('overview');
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || '';
        const [configRes, statsRes, decisionsRes] = await Promise.all([
          fetch(`${API}/admin/request-handler/config`),
          fetch(`${API}/admin/request-handler/stats`),
          fetch(`${API}/admin/request-handler/decisions`),
        ]);
        if (configRes.ok) { const { data } = await configRes.json(); setConfig(data || defaultConfig); }
        else setError('Failed to load request handler data.');
        if (statsRes.ok) { const { data } = await statsRes.json(); setMockIRHStats(data || defaultStats); }
        if (decisionsRes.ok) { const { data } = await decisionsRes.json(); setMockRecentDecisions(data || []); }
      } catch { setError('Failed to connect to request handler service.'); }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p></div>;

  const updateConfig = (path: string, value: unknown) => {
    setConfig(prev => {
      const keys = path.split('.');
      const newConfig = { ...prev };
      let current: Record<string, unknown> = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      
      return newConfig as typeof prev;
    });
    setHasChanges(true);
  };

  const toggleSwitch = (path: string, current: boolean) => {
    updateConfig(path, !current);
  };

  const renderToggle = (label: string, description: string, path: string, value: boolean, disabled = false) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => !disabled && toggleSwitch(path, value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Intelligent Request Handler</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure intelligent processing features for all AI requests</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <button 
              onClick={() => setHasChanges(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
            <span className="text-sm text-gray-500">Master Toggle</span>
            <button
              onClick={() => toggleSwitch('enabled', config.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.enabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Total Requests</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{mockIRHStats.totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">IRH Processed</p>
          <p className="text-xl font-bold text-blue-600">{mockIRHStats.irhProcessedRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Moral Blocked</p>
          <p className="text-xl font-bold text-red-600">{mockIRHStats.moralBlockedRequests}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Avg IRH Latency</p>
          <p className="text-xl font-bold text-green-600">{mockIRHStats.avgIRHLatencyMs}ms</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Low Confidence</p>
          <p className="text-xl font-bold text-yellow-600">{mockIRHStats.confidenceWarnings}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Improvement Ideas</p>
          <p className="text-xl font-bold text-purple-600">{mockIRHStats.improvementIdeasGenerated}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Knowledge Nodes</p>
          <p className="text-xl font-bold text-orange-600">{mockIRHStats.knowledgeNodesCreated}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Adaptations</p>
          <p className="text-xl font-bold text-cyan-600">{mockIRHStats.adaptationsApplied.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'moral', label: '🧭 Moral Compass' },
            { key: 'confidence', label: '📊 Confidence' },
            { key: 'improvement', label: '🚀 Self-Improvement' },
            { key: 'context', label: '🎯 Context' },
            { key: 'proactive', label: '💡 Proactive' },
            { key: 'knowledge', label: '🧠 Knowledge' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* IRH Features Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Handler Features Status</h2>
            <div className="space-y-3">
              {[
                { name: 'Moral Compass', enabled: config.moralCompass.enabled, color: 'red' },
                { name: 'Confidence Calibration', enabled: config.confidenceCalibration.enabled, color: 'blue' },
                { name: 'Self-Improvement', enabled: config.selfImprovement.enabled, color: 'purple' },
                { name: 'Context Adaptation', enabled: config.contextAdaptation.enabled, color: 'green' },
                { name: 'Proactive Assistance', enabled: config.proactiveAssistance.enabled, color: 'yellow' },
                { name: 'Knowledge Graph', enabled: config.knowledgeGraph.enabled, color: 'orange' },
              ].map(feature => (
                <div key={feature.name} className="flex items-center justify-between py-2">
                  <span className="text-gray-700 dark:text-gray-300">{feature.name}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    feature.enabled 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {feature.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Decisions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Recent Decisions</h2>
            <div className="space-y-2">
              {mockRecentDecisions.map(decision => (
                <div key={decision.id} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{decision.task}</p>
                    <p className="text-xs text-gray-500">{decision.specialty} • {decision.latencyMs}ms</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-gray-500">{Math.round(decision.confidence * 100)}%</span>
                    <span className={`w-2 h-2 rounded-full ${decision.moralApproved ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Moral Compass Tab */}
      {selectedTab === 'moral' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Moral Compass Settings</h2>
                <p className="text-sm text-gray-500">Configure ethical evaluation for all AGI requests</p>
              </div>
              <a href="/moral-compass" className="text-sm text-blue-600 hover:underline">
                Edit Principles →
              </a>
            </div>
          </div>
          <div className="p-4 space-y-1">
            {renderToggle('Enable Moral Compass', 'Evaluate all AI requests against ethical principles', 'moralCompass.enabled', config.moralCompass.enabled)}
            {renderToggle('Block on Violation', 'Refuse requests that violate moral principles', 'moralCompass.blockOnViolation', config.moralCompass.blockOnViolation, !config.moralCompass.enabled)}
            {renderToggle('Include Reasoning', 'Explain moral reasoning in blocked responses', 'moralCompass.includeReasoningInResponse', config.moralCompass.includeReasoningInResponse, !config.moralCompass.enabled)}
            
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enforcement Mode
              </label>
              <select 
                value={config.moralCompass.enforcementMode}
                onChange={(e) => updateConfig('moralCompass.enforcementMode', e.target.value)}
                disabled={!config.moralCompass.enabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 disabled:opacity-50"
              >
                <option value="strict">Strict - Always block violations</option>
                <option value="balanced">Balanced - Block with flexibility</option>
                <option value="advisory">Advisory - Warn but allow</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Confidence Calibration Tab */}
      {selectedTab === 'confidence' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Confidence Calibration</h2>
            <p className="text-sm text-gray-500">Configure how AGI assesses and reports confidence in responses</p>
          </div>
          <div className="p-4 space-y-1">
            {renderToggle('Enable Confidence Calibration', 'Calibrate and assess response confidence', 'confidenceCalibration.enabled', config.confidenceCalibration.enabled)}
            {renderToggle('Include Uncertainty Sources', 'Report what factors affect confidence', 'confidenceCalibration.includeUncertaintySources', config.confidenceCalibration.includeUncertaintySources, !config.confidenceCalibration.enabled)}
            
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Confidence Threshold ({Math.round(config.confidenceCalibration.minConfidenceThreshold * 100)}%)
              </label>
              <input 
                type="range"
                min="0"
                max="100"
                value={config.confidenceCalibration.minConfidenceThreshold * 100}
                onChange={(e) => updateConfig('confidenceCalibration.minConfidenceThreshold', parseInt(e.target.value) / 100)}
                disabled={!config.confidenceCalibration.enabled}
                className="w-full disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Responses below this threshold will include a confidence warning
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Self-Improvement Tab */}
      {selectedTab === 'improvement' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Self-Improvement</h2>
                <p className="text-sm text-gray-500">Configure how AGI learns and improves from interactions</p>
              </div>
              <a href="/self-improvement" className="text-sm text-blue-600 hover:underline">
                View Ideas →
              </a>
            </div>
          </div>
          <div className="p-4 space-y-1">
            {renderToggle('Enable Self-Improvement', 'Track performance and suggest improvements', 'selfImprovement.enabled', config.selfImprovement.enabled)}
            {renderToggle('Record Performance', 'Track quality scores and response times', 'selfImprovement.recordPerformance', config.selfImprovement.recordPerformance, !config.selfImprovement.enabled)}
            {renderToggle('Generate Improvement Ideas', 'Automatically suggest improvements for low-quality responses', 'selfImprovement.generateImprovementIdeas', config.selfImprovement.generateImprovementIdeas, !config.selfImprovement.enabled)}
          </div>
        </div>
      )}

      {/* Context Adaptation Tab */}
      {selectedTab === 'context' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Context Adaptation</h2>
            <p className="text-sm text-gray-500">Configure how AGI adapts to user context and preferences</p>
          </div>
          <div className="p-4 space-y-1">
            {renderToggle('Enable Context Adaptation', 'Adapt responses based on detected context', 'contextAdaptation.enabled', config.contextAdaptation.enabled)}
            {renderToggle('Detect Context', 'Analyze user, task, and domain context', 'contextAdaptation.detectContext', config.contextAdaptation.detectContext, !config.contextAdaptation.enabled)}
            {renderToggle('Apply Adaptations', 'Automatically adapt response style and format', 'contextAdaptation.applyAdaptations', config.contextAdaptation.applyAdaptations, !config.contextAdaptation.enabled)}
          </div>
        </div>
      )}

      {/* Proactive Assistance Tab */}
      {selectedTab === 'proactive' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Proactive Assistance</h2>
            <p className="text-sm text-gray-500">Configure anticipatory help and pattern detection</p>
          </div>
          <div className="p-4 space-y-1">
            {renderToggle('Enable Proactive Assistance', 'Anticipate needs before users ask', 'proactiveAssistance.enabled', config.proactiveAssistance.enabled)}
            {renderToggle('Detect Patterns', 'Learn from user behavior patterns', 'proactiveAssistance.detectPatterns', config.proactiveAssistance.detectPatterns, !config.proactiveAssistance.enabled)}
            {renderToggle('Generate Suggestions', 'Proactively offer helpful suggestions', 'proactiveAssistance.generateSuggestions', config.proactiveAssistance.generateSuggestions, !config.proactiveAssistance.enabled)}
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Proactive features are experimental and may increase latency. Enable with caution.
            </p>
          </div>
        </div>
      )}

      {/* Knowledge Graph Tab */}
      {selectedTab === 'knowledge' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Knowledge Graph</h2>
            <p className="text-sm text-gray-500">Configure knowledge storage and retrieval</p>
          </div>
          <div className="p-4 space-y-1">
            {renderToggle('Enable Knowledge Graph', 'Use persistent knowledge storage', 'knowledgeGraph.enabled', config.knowledgeGraph.enabled)}
            {renderToggle('Query Relevant Knowledge', 'Retrieve stored knowledge for context', 'knowledgeGraph.queryRelevantKnowledge', config.knowledgeGraph.queryRelevantKnowledge, !config.knowledgeGraph.enabled)}
            {renderToggle('Extract and Store', 'Learn new knowledge from responses', 'knowledgeGraph.extractAndStore', config.knowledgeGraph.extractAndStore, !config.knowledgeGraph.enabled)}
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ℹ️ Knowledge graph requires additional database storage. Enable only if needed.
            </p>
          </div>
        </div>
      )}

      {/* Processing Pipeline Visualization */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Request Processing Pipeline</h2>
        <div className="flex items-center justify-between overflow-x-auto pb-4">
          {[
            { name: 'Moral Check', enabled: config.moralCompass.enabled, icon: '🧭' },
            { name: 'Context', enabled: config.contextAdaptation.enabled && config.contextAdaptation.detectContext, icon: '🎯' },
            { name: 'Knowledge', enabled: config.knowledgeGraph.enabled && config.knowledgeGraph.queryRelevantKnowledge, icon: '🧠' },
            { name: 'Patterns', enabled: config.proactiveAssistance.enabled && config.proactiveAssistance.detectPatterns, icon: '💡' },
            { name: 'Orchestrate', enabled: true, icon: '⚡' },
            { name: 'Confidence', enabled: config.confidenceCalibration.enabled, icon: '📊' },
            { name: 'Adapt Output', enabled: config.contextAdaptation.enabled && config.contextAdaptation.applyAdaptations, icon: '✨' },
            { name: 'Learn', enabled: config.selfImprovement.enabled && config.selfImprovement.recordPerformance, icon: '🚀' },
          ].map((step, idx) => (
            <React.Fragment key={step.name}>
              <div className={`flex flex-col items-center px-3 py-2 rounded-lg min-w-[80px] ${
                step.enabled ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-700 opacity-50'
              }`}>
                <span className="text-2xl">{step.icon}</span>
                <span className="text-xs mt-1 text-center">{step.name}</span>
              </div>
              {idx < 7 && (
                <span className="text-gray-400 mx-1">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
