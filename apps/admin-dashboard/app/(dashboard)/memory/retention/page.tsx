'use client';

/**
 * Memory Retention & User Profiles — Radiant Admin Dashboard
 * 
 * Platform-level memory retention policy management.
 * Shows: platform defaults, tenant overrides, effective policies,
 * user profiles, storage tier distribution, and pruning controls.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/admin/memory-retention';

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
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
}

function ToggleBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
    }`}>
      <span className={`w-2 h-2 rounded-full mr-1.5 ${enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
      {label}: {enabled ? 'ON' : 'OFF'}
    </span>
  );
}

function PolicyRow({ label, value, source }: { label: string; value: string | number | boolean; source?: string }) {
  const sourceColor = source === 'platform' ? 'text-blue-500' : source === 'tenant' ? 'text-purple-500' : 'text-amber-500';
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">
          {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value === 0 ? 'Unlimited' : value}
        </span>
        {source && <span className={`text-xs ${sourceColor}`}>({source})</span>}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function MemoryRetentionPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'platform' | 'profiles' | 'audit'>('overview');
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [profiles, setProfiles] = useState<{ profiles: unknown[]; total: number }>({ profiles: [], total: 0 });
  const [auditLog, setAuditLog] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApi<Record<string, unknown>>('/dashboard');
      setDashboard(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await fetchApi<{ profiles: unknown[]; total: number }>('/profiles?limit=50&sortBy=quality');
      setProfiles(data);
    } catch { /* ignore */ }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const data = await fetchApi<unknown[]>('/audit?limit=50');
      setAuditLog(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    if (activeTab === 'profiles') loadProfiles();
    if (activeTab === 'audit') loadAudit();
  }, [activeTab, loadProfiles, loadAudit]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'platform' as const, label: 'Platform Policy' },
    { id: 'profiles' as const, label: 'User Profiles' },
    { id: 'audit' as const, label: 'Audit Log' },
  ];

  if (loading && !dashboard) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Memory Retention & User Profiles</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const pp = dashboard?.platformPolicy as Record<string, unknown> | undefined;
  const ep = dashboard?.effectivePolicy as Record<string, unknown> | undefined;
  const usage = dashboard?.usage as Record<string, unknown> | undefined;
  const profileStats = dashboard?.profiles as Record<string, unknown> | undefined;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Memory Retention & User Profiles</h1>
        <p className="text-gray-500 mt-1">
          Session-to-session memory for every user, every chat, every model — with admin-configurable retention
        </p>
        {ep && (
          <div className="flex gap-2 mt-3">
            <ToggleBadge enabled={ep.sessionToSessionMemoryEnabled as boolean} label="Session Memory" />
            <ToggleBadge enabled={ep.conversationHistoryEnabled as boolean} label="History" />
            <ToggleBadge enabled={ep.autoExtractEnabled as boolean} label="Auto-Extract" />
            <ToggleBadge enabled={ep.userCanDeleteOwnMemory as boolean} label="User Delete" />
            <ToggleBadge enabled={(ep as Record<string, unknown>).uploadedDocumentsEnabled as boolean} label="Uploads" />
            <ToggleBadge enabled={(ep as Record<string, unknown>).downloadedFilesEnabled as boolean} label="Downloads" />
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

      {/* Overview */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Memory Usage</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard label="Total Users" value={Number(usage?.totalUsers || 0)} color="blue" />
              <StatCard label="Total Entries" value={Number(usage?.totalEntries || 0)} color="indigo" />
              <StatCard label="Avg Storage/User" value={`${Number(usage?.avgStorageMb || 0).toFixed(1)}MB`} color="purple" />
              <StatCard label="Avg Entries/User" value={Number(usage?.avgEntriesPerUser || 0).toFixed(0)} color="green" />
              <StatCard label="High Quality" value={Number(profileStats?.highQualityProfiles || 0)} subtitle="profiles >70%" color="green" />
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents & Files</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Uploaded Docs" value={Number((usage as Record<string,unknown>)?.uploadedDocumentsCount || 0)} color="indigo" />
              <StatCard label="Upload Storage" value={`${(Number((usage as Record<string,unknown>)?.uploadedDocumentsBytes || 0) / 1048576).toFixed(1)}MB`} color="purple" />
              <StatCard label="Downloaded Files" value={Number((usage as Record<string,unknown>)?.downloadedFilesCount || 0)} color="blue" />
              <StatCard label="Download Storage" value={`${(Number((usage as Record<string,unknown>)?.downloadedFilesBytes || 0) / 1048576).toFixed(1)}MB`} color="green" />
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Tier Distribution</h3>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Hot Tier" value={Number(usage?.hotTierEntries || 0)} subtitle={`< ${ep?.hotTierDays || 30} days`} color="red" />
              <StatCard label="Warm Tier" value={Number(usage?.warmTierEntries || 0)} subtitle={`< ${ep?.warmTierDays || 180} days`} color="amber" />
              <StatCard label="Cold Tier" value={Number(usage?.coldTierEntries || 0)} subtitle={`< ${ep?.coldTierDays || 365} days`} color="blue" />
              <StatCard label="Archive" value={Number(usage?.archiveTierEntries || 0)} subtitle={ep?.archiveAfterDays === 0 ? 'Never' : `> ${ep?.archiveAfterDays} days`} color="purple" />
            </div>
          </div>

          {/* Policy Hierarchy */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Retention Policy Hierarchy</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-1">Platform Default</h4>
                <p className="text-xs text-blue-600">Set by Radiant Super-Admin</p>
                <p className="text-lg font-bold text-blue-900 mt-2">
                  {pp?.retentionDays === 0 ? 'Unlimited' : `${pp?.retentionDays} days`}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="text-sm font-semibold text-purple-800 mb-1">Tenant Override</h4>
                <p className="text-xs text-purple-600">Set by Think Tank Admin</p>
                <p className="text-lg font-bold text-purple-900 mt-2">
                  {dashboard?.tenantOverride ? 'Active' : 'Not set'}
                </p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="text-sm font-semibold text-amber-800 mb-1">Tenant Admin Override</h4>
                <p className="text-xs text-amber-600">Set by TT Tenant Admin</p>
                <p className="text-lg font-bold text-amber-900 mt-2">
                  {dashboard?.tenantAdminOverride ? 'Active' : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Policy */}
      {activeTab === 'platform' && pp && ep && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Effective Retention Policy (Resolved)</h3>
            <p className="text-sm text-gray-500 mb-4">These are the active values after merging platform → tenant → tenant admin overrides</p>
            <PolicyRow label="Retention Days" value={Number(ep.retentionDays)} source={String((ep.sources as Record<string,string>)?.retentionDays || 'platform')} />
            <PolicyRow label="Max Storage/User" value={`${ep.maxStoragePerUserMb === 0 ? 'Unlimited' : `${ep.maxStoragePerUserMb}MB`}`} source={String((ep.sources as Record<string,string>)?.maxStoragePerUserMb || 'platform')} />
            <PolicyRow label="Max Entries/User" value={Number(ep.maxEntriesPerUser) === 0 ? 'Unlimited' : Number(ep.maxEntriesPerUser)} />
            <PolicyRow label="Hot Tier" value={`${ep.hotTierDays} days`} />
            <PolicyRow label="Warm Tier" value={`${ep.warmTierDays} days`} />
            <PolicyRow label="Cold Tier" value={`${ep.coldTierDays} days`} />
            <PolicyRow label="Archive After" value={Number(ep.archiveAfterDays) === 0 ? 'Never' : `${ep.archiveAfterDays} days`} />
            <PolicyRow label="Session-to-Session Memory" value={ep.sessionToSessionMemoryEnabled as boolean} source={String((ep.sources as Record<string,string>)?.sessionToSessionMemoryEnabled || 'platform')} />
            <PolicyRow label="Conversation History" value={ep.conversationHistoryEnabled as boolean} />
            <PolicyRow label="Auto-Extract Facts" value={ep.autoExtractEnabled as boolean} />
            <PolicyRow label="User Can Delete Memory" value={ep.userCanDeleteOwnMemory as boolean} />
            <PolicyRow label="Auto-Prune" value={ep.autoPruneEnabled as boolean} />
            <PolicyRow label="Prune Min Importance" value={Number(ep.pruneMinImportance)} />
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Defaults</h3>
            <p className="text-sm text-gray-500 mb-4">These are the base defaults that apply to all tenants unless overridden</p>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <PolicyRow label="Retention Days" value={Number(pp.retentionDays)} />
                <PolicyRow label="Max Storage/User" value={Number(pp.maxStoragePerUserMb) === 0 ? 'Unlimited' : `${pp.maxStoragePerUserMb}MB`} />
                <PolicyRow label="Max Entries/User" value={Number(pp.maxEntriesPerUser) === 0 ? 'Unlimited' : Number(pp.maxEntriesPerUser)} />
                <PolicyRow label="Hot Tier" value={`${pp.hotTierDays} days`} />
                <PolicyRow label="Warm Tier" value={`${pp.warmTierDays} days`} />
                <PolicyRow label="Cold Tier" value={`${pp.coldTierDays} days`} />
              </div>
              <div>
                <PolicyRow label="Session Memory" value={pp.sessionToSessionMemoryEnabled as boolean} />
                <PolicyRow label="Conversation History" value={pp.conversationHistoryEnabled as boolean} />
                <PolicyRow label="Auto-Extract" value={pp.autoExtractEnabled as boolean} />
                <PolicyRow label="User Delete" value={pp.userCanDeleteOwnMemory as boolean} />
                <PolicyRow label="Auto-Prune" value={pp.autoPruneEnabled as boolean} />
                <PolicyRow label="Min Importance" value={Number(pp.pruneMinImportance)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profiles */}
      {activeTab === 'profiles' && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">User Memory Profiles</h3>
              <p className="text-sm text-gray-500">{profiles.total} profiles</p>
            </div>
          </div>
          {profiles.profiles.length === 0 ? (
            <p className="text-gray-500 text-sm">No user profiles yet — profiles are created after first interaction</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">User ID</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Entries</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Quality</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Facts</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">AKG</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Uploads</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Models</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Conversations</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.profiles.map((p: unknown) => {
                    const profile = p as Record<string, unknown>;
                    const quality = Number(profile.profileQuality || 0);
                    return (
                      <tr key={String(profile.userId)} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs">{String(profile.userId).substring(0, 12)}...</td>
                        <td className="text-right py-2 px-3">{Number(profile.totalMemoryEntries)}</td>
                        <td className="text-right py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            quality > 0.7 ? 'bg-green-100 text-green-700' :
                            quality > 0.4 ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {(quality * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="text-right py-2 px-3">{Number(profile.factsCount)}</td>
                        <td className="text-right py-2 px-3">{Number(profile.akgNodesCount)}</td>
                        <td className="text-right py-2 px-3">{Number(profile.uploadedDocumentsCount || 0)}</td>
                        <td className="text-right py-2 px-3">{Number(profile.totalModelsUsed)}</td>
                        <td className="text-right py-2 px-3">{Number(profile.totalConversations)}</td>
                        <td className="text-right py-2 px-3 text-xs text-gray-400">
                          {profile.lastInteractionAt ? new Date(String(profile.lastInteractionAt)).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Retention Policy Audit Log</h3>
          {auditLog.length === 0 ? (
            <p className="text-gray-500 text-sm">No audit entries yet</p>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry: unknown) => {
                const e = entry as Record<string, unknown>;
                const scopeColor = e.scope === 'platform' ? 'bg-blue-100 text-blue-700' :
                  e.scope === 'tenant' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                return (
                  <div key={String(e.audit_id)} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${scopeColor}`}>{String(e.scope)}</span>
                      <span className="text-sm text-gray-700">{String(e.action).replace(/_/g, ' ')}</span>
                      {e.target_type ? <span className="text-xs text-gray-400">({String(e.target_type)})</span> : null}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(String(e.created_at)).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
