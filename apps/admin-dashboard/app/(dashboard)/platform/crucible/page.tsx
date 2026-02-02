'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Settings,
  Users,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Clock,
  Trophy,
  RefreshCw,
  ChevronRight,
  Eye,
  Brain,
  Zap,
  Target,
  Shield,
  BarChart3,
  History,
  Lightbulb,
} from 'lucide-react';

interface CrucibleConfig {
  tenantId: string;
  enabled: boolean;
  defaultMaxQuestions: number;
  questionTimeoutSeconds: number;
  sessionTimeoutSeconds: number;
  minLlmsForCrucible: number;
  storeForLearning: boolean;
  sessionRetentionDays: number;
  detectCircularReasoning: boolean;
  circularCitationPenalty: number;
  scoreQuestionQuality: boolean;
  costModeQuestionLimits: Record<string, number>;
}

interface CrucibleSession {
  sessionId: string;
  methodName: string;
  status: string;
  totalQuestionsAsked: number;
  questionsRemaining: number;
  startedAt: string;
  completedAt?: string;
  participants: Array<{
    participantId: string;
    modelName: string;
    provider: string;
    canDeliberate: boolean;
    questionsAsked: number;
    circularCitations: number;
  }>;
}

interface ModelPerformance {
  modelId: string;
  modelName: string;
  sessionsParticipated: number;
  winRate: number;
  avgScore: number;
  avgQuestionQuality: number;
  circularCitationRate: number;
}

interface LearningInsight {
  type: string;
  modelId?: string;
  description: string;
  confidence: number;
  actionable: boolean;
}

interface DashboardData {
  config: CrucibleConfig;
  totalSessions: number;
  sessionsToday: number;
  avgSessionDuration: number;
  avgQuestionsPerSession: number;
  circularCitationsLast24h: number;
  topPerformingModels: ModelPerformance[];
  recentSessions: CrucibleSession[];
  recentInsights: LearningInsight[];
}

