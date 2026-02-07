'use client';

// RADIANT v7.11.0 - Heterogeneous Model Consensus Admin Dashboard
//
// Provides visibility into the cross-model consensus system:
// - Agreement scores, confidence levels, hallucination risk
// - Model leaderboard (win rates across providers)
// - Evaluation history with drill-down
// - Configuration management
// - Test evaluation runner

import { useState, useEffect, useCallback } from 'react';

interface ConsensusConfig {
  enabled: boolean;
  minModels: number;
  maxModels: number;
  minProviders: number;
  maxCostPerEvaluationUsd: number;
  maxLatencyMs: number;
  reflexionThreshold: number;
  hallucinationThreshold: number;
  winnerSelectionStrategy: string;
  useEmbeddingSimilarity: boolean;
  embeddingModel: string;
}

interface ConsensusMetrics {
  totalEvaluations: number;
  avgAgreement: number;
  avgCrossProviderAgreement: number;
  avgConfidence: number;
  avgHallucinationRisk: number;
  reflexionTriggerCount: number;
  totalCostUsd: number;
  avgCostPerEvaluationUsd: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

interface ConsensusEvaluation {
  consensusId: string;
  participantCount: number;
  providerCount: number;
  overallAgreement: number;
  crossProviderAgreement: number;
  confidence: number;
  winningModel: string;
  winningProvider: string;
  hallucinationRisk: number;
  triggerReflexion: boolean;
  totalCostUsd: number;
  totalLatencyMs: number;
  createdAt: string;
}

interface ModelLeaderboardEntry {
  modelId: string;
  provider: string;
  winRate: number;
  avgAgreement: number;
  avgCostUsd: number;
  totalParticipations: number;
}

interface DashboardData {
  config: ConsensusConfig;
  metrics: ConsensusMetrics;
  recentEvaluations: ConsensusEvaluation[];
  modelLeaderboard: ModelLeaderboardEntry[];
}

export default function ConsensusPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'evaluations' | 'leaderboard' | 'config' | 'test'>('overview');
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/consensus/dashboard');
      const data = await res.json();
      if (data.success) {
        setDashboard(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleTestEvaluation = async () => {
    if (!testPrompt.trim()) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/consensus/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await res.json();
      setTestResult(data.data);
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setTestRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-red-800 dark:text-red-200 font-medium">Error</h3>
          <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
          <button onClick={fetchDashboard} className="mt-2 text-sm text-red-700 dark:text-red-300 underline">Retry</button>
        </div>
      </div>
    );
  }

  const m = dashboard?.metrics;
  const c = dashboard?.config;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Heterogeneous Model Consensus</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cross-model agreement scoring — when Claude, GPT-4, and Gemini all agree, the answer is very likely correct.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            c?.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {c?.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <button onClick={fetchDashboard} className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Agreement</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {((m?.avgAgreement || 0) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">{m?.totalEvaluations || 0} evaluations</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Cross-Provider</div>
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {((m?.avgCrossProviderAgreement || 0) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Most meaningful signal</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Confidence</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
            {((m?.avgConfidence || 0) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Composite score</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Hallucination Risk</div>
          <div className={`text-3xl font-bold mt-1 ${
            (m?.avgHallucinationRisk || 0) > 0.5 ? 'text-red-600 dark:text-red-400' :
            (m?.avgHallucinationRisk || 0) > 0.3 ? 'text-amber-600 dark:text-amber-400' :
            'text-green-600 dark:text-green-400'
          }`}>
            {((m?.avgHallucinationRisk || 0) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {m?.reflexionTriggerCount || 0} reflexion triggers
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Cost</div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            ${(m?.avgCostPerEvaluationUsd || 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {m?.avgLatencyMs || 0}ms avg latency
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {(['overview', 'evaluations', 'leaderboard', 'config', 'test'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">How It Works</h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
                <span>Select diverse panel of models (max provider + architecture diversity)</span>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">2</span>
                <span>Query all models in PARALLEL (latency = slowest single model)</span>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">3</span>
                <span>Compute pairwise semantic similarity between all responses</span>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">4</span>
                <span>Select winning response with highest cross-provider agreement</span>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">5</span>
                <span>Flag low-agreement results for reflexion/hallucination review</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Scoring</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Overall Agreement</span>
                <span className="font-medium">Weighted mean of all pairwise similarities</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Cross-Provider</span>
                <span className="font-medium">Only pairs from DIFFERENT providers</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Confidence</span>
                <span className="font-medium">50% cross-provider + 30% overall + 20% diversity</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Hallucination Risk</span>
                <span className="font-medium">1.0 - crossProviderAgreement (when low)</span>
              </div>
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300">
                Reflexion threshold: {((c?.reflexionThreshold || 0.6) * 100).toFixed(0)}% | Hallucination threshold: {((c?.hallucinationThreshold || 0.4) * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluations Tab */}
      {activeTab === 'evaluations' && dashboard?.recentEvaluations && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ID</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Models</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Providers</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Agreement</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">X-Provider</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Confidence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Winner</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Risk</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cost</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {dashboard.recentEvaluations.map(ev => (
                  <tr key={ev.consensusId} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${ev.triggerReflexion ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-400">{ev.consensusId.substring(0, 8)}</td>
                    <td className="px-4 py-2 text-center">{ev.participantCount}</td>
                    <td className="px-4 py-2 text-center">{ev.providerCount}</td>
                    <td className="px-4 py-2 text-right font-medium">{(ev.overallAgreement * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right font-medium text-indigo-600 dark:text-indigo-400">{(ev.crossProviderAgreement * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right">{(ev.confidence * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 font-mono text-xs">{ev.winningModel.split('/')[1] || ev.winningModel}</td>
                    <td className={`px-4 py-2 text-right font-medium ${
                      ev.hallucinationRisk > 0.5 ? 'text-red-600' : ev.hallucinationRisk > 0.3 ? 'text-amber-600' : 'text-green-600'
                    }`}>{(ev.hallucinationRisk * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right text-gray-500">${ev.totalCostUsd.toFixed(4)}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(ev.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && dashboard?.modelLeaderboard && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Model Leaderboard</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Win rate and agreement scores across all consensus evaluations</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Rank</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Provider</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Win Rate</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Avg Agreement</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Avg Cost</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Participations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {dashboard.modelLeaderboard.map((entry, i) => (
                  <tr key={entry.modelId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2">
                      <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-50 text-gray-400'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{entry.modelId}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{entry.provider}</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-600 dark:text-blue-400">{(entry.winRate * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right">{(entry.avgAgreement * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right text-gray-500">${entry.avgCostUsd.toFixed(4)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{entry.totalParticipations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && c && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Consensus Configuration</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500 dark:text-gray-400">Enabled:</span> <span className="font-medium">{c.enabled ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Min Models:</span> <span className="font-medium">{c.minModels}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Max Models:</span> <span className="font-medium">{c.maxModels}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Min Providers:</span> <span className="font-medium">{c.minProviders}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Max Cost/Eval:</span> <span className="font-medium">${c.maxCostPerEvaluationUsd}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Max Latency:</span> <span className="font-medium">{c.maxLatencyMs}ms</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Reflexion Threshold:</span> <span className="font-medium">{(c.reflexionThreshold * 100).toFixed(0)}%</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Hallucination Threshold:</span> <span className="font-medium">{(c.hallucinationThreshold * 100).toFixed(0)}%</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Winner Strategy:</span> <span className="font-medium">{c.winnerSelectionStrategy}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Use Embeddings:</span> <span className="font-medium">{c.useEmbeddingSimilarity ? 'Yes' : 'No'}</span></div>
            <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400">Embedding Model:</span> <span className="font-mono text-xs">{c.embeddingModel}</span></div>
          </div>
        </div>
      )}

      {/* Test Tab */}
      {activeTab === 'test' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Test Consensus Evaluation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Run a test evaluation to see how multiple models respond and agree on a prompt.
            </p>
            <div className="space-y-3">
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt to test consensus... (e.g., 'What is the capital of France?')"
                className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
              />
              <button
                onClick={handleTestEvaluation}
                disabled={testRunning || !testPrompt.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {testRunning ? 'Running evaluation...' : 'Run Consensus Evaluation'}
              </button>
            </div>
          </div>

          {testResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Results</h3>
              <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
