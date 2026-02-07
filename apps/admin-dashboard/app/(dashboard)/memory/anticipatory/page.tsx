'use client';

/**
 * Anticipatory Memory Architecture - Admin Dashboard
 * 
 * Unified dashboard for all 5 leapfrog features:
 * 1. Autobiographical Knowledge Graph (AKG)
 * 2. Predictive Memory Prefetch
 * 3. Memory Contradiction Detector
 * 4. Organizational Memory Mesh
 * 5. Dream Insight Generator
 */

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

interface DashboardData {
  akg: {
    totalNodes: number;
    totalEdges: number;
    uniqueUsers: number;
    nodesByType: Record<string, number>;
    avgNodesPerUser: number;
    extractionSuccessRate: number;
    lastExtractionAt?: string;
    config: { enabled: boolean; extractionModel: string; minEntityConfidence: number };
  };
  prefetch: {
    totalPredictions: number;
    predictionAccuracy: number;
    avgPrefetchLatencyMs: number;
    cacheHitRate: number;
    memoriesPrefetched: number;
    config: { enabled: boolean; maxPrefetchNodes: number; minPrefetchConfidence: number };
  };
  contradictions: {
    totalDetected: number;
    unresolvedCount: number;
    autoResolvedCount: number;
    userResolvedCount: number;
    avgResolutionTimeHours: number;
    detectionAccuracy: number;
    config: { enabled: boolean; detectionModel: string; promptUserResolution: boolean };
  };
  orgMemory: {
    totalOrgNodes: number;
    activeConsents: number;
    totalContributions: number;
    complianceScansPassed: number;
    complianceScansFailed: number;
    nodesByPrivacyTier: Record<string, number>;
    nodesByClassification: Record<string, number>;
    config: { enabled: boolean; hipaaMode: boolean; requireExplicitConsent: boolean; requireAdminReview: boolean };
  };
  dreamInsights: {
    totalInsightsGenerated: number;
    insightsSurfaced: number;
    insightsHelpful: number;
    insightsByType: Record<string, number>;
    avgConfidence: number;
    tokensConsumedTotal: number;
    lastDreamCycleAt?: string;
    config: { enabled: boolean; insightModel: string; proactiveSurfacing: boolean };
  };
  health: {
    akgHealthy: boolean;
    prefetchHealthy: boolean;
    contradictionDetectorHealthy: boolean;
    orgMemoryHealthy: boolean;
    dreamInsightHealthy: boolean;
    overallStatus: string;
  };
  generatedAt: string;
}

interface Contradiction {
  contradictionId: string;
  newFactText: string;
  existingFactText: string;
  contradictionType: string;
  severity: number;
  explanation: string;
  status: string;
  createdAt: string;
}

interface DreamInsight {
  insightId: string;
  insightType: string;
  title: string;
  description: string;
  recommendation?: string;
  confidence: number;
  relevance: number;
  surfaced: boolean;
  userReaction?: string;
  createdAt: string;
}

// =============================================================================
// API Helpers
// =============================================================================

const API_BASE = '/api/admin/anticipatory-memory';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// =============================================================================
// Components
// =============================================================================