export default function CruciblePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'performance' | 'config' | 'system'>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/crucible/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const data = await response.json();
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const updateConfig = async (updates: Partial<CrucibleConfig>) => {
    try {
      const response = await fetch('/api/admin/crucible/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update config');
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              The Crucible
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Competitive Multi-LLM Deliberation System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchDashboard}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Crucible</span>
            <button
              onClick={() => updateConfig({ enabled: !dashboard?.config.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                dashboard?.config.enabled ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dashboard?.config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Total Sessions"
          value={dashboard?.totalSessions || 0}
          color="orange"
        />
        <SummaryCard
          icon={<Clock className="w-5 h-5" />}
          label="Sessions Today"
          value={dashboard?.sessionsToday || 0}
          color="blue"
        />
        <SummaryCard
          icon={<Zap className="w-5 h-5" />}
          label="Avg Questions"
          value={(dashboard?.avgQuestionsPerSession || 0).toFixed(1)}
          color="purple"
        />
        <SummaryCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Duration"
          value={formatDuration(dashboard?.avgSessionDuration || 0)}
          color="green"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Circular Citations (24h)"
          value={dashboard?.circularCitationsLast24h || 0}
          color="red"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'sessions', label: 'Sessions', icon: <History className="w-4 h-4" /> },
            { id: 'performance', label: 'Model Performance', icon: <Trophy className="w-4 h-4" /> },
            { id: 'config', label: 'Tenant Config', icon: <Settings className="w-4 h-4" /> },
            { id: 'system', label: 'System Defaults', icon: <Shield className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && dashboard && (
        <OverviewTab dashboard={dashboard} onSessionClick={setSelectedSession} />
      )}
      {activeTab === 'sessions' && dashboard && (
        <SessionsTab
          sessions={dashboard.recentSessions}
          selectedSession={selectedSession}
          onSessionClick={setSelectedSession}
        />
      )}
      {activeTab === 'performance' && dashboard && (
        <PerformanceTab models={dashboard.topPerformingModels} />
      )}
      {activeTab === 'config' && dashboard && (
        <ConfigTab config={dashboard.config} onUpdate={updateConfig} />
      )}
      {activeTab === 'system' && (
        <SystemConfigTab />
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          sessionId={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'orange' | 'blue' | 'purple' | 'green' | 'red';
}) {
  const colors = {
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  dashboard,
  onSessionClick,
}: {
  dashboard: DashboardData;
  onSessionClick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Performing Models */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Top Performing Models
        </h3>
        <div className="space-y-3">
          {dashboard.topPerformingModels.map((model, index) => (
            <div
              key={model.modelId}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{model.modelName}</p>
                  <p className="text-sm text-gray-500">{model.sessionsParticipated} sessions</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">{(model.winRate * 100).toFixed(0)}% win</p>
                <p className="text-sm text-gray-500">Avg: {model.avgScore.toFixed(2)}</p>
              </div>
            </div>
          ))}
          {dashboard.topPerformingModels.length === 0 && (
            <p className="text-gray-500 text-center py-4">No data yet</p>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          Recent Sessions
        </h3>
        <div className="space-y-2">
          {dashboard.recentSessions.slice(0, 5).map((session) => (
            <button
              key={session.sessionId}
              onClick={() => onSessionClick(session.sessionId)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <StatusBadge status={session.status} />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{session.methodName}</p>
                  <p className="text-sm text-gray-500">
                    {session.participants?.filter(p => p.canDeliberate).length || 0} LLMs • {session.totalQuestionsAsked} questions
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
          {dashboard.recentSessions.length === 0 && (
            <p className="text-gray-500 text-center py-4">No sessions yet</p>
          )}
        </div>
      </div>

      {/* Learning Insights */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Learning Insights (Last 7 Days)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dashboard.recentInsights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                insight.actionable
                  ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <InsightIcon type={insight.type} />
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{insight.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {(insight.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
          {dashboard.recentInsights.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-4">No insights yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionsTab({
  sessions,
  selectedSession,
  onSessionClick,
}: {
  sessions: CrucibleSession[];
  selectedSession: string | null;
  onSessionClick: (id: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Method</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Participants</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Questions</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Started</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sessions.map((session) => (
            <tr
              key={session.sessionId}
              className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                selectedSession === session.sessionId ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              }`}
            >
              <td className="px-4 py-3">
                <StatusBadge status={session.status} />
              </td>
              <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                {session.methodName}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {session.participants?.filter(p => p.canDeliberate).length || 0} LLMs
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                {session.totalQuestionsAsked} / {session.totalQuestionsAsked + session.questionsRemaining}
              </td>
              <td className="px-4 py-3 text-gray-500 text-sm">
                {new Date(session.startedAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onSessionClick(session.sessionId)}
                  className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No Crucible sessions yet
        </div>
      )}
    </div>
  );
}

function PerformanceTab({ models }: { models: ModelPerformance[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Rank</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Model</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Sessions</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Avg Score</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Question Quality</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Circular Citations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {models.map((model, index) => (
            <tr key={model.modelId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3">
                <span className={`font-bold ${
                  index === 0 ? 'text-yellow-500' :
                  index === 1 ? 'text-gray-400' :
                  index === 2 ? 'text-amber-600' : 'text-gray-500'
                }`}>
                  #{index + 1}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  <span className="font-medium text-gray-900 dark:text-white">{model.modelName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                {model.sessionsParticipated}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${model.winRate * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {(model.winRate * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                {model.avgScore.toFixed(3)}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  model.avgQuestionQuality > 0.7 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  model.avgQuestionQuality > 0.4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {(model.avgQuestionQuality * 100).toFixed(0)}%
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`${
                  model.circularCitationRate > 0.1 ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {(model.circularCitationRate * 100).toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {models.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No model performance data yet
        </div>
      )}
    </div>
  );
}

function ConfigTab({
  config,
  onUpdate,
}: {
  config: CrucibleConfig;
  onUpdate: (updates: Partial<CrucibleConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* General Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h3>
        <div className="space-y-4">
          <ConfigToggle
            label="Enable Crucible"
            description="Activate competitive deliberation for multi-LLM methods"
            checked={config.enabled}
            onChange={(enabled) => onUpdate({ enabled })}
          />
          <ConfigToggle
            label="Store for Learning"
            description="Save session data for learning and audit"
            checked={config.storeForLearning}
            onChange={(storeForLearning) => onUpdate({ storeForLearning })}
          />
          <ConfigToggle
            label="Detect Circular Reasoning"
            description="Identify and penalize circular citations"
            checked={config.detectCircularReasoning}
            onChange={(detectCircularReasoning) => onUpdate({ detectCircularReasoning })}
          />
          <ConfigToggle
            label="Score Question Quality"
            description="Rate questions as low/medium/high/exceptional"
            checked={config.scoreQuestionQuality}
            onChange={(scoreQuestionQuality) => onUpdate({ scoreQuestionQuality })}
          />
        </div>
      </div>

      {/* Limits & Timeouts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Limits & Timeouts</h3>
        <div className="space-y-4">
          <ConfigSlider
            label="Default Max Questions"
            value={config.defaultMaxQuestions}
            min={1}
            max={10}
            onChange={(defaultMaxQuestions) => onUpdate({ defaultMaxQuestions })}
          />
          <ConfigSlider
            label="Min LLMs for Crucible"
            value={config.minLlmsForCrucible}
            min={2}
            max={5}
            onChange={(minLlmsForCrucible) => onUpdate({ minLlmsForCrucible })}
          />
          <ConfigSlider
            label="Question Timeout (seconds)"
            value={config.questionTimeoutSeconds}
            min={10}
            max={120}
            step={10}
            onChange={(questionTimeoutSeconds) => onUpdate({ questionTimeoutSeconds })}
          />
          <ConfigSlider
            label="Session Timeout (seconds)"
            value={config.sessionTimeoutSeconds}
            min={60}
            max={600}
            step={30}
            onChange={(sessionTimeoutSeconds) => onUpdate({ sessionTimeoutSeconds })}
          />
          <ConfigSlider
            label="Circular Citation Penalty"
            value={config.circularCitationPenalty * 100}
            min={0}
            max={50}
            step={5}
            suffix="%"
            onChange={(v) => onUpdate({ circularCitationPenalty: v / 100 })}
          />
        </div>
      </div>

      {/* Cost Mode Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cost Mode Question Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(config.costModeQuestionLimits).map(([mode, limit]) => (
            <div key={mode} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white capitalize">{mode}</span>
                <span className="text-lg font-bold text-orange-500">{limit}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={limit}
                onChange={(e) =>
                  onUpdate({
                    costModeQuestionLimits: {
                      ...config.costModeQuestionLimits,
                      [mode]: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-orange-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemConfigTab() {
  const [systemConfig, setSystemConfig] = useState<{
    defaultMaxQuestions: number;
    questionTimeoutSeconds: number;
    sessionTimeoutSeconds: number;
    minLlmsForCrucible: number;
    defaultCostMode: string;
    costModeQuestionLimits: Record<string, number>;
    circularCitationPenalty: number;
    allowTenantOverride: boolean;
    allowUserOverride: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const response = await fetch('/api/admin/crucible/system-config');
        if (response.ok) {
          setSystemConfig(await response.json());
        }
      } catch (err) {
        console.error('Failed to fetch system config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSystemConfig();
  }, []);

  const updateSystemConfig = async (updates: Partial<typeof systemConfig>) => {
    if (!systemConfig) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/crucible/system-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...systemConfig, ...updates }),
      });
      if (response.ok) {
        setSystemConfig(await response.json());
      }
    } catch (err) {
      console.error('Failed to update system config:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!systemConfig) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load system configuration
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Override Permissions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-500" />
          Override Permissions
        </h3>
        <div className="space-y-4">
          <ConfigToggle
            label="Allow Tenant Overrides"
            description="Let Think Tank admins customize Crucible settings for their tenants"
            checked={systemConfig.allowTenantOverride}
            onChange={(allowTenantOverride) => updateSystemConfig({ allowTenantOverride })}
          />
          <ConfigToggle
            label="Allow User Overrides"
            description="Let users customize max questions per method (if tenant allows)"
            checked={systemConfig.allowUserOverride}
            onChange={(allowUserOverride) => updateSystemConfig({ allowUserOverride })}
          />
        </div>
      </div>

      {/* System Defaults */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Defaults</h3>
        <p className="text-sm text-gray-500 mb-4">
          These values apply to all tenants unless they override them.
        </p>
        <div className="space-y-4">
          <ConfigSlider
            label="Default Max Questions"
            value={systemConfig.defaultMaxQuestions}
            min={1}
            max={10}
            onChange={(defaultMaxQuestions) => updateSystemConfig({ defaultMaxQuestions })}
          />
          <ConfigSlider
            label="Min LLMs for Crucible"
            value={systemConfig.minLlmsForCrucible}
            min={2}
            max={5}
            onChange={(minLlmsForCrucible) => updateSystemConfig({ minLlmsForCrucible })}
          />
          <ConfigSlider
            label="Circular Citation Penalty"
            value={systemConfig.circularCitationPenalty * 100}
            min={0}
            max={50}
            step={5}
            suffix="%"
            onChange={(v) => updateSystemConfig({ circularCitationPenalty: v / 100 })}
          />
        </div>
      </div>

      {/* Cost Mode Defaults */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          System Cost Mode Limits
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Default question limits per cost mode. Tenants can override these.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(systemConfig.costModeQuestionLimits).map(([mode, limit]) => (
            <div key={mode} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white capitalize">{mode}</span>
                <span className="text-lg font-bold text-orange-500">{limit}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={limit}
                onChange={(e) =>
                  updateSystemConfig({
                    costModeQuestionLimits: {
                      ...systemConfig.costModeQuestionLimits,
                      [mode]: parseInt(e.target.value),
                    },
                  })
                }
                className="w-full accent-orange-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Hierarchy Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 lg:col-span-2">
        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Configuration Hierarchy</h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>User</strong> preferences override <strong>Tenant</strong> settings, which override <strong>System</strong> defaults.
          Users can set per-method max questions if both tenant and system allow it.
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-blue-600 dark:text-blue-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            System (this page)
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            Tenant (Think Tank Admin)
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            User (per method)
          </span>
        </div>
      </div>
    </div>
  );
}

function ConfigToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
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

function ConfigSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-bold text-orange-500">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-orange-500"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    initializing: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    pre_prompting: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    interrogating: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    deliberating: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    finalizing: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    completed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    timeout: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.initializing}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function InsightIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    model_strength: <TrendingUp className="w-4 h-4 text-green-500" />,
    model_weakness: <AlertTriangle className="w-4 h-4 text-red-500" />,
    question_pattern: <MessageSquare className="w-4 h-4 text-blue-500" />,
    answer_pattern: <Target className="w-4 h-4 text-purple-500" />,
    deliberation_dynamic: <Users className="w-4 h-4 text-orange-500" />,
  };

  return icons[type] || <Lightbulb className="w-4 h-4 text-yellow-500" />;
}

function SessionDetailModal({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const [session, setSession] = useState<CrucibleSession | null>(null);
  const [questions, setQuestions] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [sessionRes, questionsRes] = await Promise.all([
          fetch(`/api/admin/crucible/sessions/${sessionId}`),
          fetch(`/api/admin/crucible/sessions/${sessionId}/questions`),
        ]);
        
        if (sessionRes.ok) setSession(await sessionRes.json());
        if (questionsRes.ok) {
          const data = await questionsRes.json();
          setQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('Failed to fetch session details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [sessionId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Session Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : session ? (
          <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
            {/* Session Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">Method</p>
                <p className="font-medium text-gray-900 dark:text-white">{session.methodName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={session.status} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Questions</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {session.totalQuestionsAsked} / {session.totalQuestionsAsked + session.questionsRemaining}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Started</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {new Date(session.startedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Participants */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Participants</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {session.participants?.map((p) => (
                  <div
                    key={p.participantId}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-400">{p.participantId}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{p.modelName}</span>
                      {p.canDeliberate && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded">
                          LLM
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {p.questionsAsked}Q • {p.circularCitations} circular
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Questions */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Deliberation Log</h3>
              <div className="space-y-3">
                {questions.map((q: any, index) => (
                  <div key={q.questionId || index} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-400">Q{q.questionNumber}</span>
                      <span className="font-medium text-orange-600">{q.askerId}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-blue-600">{q.targetId}</span>
                      <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-xs rounded">
                        {q.questionType}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white mb-2">{q.questionText}</p>
                    {q.answer && (
                      <div className="mt-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                        <p className="text-gray-700 dark:text-gray-300 text-sm">{q.answer.answerText}</p>
                        {q.answer.circularCitationDetected && (
                          <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Circular citation detected
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No questions in this session</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">Session not found</div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
