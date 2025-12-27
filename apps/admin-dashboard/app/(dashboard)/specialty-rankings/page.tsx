'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, RefreshCw, Trophy, TrendingUp, Lock, Search, Settings, Clock, Zap, Sliders, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface RankingData {
  modelId: string;
  provider: string;
  score: number;
  tier: string;
  trend: string;
  isLocked?: boolean;
  adminOverride?: number;
}

interface ScoringWeights {
  benchmarkWeight: number;
  communityWeight: number;
  internalWeight: number;
}

interface ResearchSchedule {
  scheduleId: string;
  name: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// Orchestration Modes
const ORCHESTRATION_MODES = {
  thinking: { name: 'Thinking', description: 'Standard reasoning with step-by-step analysis', icon: '💭' },
  extended_thinking: { name: 'Extended Thinking', description: 'Deep multi-step reasoning for complex problems', icon: '🧠' },
  research: { name: 'Research', description: 'Information gathering and synthesis', icon: '🔬' },
  creative: { name: 'Creative', description: 'Divergent thinking and idea generation', icon: '🎨' },
  analytical: { name: 'Analytical', description: 'Data analysis and pattern recognition', icon: '📊' },
  coding: { name: 'Coding', description: 'Code generation and debugging', icon: '💻' },
  conversational: { name: 'Conversational', description: 'Natural dialogue and engagement', icon: '💬' },
  fast: { name: 'Fast', description: 'Quick responses with minimal latency', icon: '⚡' },
  precise: { name: 'Precise', description: 'High accuracy with verification', icon: '🎯' },
  balanced: { name: 'Balanced', description: 'Optimal cost/quality/speed tradeoff', icon: '⚖️' },
};

const SPECIALTY_CATEGORIES = {
  reasoning: { name: 'Reasoning & Logic', icon: '🧠', color: 'purple' },
  coding: { name: 'Code Generation', icon: '💻', color: 'blue' },
  math: { name: 'Mathematics', icon: '📐', color: 'green' },
  creative: { name: 'Creative Writing', icon: '✍️', color: 'pink' },
  analysis: { name: 'Data Analysis', icon: '📊', color: 'orange' },
  research: { name: 'Research & Synthesis', icon: '🔬', color: 'cyan' },
  legal: { name: 'Legal & Compliance', icon: '⚖️', color: 'gray' },
  medical: { name: 'Medical & Healthcare', icon: '🏥', color: 'red' },
  finance: { name: 'Finance & Trading', icon: '💰', color: 'emerald' },
  science: { name: 'Scientific', icon: '🔭', color: 'indigo' },
  debugging: { name: 'Debugging & QA', icon: '🐛', color: 'amber' },
  architecture: { name: 'System Architecture', icon: '🏗️', color: 'slate' },
  security: { name: 'Security', icon: '🔐', color: 'rose' },
  vision: { name: 'Vision & Images', icon: '👁️', color: 'violet' },
  audio: { name: 'Audio & Speech', icon: '🎤', color: 'fuchsia' },
  conversation: { name: 'Conversational', icon: '💬', color: 'lime' },
  instruction: { name: 'Instruction Following', icon: '📋', color: 'stone' },
  speed: { name: 'Low Latency', icon: '⚡', color: 'yellow' },
  accuracy: { name: 'High Accuracy', icon: '🎯', color: 'green' },
  safety: { name: 'Safety & Alignment', icon: '🛡️', color: 'emerald' },
};

// Default ranking data (fallback when API unavailable)
const DEFAULT_RANKINGS: RankingData[] = [
  { modelId: 'anthropic/claude-3-5-sonnet-20241022', provider: 'anthropic', score: 95, tier: 'S', trend: 'stable' },
  { modelId: 'openai/o1', provider: 'openai', score: 94, tier: 'S', trend: 'improving' },
  { modelId: 'openai/gpt-4o', provider: 'openai', score: 91, tier: 'A', trend: 'stable' },
  { modelId: 'google/gemini-1.5-pro', provider: 'google', score: 88, tier: 'A', trend: 'improving' },
  { modelId: 'deepseek/deepseek-chat', provider: 'deepseek', score: 85, tier: 'B', trend: 'improving' },
  { modelId: 'meta/llama-3.1-405b', provider: 'meta', score: 82, tier: 'B', trend: 'stable' },
  { modelId: 'xai/grok-2', provider: 'xai', score: 80, tier: 'B', trend: 'improving' },
  { modelId: 'mistral/mistral-large', provider: 'mistral', score: 78, tier: 'C', trend: 'stable' },
];

type SpecialtyKey = keyof typeof SPECIALTY_CATEGORIES;

type ModeKey = keyof typeof ORCHESTRATION_MODES;

export default function SpecialtyRankingsPage() {
  const [selectedTab, setSelectedTab] = useState<'specialties' | 'modes' | 'weights' | 'schedule'>('specialties');
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyKey>('reasoning');
  const [selectedMode, setSelectedMode] = useState<ModeKey>('thinking');
  const [rankings, setRankings] = useState<RankingData[]>(DEFAULT_RANKINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Never');
  const [isResearching, setIsResearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);
  
  // Scoring weights
  const [benchmarkWeight, setBenchmarkWeight] = useState(50);
  const [communityWeight, setCommunityWeight] = useState(30);
  const [internalWeight, setInternalWeight] = useState(20);
  
  // Schedule settings
  const [scheduleFrequency, setScheduleFrequency] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'S': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 'A': return 'bg-green-500 text-white';
      case 'B': return 'bg-blue-500 text-white';
      case 'C': return 'bg-gray-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'F': return 'bg-red-500 text-white';
      default: return 'bg-gray-300';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default: return <span className="text-gray-400">—</span>;
    }
  };

