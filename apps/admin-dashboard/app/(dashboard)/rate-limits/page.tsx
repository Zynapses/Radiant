'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Activity, Settings, RefreshCw, Zap } from 'lucide-react';

// Provider rate limit configuration
interface ProviderRateLimit {
  rpm: number;
  tpm?: number;
  dailyLimit?: number;
  tier: string;
}

const PROVIDER_RATE_LIMITS: Record<string, ProviderRateLimit> = {
  groq: { rpm: 30, tpm: 15000, dailyLimit: 14400, tier: 'Free' },
  anthropic: { rpm: 60, tpm: 100000, tier: 'Standard' },
  openai: { rpm: 60, tpm: 150000, tier: 'Standard' },
  perplexity: { rpm: 50, tier: 'Standard' },
  together: { rpm: 60, tpm: 100000, tier: 'Standard' },
  xai: { rpm: 60, tier: 'Standard' },
  bedrock: { rpm: 1000, tier: 'AWS' },
  litellm: { rpm: 500, tier: 'Self-hosted' },
};

// Tier limits for tenants
const TIER_LIMITS = {
  free: { requests: 100, windowMs: 60000 },
  starter: { requests: 500, windowMs: 60000 },
  professional: { requests: 2000, windowMs: 60000 },
  business: { requests: 5000, windowMs: 60000 },
  enterprise: { requests: 20000, windowMs: 60000 },
};

interface ProviderStatus {
  limit: number;
  used: number;
  remaining: number;
  resetInMs: number;
}