function StatCard({ label, value, subtitle, color = 'blue' }: {
  label: string; value: string | number; subtitle?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
}

function HealthBadge({ healthy, label }: { healthy: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      healthy ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
    }`}>
      <span className={`w-2 h-2 rounded-full mr-1.5 ${healthy ? 'bg-green-400' : 'bg-gray-400'}`} />
      {label}
    </span>
  );
}

function SectionHeader({ title, description, enabled }: {
  title: string; description: string; enabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {enabled !== undefined && (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function AnticipatoryMemoryPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'akg' | 'prefetch' | 'contradictions' | 'org-memory' | 'dream-insights'>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [insights, setInsights] = useState<DreamInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApi<DashboardData>('/dashboard');
      setDashboard(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContradictions = useCallback(async () => {
    try {
      const data = await fetchApi<Contradiction[]>('/contradictions/recent?limit=20');
      setContradictions(data);
    } catch { /* ignore */ }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const data = await fetchApi<DreamInsight[]>('/dream-insights/recent?limit=20');
      setInsights(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === 'contradictions') loadContradictions();
    if (activeTab === 'dream-insights') loadInsights();
  }, [activeTab, loadContradictions, loadInsights]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'akg' as const, label: 'Knowledge Graph' },
    { id: 'prefetch' as const, label: 'Prefetch' },
    { id: 'contradictions' as const, label: 'Contradictions' },
    { id: 'org-memory' as const, label: 'Org Memory' },
    { id: 'dream-insights' as const, label: 'Dream Insights' },
  ];

  if (loading && !dashboard) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Anticipatory Memory Architecture</h1>
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Anticipatory Memory Architecture</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Anticipatory Memory Architecture</h1>
        <p className="text-gray-500 mt-1">
          5 leapfrog features that put RADIANT 3-5 years ahead of Claude&apos;s persistent memory
        </p>
        {dashboard && (
          <div className="flex gap-2 mt-3">
            <HealthBadge healthy={dashboard.health.akgHealthy} label="AKG" />
            <HealthBadge healthy={dashboard.health.prefetchHealthy} label="Prefetch" />
            <HealthBadge healthy={dashboard.health.contradictionDetectorHealthy} label="Contradictions" />
            <HealthBadge healthy={dashboard.health.orgMemoryHealthy} label="Org Memory" />
            <HealthBadge healthy={dashboard.health.dreamInsightHealthy} label="Dream Insights" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {dashboard && activeTab === 'overview' && (
        <div className="space-y-8">
          {/* AKG Overview */}
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="1. Autobiographical Knowledge Graph"
              description="Living entity-relationship graph auto-extracted from every conversation"
              enabled={dashboard.akg.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Nodes" value={dashboard.akg.totalNodes} color="blue" />
              <StatCard label="Total Edges" value={dashboard.akg.totalEdges} color="blue" />
              <StatCard label="Unique Users" value={dashboard.akg.uniqueUsers} color="indigo" />
              <StatCard label="Extraction Rate" value={`${(dashboard.akg.extractionSuccessRate * 100).toFixed(0)}%`} color="green" />
            </div>
          </div>

          {/* Prefetch Overview */}
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="2. Predictive Memory Prefetch"
              description="ML model predicts what memories will be needed before the user asks"
              enabled={dashboard.prefetch.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Predictions (24h)" value={dashboard.prefetch.totalPredictions} color="purple" />
              <StatCard label="Accuracy" value={`${(dashboard.prefetch.predictionAccuracy * 100).toFixed(0)}%`} color="green" />
              <StatCard label="Avg Latency" value={`${dashboard.prefetch.avgPrefetchLatencyMs.toFixed(0)}ms`} color="blue" />
              <StatCard label="Prefetched" value={dashboard.prefetch.memoriesPrefetched} color="indigo" />
            </div>
          </div>

          {/* Contradiction Overview */}
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="3. Memory Contradiction Detector"
              description="Detects and resolves conflicting facts in user knowledge"
              enabled={dashboard.contradictions.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Detected" value={dashboard.contradictions.totalDetected} color="amber" />
              <StatCard label="Unresolved" value={dashboard.contradictions.unresolvedCount} color={dashboard.contradictions.unresolvedCount > 10 ? 'red' : 'amber'} />
              <StatCard label="Auto-Resolved" value={dashboard.contradictions.autoResolvedCount} color="green" />
              <StatCard label="Accuracy" value={`${(dashboard.contradictions.detectionAccuracy * 100).toFixed(0)}%`} color="green" />
            </div>
          </div>

          {/* Org Memory Overview */}
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="4. Organizational Memory Mesh"
              description="Shared knowledge across users with privacy tiers and regulatory compliance"
              enabled={dashboard.orgMemory.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Org Nodes" value={dashboard.orgMemory.totalOrgNodes} color="indigo" />
              <StatCard label="Active Consents" value={dashboard.orgMemory.activeConsents} color="green" />
              <StatCard label="Contributions" value={dashboard.orgMemory.totalContributions} color="blue" />
              <StatCard label="Compliance Pass" value={dashboard.orgMemory.complianceScansPassed} subtitle={`${dashboard.orgMemory.complianceScansFailed} failed`} color={dashboard.orgMemory.complianceScansFailed > 0 ? 'amber' : 'green'} />
            </div>
            <div className="mt-4 flex gap-2">
              {dashboard.orgMemory.config.hipaaMode && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">HIPAA Mode</span>
              )}
              {dashboard.orgMemory.config.requireExplicitConsent && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Explicit Consent Required</span>
              )}
              {dashboard.orgMemory.config.requireAdminReview && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">Admin Review Required</span>
              )}
            </div>
          </div>

          {/* Dream Insights Overview */}
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="5. Dream Insight Generator"
              description="Autonomous insight generation during Twilight Dreaming"
              enabled={dashboard.dreamInsights.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Insights Generated" value={dashboard.dreamInsights.totalInsightsGenerated} color="purple" />
              <StatCard label="Surfaced" value={dashboard.dreamInsights.insightsSurfaced} color="blue" />
              <StatCard label="Helpful" value={dashboard.dreamInsights.insightsHelpful} color="green" />
              <StatCard label="Avg Confidence" value={`${(dashboard.dreamInsights.avgConfidence * 100).toFixed(0)}%`} color="indigo" />
            </div>
          </div>
        </div>
      )}

      {dashboard && activeTab === 'akg' && (
        <div className="bg-white rounded-xl border p-6">
          <SectionHeader
            title="Autobiographical Knowledge Graph"
            description="Entity and relationship extraction from conversations"
            enabled={dashboard.akg.config.enabled}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Nodes" value={dashboard.akg.totalNodes} color="blue" />
            <StatCard label="Total Edges" value={dashboard.akg.totalEdges} color="blue" />
            <StatCard label="Avg Nodes/User" value={dashboard.akg.avgNodesPerUser.toFixed(1)} color="indigo" />
            <StatCard label="Model" value={dashboard.akg.config.extractionModel.split('/').pop() || ''} color="purple" />
          </div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Nodes by Entity Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(dashboard.akg.nodesByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-600 capitalize">{type}</span>
                <span className="text-sm font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && activeTab === 'contradictions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="Memory Contradiction Detector"
              description="Detects conflicting facts and resolves them"
              enabled={dashboard.contradictions.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Unresolved" value={dashboard.contradictions.unresolvedCount} color="amber" />
              <StatCard label="Auto-Resolved" value={dashboard.contradictions.autoResolvedCount} color="green" />
              <StatCard label="User-Resolved" value={dashboard.contradictions.userResolvedCount} color="blue" />
              <StatCard label="Avg Resolution" value={`${dashboard.contradictions.avgResolutionTimeHours.toFixed(1)}h`} color="indigo" />
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Recent Contradictions</h4>
            {contradictions.length === 0 ? (
              <p className="text-gray-500 text-sm">No contradictions found</p>
            ) : (
              <div className="space-y-3">
                {contradictions.map(c => (
                  <div key={c.contradictionId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.status === 'detected' ? 'bg-amber-100 text-amber-700' :
                        c.status === 'auto_resolved' ? 'bg-green-100 text-green-700' :
                        c.status === 'user_resolved' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {c.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400">
                        {c.contradictionType} &middot; severity {(c.severity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">New Fact</p>
                        <p className="text-gray-700">{c.newFactText}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Existing Fact</p>
                        <p className="text-gray-700">{c.existingFactText}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{c.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {dashboard && activeTab === 'org-memory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="Organizational Memory Mesh"
              description="Regulatory-compliant shared knowledge with privacy tiers"
              enabled={dashboard.orgMemory.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Org Nodes" value={dashboard.orgMemory.totalOrgNodes} color="indigo" />
              <StatCard label="Active Consents" value={dashboard.orgMemory.activeConsents} color="green" />
              <StatCard label="Contributions" value={dashboard.orgMemory.totalContributions} color="blue" />
              <StatCard label="Scans Failed" value={dashboard.orgMemory.complianceScansFailed} color={dashboard.orgMemory.complianceScansFailed > 0 ? 'red' : 'green'} />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">By Privacy Tier</h4>
                {Object.entries(dashboard.orgMemory.nodesByPrivacyTier).map(([tier, count]) => (
                  <div key={tier} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded mb-1">
                    <span className="text-sm text-gray-600 capitalize">{tier}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">By Classification</h4>
                {Object.entries(dashboard.orgMemory.nodesByClassification).map(([cls, count]) => (
                  <div key={cls} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded mb-1">
                    <span className="text-sm text-gray-600 capitalize">{cls.replace('_', ' ')}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Compliance Status</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-white text-blue-700 text-xs rounded border border-blue-200">
                  GDPR Art. 6/7: {dashboard.orgMemory.config.requireExplicitConsent ? 'Explicit Consent' : 'Legitimate Interest'}
                </span>
                <span className={`px-2 py-1 text-xs rounded border ${
                  dashboard.orgMemory.config.hipaaMode
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}>
                  HIPAA: {dashboard.orgMemory.config.hipaaMode ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-1 bg-white text-green-700 text-xs rounded border border-green-200">
                  SOC2: Audit Trail Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {dashboard && activeTab === 'dream-insights' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <SectionHeader
              title="Dream Insight Generator"
              description="Autonomous insights generated during Twilight Dreaming"
              enabled={dashboard.dreamInsights.config.enabled}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Generated" value={dashboard.dreamInsights.totalInsightsGenerated} color="purple" />
              <StatCard label="Surfaced" value={dashboard.dreamInsights.insightsSurfaced} color="blue" />
              <StatCard label="Helpful" value={dashboard.dreamInsights.insightsHelpful} color="green" />
              <StatCard label="Tokens Used" value={dashboard.dreamInsights.tokensConsumedTotal.toLocaleString()} color="amber" />
            </div>

            {Object.keys(dashboard.dreamInsights.insightsByType).length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">By Type</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(dashboard.dreamInsights.insightsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center px-3 py-2 bg-purple-50 rounded">
                      <span className="text-sm text-purple-600 capitalize">{type.replace('_', ' ')}</span>
                      <span className="text-sm font-medium text-purple-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Recent Insights</h4>
            {insights.length === 0 ? (
              <p className="text-gray-500 text-sm">No insights generated yet</p>
            ) : (
              <div className="space-y-3">
                {insights.map(insight => (
                  <div key={insight.insightId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium capitalize">
                          {insight.insightType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-400">
                          confidence {(insight.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {insight.surfaced && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">surfaced</span>
                        )}
                        {insight.userReaction && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            insight.userReaction === 'helpful' ? 'bg-green-100 text-green-700' :
                            insight.userReaction === 'irrelevant' ? 'bg-gray-100 text-gray-600' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {insight.userReaction}
                          </span>
                        )}
                      </div>
                    </div>
                    <h5 className="font-medium text-gray-900">{insight.title}</h5>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                    {insight.recommendation && (
                      <p className="text-sm text-blue-600 mt-2 italic">{insight.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {dashboard && activeTab === 'prefetch' && (
        <div className="bg-white rounded-xl border p-6">
          <SectionHeader
            title="Predictive Memory Prefetch"
            description="Pre-warms AKG nodes based on learned access patterns"
            enabled={dashboard.prefetch.config.enabled}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Predictions (24h)" value={dashboard.prefetch.totalPredictions} color="purple" />
            <StatCard label="Accuracy" value={`${(dashboard.prefetch.predictionAccuracy * 100).toFixed(0)}%`} color="green" />
            <StatCard label="Cache Hit Rate" value={`${(dashboard.prefetch.cacheHitRate * 100).toFixed(0)}%`} color="blue" />
            <StatCard label="Avg Latency" value={`${dashboard.prefetch.avgPrefetchLatencyMs.toFixed(1)}ms`} color="indigo" />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Configuration</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Max Prefetch Nodes</span>
                <span className="font-medium">{dashboard.prefetch.config.maxPrefetchNodes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Min Confidence</span>
                <span className="font-medium">{(dashboard.prefetch.config.minPrefetchConfidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
