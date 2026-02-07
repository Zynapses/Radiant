'use client';

// RADIANT v7.11.0 - Inference Response Cache Admin Dashboard
//
// Provides real-time visibility into the inference cache system:
// - Hit rate, cost savings, and latency improvements
// - Configuration management (TTL, exclusions, capacity)
// - Cache entry browser with invalidation controls
// - Audit log of all cache operations
// - Model-level breakdown of cache performance

import { useState, useEffect, useCallback } from 'react';

interface CacheConfig {
  tenantId: string | null;
  enabled: boolean;
  defaultTtlSeconds: number;
  maxEntriesPerTenant: number;
  maxResponseSizeBytes: number;
  minPromptLengthToCache: number;
  hashAlgorithm: string;
  excludedTaskTypes: string[];
  excludedModels: string[];
  maxTemperatureToCache: number;
  cachePiiResponses: boolean;
  l1CacheSize: number;
  updatedAt: string;
  updatedBy: string;
}

interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalCostSavedUsd: number;
  projectedMonthlySavingsUsd: number;
  totalLatencySavedMs: number;
  avgLatencyReductionMs: number;
  avgCacheResponseTimeMs: number;
  activeEntries: number;
  totalEntries: number;
  totalStorageSizeBytes: number;
  evictionsInPeriod: number;
  invalidationsInPeriod: number;
  topCachedModels: Array<{ model_id: string; hit_count: number; cost_saved_usd: number }>;
}

interface CacheEvent {
  eventId: string;
  cacheKey: string;
  eventType: string;
  modelId: string;
  responseTimeMs: number;
  costSavedUsd: number;
  createdAt: string;
}

interface ModelBreakdown {
  modelId: string;
  provider: string;
  totalEntries: number;
  hitRate: number;
  costSavedUsd: number;
}

interface DashboardData {
  config: CacheConfig;
  metrics: CacheMetrics;
  recentEvents: CacheEvent[];
  modelBreakdown: ModelBreakdown[];
}

export default function InferenceCachePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'events' | 'models'>('overview');
  const [configEditing, setConfigEditing] = useState(false);
  const [configDraft, setConfigDraft] = useState<Partial<CacheConfig>>({});

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inference-cache/dashboard');
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

  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge ALL cache entries? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/inference-cache/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      alert(data.message || 'Cache purged');
      fetchDashboard();
    } catch (err) {
      alert('Failed to purge cache');
    }
  };

  const handleConfigSave = async () => {
    try {
      const res = await fetch('/api/admin/inference-cache/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configDraft),
      });
      const data = await res.json();
      if (data.success) {
        setConfigEditing(false);
        fetchDashboard();
      }
    } catch (err) {
      alert('Failed to save configuration');
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
          <h3 className="text-red-800 dark:text-red-200 font-medium">Error loading cache dashboard</h3>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inference Response Cache</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Hash-based semantic deduplication for AI inference calls. Reduces cost and latency by caching identical requests.
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Hit Rate (24h)</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {((m?.hitRate || 0) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {m?.cacheHits || 0} hits / {m?.totalRequests || 0} requests
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Cost Saved (24h)</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
            ${(m?.totalCostSavedUsd || 0).toFixed(4)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Projected: ${(m?.projectedMonthlySavingsUsd || 0).toFixed(2)}/month
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Latency Saved (24h)</div>
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {((m?.totalLatencySavedMs || 0) / 1000).toFixed(1)}s
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Avg reduction: {m?.avgLatencyReductionMs || 0}ms per hit
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Entries</div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {(m?.activeEntries || 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {((m?.totalStorageSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB storage
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {(['overview', 'config', 'events', 'models'] as const).map(tab => (
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

      {/* Tab Content */}
      {activeTab === 'overview' && m && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Top Cached Models</h3>
            {m.topCachedModels && m.topCachedModels.length > 0 ? (
              <div className="space-y-2">
                {m.topCachedModels.map((model, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{model.model_id}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{model.hit_count} hits</span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">${model.cost_saved_usd?.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No cache hits yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'config' && c && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Cache Configuration</h3>
            <div className="flex gap-2">
              {configEditing ? (
                <>
                  <button onClick={() => setConfigEditing(false)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md">Cancel</button>
                  <button onClick={handleConfigSave} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                </>
              ) : (
                <button onClick={() => { setConfigEditing(true); setConfigDraft(c); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Edit</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500 dark:text-gray-400">Enabled:</span> <span className="font-medium">{c.enabled ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">TTL:</span> <span className="font-medium">{(c.defaultTtlSeconds / 86400).toFixed(0)} days</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Max Entries:</span> <span className="font-medium">{c.maxEntriesPerTenant.toLocaleString()}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Max Response Size:</span> <span className="font-medium">{(c.maxResponseSizeBytes / 1024).toFixed(0)}KB</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Max Temperature:</span> <span className="font-medium">{c.maxTemperatureToCache}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Cache PII:</span> <span className="font-medium">{c.cachePiiResponses ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">L1 Cache Size:</span> <span className="font-medium">{c.l1CacheSize} entries</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">Hash Algorithm:</span> <span className="font-medium">{c.hashAlgorithm}</span></div>
            <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400">Excluded Models:</span> <span className="font-mono text-xs">{c.excludedModels.join(', ') || 'None'}</span></div>
            <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400">Excluded Task Types:</span> <span className="font-mono text-xs">{c.excludedTaskTypes.join(', ') || 'None'}</span></div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={handlePurge} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
              Purge All Entries
            </button>
          </div>
        </div>
      )}

      {activeTab === 'events' && dashboard?.recentEvents && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Cache Key</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Response Time</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cost Saved</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {dashboard.recentEvents.slice(0, 50).map(event => (
                  <tr key={event.eventId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                        event.eventType === 'hit' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        event.eventType === 'miss' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                        event.eventType === 'store' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>{event.eventType}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{event.modelId}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-400">{event.cacheKey.substring(0, 12)}...</td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{event.responseTimeMs}ms</td>
                    <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">{event.costSavedUsd > 0 ? `$${event.costSavedUsd.toFixed(6)}` : '-'}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(event.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'models' && dashboard?.modelBreakdown && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Provider</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Entries</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Hit Rate</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cost Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {dashboard.modelBreakdown.map((model, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 font-mono text-xs">{model.modelId}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{model.provider}</td>
                    <td className="px-4 py-2 text-right">{model.totalEntries}</td>
                    <td className="px-4 py-2 text-right">{(model.hitRate * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">${model.costSavedUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