  // Fetch rankings for selected specialty
  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/specialty-rankings/specialty/${selectedSpecialty}`);
      if (!res.ok) throw new Error('Failed to fetch rankings');
      const data = await res.json();
      setRankings(data.rankings || DEFAULT_RANKINGS);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Fetch rankings error:', err);
      setRankings(DEFAULT_RANKINGS);
    } finally {
      setLoading(false);
    }
  }, [selectedSpecialty]);

  // Fetch weights
  const fetchWeights = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/specialty-rankings/weights`);
      if (!res.ok) return;
      const data = await res.json();
      setBenchmarkWeight(Math.round(data.benchmarkWeight * 100));
      setCommunityWeight(Math.round(data.communityWeight * 100));
      setInternalWeight(Math.round(data.internalWeight * 100));
    } catch (err) {
      console.error('Fetch weights error:', err);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
    fetchWeights();
  }, [fetchRankings, fetchWeights]);

  const handleResearch = async () => {
    setIsResearching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/specialty-rankings/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'specialty', target: selectedSpecialty }),
      });
      if (!res.ok) throw new Error('Research failed');
      await fetchRankings();
    } catch (err) {
      setError('Research failed. Please try again.');
      console.error('Research error:', err);
    } finally {
      setIsResearching(false);
    }
  };

  const handleOverride = async (modelId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/specialty-rankings/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, specialty: selectedSpecialty, score: overrideScore }),
      });
      if (!res.ok) throw new Error('Override failed');
      setRankings((prev: RankingData[]) => prev.map((r: RankingData) => 
        r.modelId === modelId ? { ...r, score: overrideScore, isLocked: true } : r
      ).sort((a: RankingData, b: RankingData) => b.score - a.score));
    } catch (err) {
      setError('Override failed. Please try again.');
      console.error('Override error:', err);
    }
    setEditingModel(null);
  };

  const handleSaveWeights = async () => {
    try {
      const total = benchmarkWeight + communityWeight + internalWeight;
      const res = await fetch(`${API_BASE}/admin/specialty-rankings/weights`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benchmarkWeight: benchmarkWeight / total,
          communityWeight: communityWeight / total,
          internalWeight: internalWeight / total,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setError(null);
    } catch (err) {
      setError('Failed to save weights.');
      console.error('Save weights error:', err);
    }
  };

  const filteredRankings = rankings.filter((r: RankingData) => 
    r.modelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-7 h-7" />
            Specialty Rankings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered proficiency rankings for models across 20 specialty categories
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResearch}
            disabled={isResearching}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isResearching ? 'animate-spin' : ''}`} />
            {isResearching ? 'Researching...' : 'Research Rankings'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { key: 'specialties', label: 'Specialty Rankings', icon: Trophy },
            { key: 'modes', label: 'Mode Rankings', icon: Zap },
            { key: 'weights', label: 'Scoring Weights', icon: Sliders },
            { key: 'schedule', label: 'Research Schedule', icon: Clock },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Specialties Tab */}
      {selectedTab === 'specialties' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500">Specialty Categories</p>
              <p className="text-2xl font-bold text-purple-600">{Object.keys(SPECIALTY_CATEGORIES).length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500">Ranked Models</p>
              <p className="text-2xl font-bold text-blue-600">{rankings.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-xs text-gray-500">S-Tier Models</p>
              <p className="text-2xl font-bold text-yellow-600">{rankings.filter((r: RankingData) => r.tier === 'S').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Last Updated</p>
          <p className="text-sm font-medium text-gray-600">{lastUpdated}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Specialty Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Specialties
          </h3>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {Object.entries(SPECIALTY_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setSelectedSpecialty(key as SpecialtyKey)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedSpecialty === key
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rankings Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-2xl">{SPECIALTY_CATEGORIES[selectedSpecialty].icon}</span>
                  {SPECIALTY_CATEGORIES[selectedSpecialty].name} Leaderboard
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRankings.map((ranking: RankingData, index: number) => (
                    <tr key={ranking.modelId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{ranking.modelId.split('/')[1]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 capitalize">{ranking.provider}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editingModel === ranking.modelId ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={overrideScore}
                            onChange={(e) => setOverrideScore(parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-purple-500"
                                style={{ width: `${ranking.score}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono">{ranking.score}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getTierColor(ranking.tier)}`}>
                          {ranking.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getTrendIcon(ranking.trend)}
                      </td>
                      <td className="px-4 py-3">
                        {editingModel === ranking.modelId ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOverride(ranking.modelId)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingModel(null)}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingModel(ranking.modelId);
                              setOverrideScore(ranking.score);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Override
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Research Info */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">How Rankings Work</h4>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <li>• <strong>Brain Research:</strong> AI searches benchmarks, reviews, and community feedback</li>
              <li>• <strong>Benchmark Scores:</strong> MMLU, HumanEval, MATH, and domain-specific tests</li>
              <li>• <strong>Community Input:</strong> Aggregated from AI forums, Reddit, and expert reviews</li>
              <li>• <strong>Internal Testing:</strong> Usage patterns and success rates from RADIANT deployments</li>
              <li>• <strong>Admin Override:</strong> Manually lock rankings for specific use cases</li>
            </ul>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Modes Tab */}
      {selectedTab === 'modes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Orchestration Modes
              </h3>
              <div className="space-y-1">
                {Object.entries(ORCHESTRATION_MODES).map(([key, mode]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedMode(key as ModeKey)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedMode === key
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{mode.icon}</span>
                      <span className="text-sm font-medium">{mode.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">{mode.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">{ORCHESTRATION_MODES[selectedMode].icon}</span>
                  {ORCHESTRATION_MODES[selectedMode].name} Mode Rankings
                </h3>
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rankings.slice(0, 5).map((r: RankingData, i: number) => (
                      <tr key={r.modelId}>
                        <td className="px-4 py-3 font-bold">{i + 1}</td>
                        <td className="px-4 py-3">{r.modelId.split('/')[1]}</td>
                        <td className="px-4 py-3">{r.score}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${getTierColor(r.tier)}`}>{r.tier}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weights Tab */}
      {selectedTab === 'weights' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5" />
              Scoring Weight Configuration
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Adjust how different data sources contribute to the final ranking score. Weights are automatically normalized to sum to 100%.
            </p>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-medium">Benchmark Score Weight</label>
                  <span className="text-purple-600 font-mono">{benchmarkWeight}%</span>
                </div>
                <input type="range" min="0" max="100" value={benchmarkWeight} onChange={(e) => setBenchmarkWeight(parseInt(e.target.value))} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">Weight for published benchmarks (MMLU, HumanEval, MATH, etc.)</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-medium">Community Score Weight</label>
                  <span className="text-blue-600 font-mono">{communityWeight}%</span>
                </div>
                <input type="range" min="0" max="100" value={communityWeight} onChange={(e) => setCommunityWeight(parseInt(e.target.value))} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">Weight for community reviews and feedback</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-medium">Internal Score Weight</label>
                  <span className="text-green-600 font-mono">{internalWeight}%</span>
                </div>
                <input type="range" min="0" max="100" value={internalWeight} onChange={(e) => setInternalWeight(parseInt(e.target.value))} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">Weight for internal usage data from RADIANT deployments</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t">
              <button onClick={handleSaveWeights} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save Weights</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {selectedTab === 'schedule' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Research Schedule Configuration
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatic Research</p>
                  <p className="text-sm text-gray-500">Automatically research and update rankings</p>
                </div>
                <button onClick={() => setScheduleEnabled(!scheduleEnabled)} className={`relative w-12 h-6 rounded-full transition-colors ${scheduleEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${scheduleEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div>
                <label className="font-medium block mb-2">Research Frequency</label>
                <select value={scheduleFrequency} onChange={(e) => setScheduleFrequency(e.target.value as typeof scheduleFrequency)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm"><strong>Last Research:</strong> 2 hours ago</p>
                <p className="text-sm"><strong>Next Scheduled:</strong> Tomorrow at 3:00 AM</p>
              </div>
              <button onClick={handleResearch} disabled={isResearching} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw className={`w-4 h-4 ${isResearching ? 'animate-spin' : ''}`} />
                {isResearching ? 'Researching...' : 'Run Research Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