export default function RateLimitsPage() {
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'providers' | 'tenants' | 'settings'>('providers');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});

  // Simulate fetching rate limit status
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshStatus = () => {
    setIsLoading(true);
    // Simulate API call - in production this would call the actual endpoint
    setTimeout(() => {
      const status: Record<string, ProviderStatus> = {};
      for (const [provider, limits] of Object.entries(PROVIDER_RATE_LIMITS)) {
        const used = Math.floor(Math.random() * limits.rpm * 0.7);
        status[provider] = {
          limit: limits.rpm,
          used,
          remaining: limits.rpm - used,
          resetInMs: Math.floor(Math.random() * 60000),
        };
      }
      setProviderStatus(status);
      setIsLoading(false);
    }, 500);
  };

  const getUsageColor = (used: number, limit: number) => {
    const pct = (used / limit) * 100;
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-yellow-500';
    if (pct >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getUsageTextColor = (used: number, limit: number) => {
    const pct = (used / limit) * 100;
    if (pct >= 90) return 'text-red-600';
    if (pct >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rate Limits</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and configure API rate limits for providers and tenants
          </p>
        </div>
        <button
          onClick={refreshStatus}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Provider Rate Limits Active</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              External API providers have rate limits that RADIANT respects automatically. 
              Groq has the lowest limit (30 RPM on free tier). Requests exceeding limits will 
              automatically fallback to alternative providers.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Zap className="w-4 h-4" />
            Active Providers
          </div>
          <p className="text-2xl font-bold">{Object.keys(PROVIDER_RATE_LIMITS).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Activity className="w-4 h-4" />
            Requests (1m)
          </div>
          <p className="text-2xl font-bold">
            {Object.values(providerStatus).reduce((sum, s) => sum + s.used, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Near Limit
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            {Object.values(providerStatus).filter(s => (s.used / s.limit) >= 0.7).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Settings className="w-4 h-4" />
            Tenant Tiers
          </div>
          <p className="text-2xl font-bold">{Object.keys(TIER_LIMITS).length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { key: 'providers', label: 'Provider Limits', icon: Zap },
            { key: 'tenants', label: 'Tenant Tiers', icon: Activity },
            { key: 'settings', label: 'Settings', icon: Settings },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Provider Limits Tab */}
      {selectedTab === 'providers' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RPM Limit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TPM Limit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(PROVIDER_RATE_LIMITS).map(([provider, limits]) => {
                  const status = providerStatus[provider] || { limit: limits.rpm, used: 0, remaining: limits.rpm, resetInMs: 0 };
                  const usagePct = (status.used / status.limit) * 100;
                  
                  return (
                    <tr key={provider} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getUsageColor(status.used, status.limit)}`} />
                          <span className="font-medium capitalize">{provider}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          limits.tier === 'Free' ? 'bg-gray-100 text-gray-700' :
                          limits.tier === 'AWS' ? 'bg-orange-100 text-orange-700' :
                          limits.tier === 'Self-hosted' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {limits.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {editingProvider === provider ? (
                          <input
                            type="number"
                            value={customLimits[provider] || limits.rpm}
                            onChange={(e) => setCustomLimits({ ...customLimits, [provider]: parseInt(e.target.value) })}
                            className="w-20 px-2 py-1 border rounded"
                          />
                        ) : (
                          <span>{limits.rpm}/min</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-500">
                        {limits.tpm ? `${(limits.tpm / 1000).toFixed(0)}K` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getUsageColor(status.used, status.limit)}`}
                              style={{ width: `${Math.min(100, usagePct)}%` }}
                            />
                          </div>
                          <span className={`text-xs ${getUsageTextColor(status.used, status.limit)}`}>
                            {status.used}/{status.limit}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {usagePct >= 90 ? (
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Critical</span>
                        ) : usagePct >= 70 ? (
                          <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">Warning</span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Healthy</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingProvider === provider ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingProvider(null)}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingProvider(null);
                                setCustomLimits({ ...customLimits, [provider]: limits.rpm });
                              }}
                              className="text-xs px-2 py-1 border rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingProvider(provider)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Groq Warning */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">Groq Free Tier Limits</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Groq&apos;s free tier has strict limits: <strong>30 RPM</strong>, <strong>15,000 TPM</strong>, 
                  and <strong>14,400 requests/day</strong>. When limits are reached, requests automatically 
                  fallback to alternative providers (Bedrock → LiteLLM). Consider upgrading Groq to a paid 
                  tier for higher limits.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Tiers Tab */}
      {selectedTab === 'tenants' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/min</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Window</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(TIER_LIMITS).map(([tier, limits]) => (
                  <tr key={tier} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <span className={`font-medium capitalize px-2 py-1 rounded text-sm ${
                        tier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                        tier === 'business' ? 'bg-blue-100 text-blue-700' :
                        tier === 'professional' ? 'bg-green-100 text-green-700' :
                        tier === 'starter' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{limits.requests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{limits.windowMs / 1000}s</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {tier === 'free' && 'Basic access for evaluation'}
                      {tier === 'starter' && 'Small teams and projects'}
                      {tier === 'professional' && 'Growing businesses'}
                      {tier === 'business' && 'Large-scale applications'}
                      {tier === 'enterprise' && 'Mission-critical workloads'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {selectedTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Rate Limit Behavior</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="rounded" />
                <div>
                  <span className="font-medium">Auto-fallback on rate limit</span>
                  <p className="text-sm text-gray-500">Automatically route to alternative providers when limits are reached</p>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="rounded" />
                <div>
                  <span className="font-medium">Queue requests near limit</span>
                  <p className="text-sm text-gray-500">Queue requests when approaching limits instead of immediate fallback</p>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="rounded" />
                <div>
                  <span className="font-medium">Strict mode</span>
                  <p className="text-sm text-gray-500">Return 429 errors instead of falling back (for cost control)</p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Alerting</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Warning threshold</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="50" max="95" defaultValue="70" className="flex-1" />
                  <span className="text-sm font-mono w-12">70%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Critical threshold</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="80" max="100" defaultValue="90" className="flex-1" />
                  <span className="text-sm font-mono w-12">90%</span>
                </div>
              </div>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="rounded" />
                <div>
                  <span className="font-medium">Send alerts on critical threshold</span>
                  <p className="text-sm text-gray-500">Notify admins when providers reach critical usage</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
