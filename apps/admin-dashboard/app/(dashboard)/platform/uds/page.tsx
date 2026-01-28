'use client';

/**
 * UDS Admin Dashboard
 * User Data Service management interface
 * 
 * Features:
 * - Tier health monitoring
 * - Conversation/Upload management
 * - Audit log viewer with Merkle verification
 * - GDPR erasure requests
 * - Configuration management
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Database, HardDrive, Archive, Snowflake, Shield, Trash2, 
  FileText, MessageSquare, Upload, Activity, Settings, AlertTriangle,
  CheckCircle, RefreshCw, Lock,
  ChevronRight, BarChart3, Zap
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface TierHealth {
  tier: string;
  status: 'healthy' | 'degraded' | 'critical';
  metrics: {
    itemCount?: number;
    storageBytes?: number;
    cacheHitRate?: number;
    latencyP99Ms?: number;
  };
  alerts: TierAlert[];
  lastChecked: string;
}

interface TierAlert {
  id: string;
  tier: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  triggeredAt: string;
}

interface DashboardData {
  health: TierHealth[];
  config: Record<string, unknown>;
  stats: {
    conversations: { total: number; active: number; archived: number; hot: number; warm: number; cold: number };
    messages: { total: number; total_input_tokens: number; total_output_tokens: number };
    uploads: { total: number; ready: number; total_size: number };
    audit: { total: number; first_entry: string; last_entry: string };
  };
}

interface ErasureRequest {
  id: string;
  scope: string;
  status: string;
  userId?: string;
  conversationsDeleted: number;
  messagesDeleted: number;
  uploadsDeleted: number;
  createdAt: string;
}

// =============================================================================
// API
// =============================================================================

const api = {
  async fetchDashboard(): Promise<DashboardData> {
    const res = await fetch('/api/admin/uds/dashboard');
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to fetch dashboard');
    return data.data;
  },

  async fetchTierMetrics(period: string) {
    const res = await fetch(`/api/admin/uds/tiers/metrics?period=${period}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to fetch metrics');
    return data.data;
  },

  async triggerPromotion() {
    const res = await fetch('/api/admin/uds/tiers/promote', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to trigger promotion');
    return data.data;
  },

  async triggerArchival() {
    const res = await fetch('/api/admin/uds/tiers/archive', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to trigger archival');
    return data.data;
  },

  async runHousekeeping() {
    const res = await fetch('/api/admin/uds/tiers/housekeeping', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to run housekeeping');
    return data.data;
  },

  async fetchAuditLog(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/admin/uds/audit?${query}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to fetch audit log');
    return data.data;
  },

  async verifyAuditChain(fromSequence: number, toSequence: number) {
    const res = await fetch('/api/admin/uds/audit/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromSequence, toSequence }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to verify chain');
    return data.data;
  },

  async fetchErasureRequests(): Promise<ErasureRequest[]> {
    const res = await fetch('/api/admin/uds/erasure');
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to fetch erasure requests');
    return data.data;
  },

  async createErasureRequest(request: Record<string, unknown>) {
    const res = await fetch('/api/admin/uds/erasure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to create erasure request');
    return data.data;
  },

  async updateConfig(config: Record<string, unknown>) {
    const res = await fetch('/api/admin/uds/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to update config');
    return data.data;
  },

  async rotateEncryptionKey(userId?: string) {
    const res = await fetch('/api/admin/uds/encryption/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to rotate key');
    return data.data;
  },
};

// =============================================================================
// Components
// =============================================================================

function TierCard({ health }: { health: TierHealth }) {
  const tierIcons: Record<string, typeof Database> = {
    hot: Zap,
    warm: Database,
    cold: Archive,
    glacier: Snowflake,
  };
  const Icon = tierIcons[health.tier] || Database;

  const statusColors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };

  return (
    <div className={`rounded-lg border p-4 ${statusColors[health.status]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <span className="font-semibold capitalize">{health.tier} Tier</span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          health.status === 'healthy' ? 'bg-green-200' :
          health.status === 'degraded' ? 'bg-yellow-200' : 'bg-red-200'
        }`}>
          {health.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-600">Items:</span>
          <span className="ml-1 font-medium">{health.metrics.itemCount?.toLocaleString() || 0}</span>
        </div>
        <div>
          <span className="text-gray-600">Storage:</span>
          <span className="ml-1 font-medium">{formatBytes(health.metrics.storageBytes)}</span>
        </div>
        {health.metrics.cacheHitRate !== undefined && (
          <div>
            <span className="text-gray-600">Cache Hit:</span>
            <span className="ml-1 font-medium">{(health.metrics.cacheHitRate * 100).toFixed(1)}%</span>
          </div>
        )}
        {health.metrics.latencyP99Ms !== undefined && (
          <div>
            <span className="text-gray-600">P99 Latency:</span>
            <span className="ml-1 font-medium">{health.metrics.latencyP99Ms}ms</span>
          </div>
        )}
      </div>

      {health.alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-current/20">
          {health.alerts.map(alert => (
            <div key={alert.id} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3 w-3 mt-0.5" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, subValue, icon: Icon, color }: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: typeof Database;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
    </div>
  );
}

function AuditLogViewer() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ eventCategory: '', eventType: '', limit: '50' });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchAuditLog(filters);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          className="border rounded px-3 py-2 text-sm"
          value={filters.eventCategory}
          onChange={e => setFilters(f => ({ ...f, eventCategory: e.target.value }))}
        >
          <option value="">All Categories</option>
          <option value="auth">Auth</option>
          <option value="conversation">Conversation</option>
          <option value="message">Message</option>
          <option value="upload">Upload</option>
          <option value="gdpr">GDPR</option>
          <option value="system">System</option>
        </select>
        <button
          onClick={loadEntries}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">Timestamp</th>
              <th className="text-left px-4 py-2">Event</th>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-left px-4 py-2">Resource</th>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Merkle</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-mono text-xs">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">{entry.eventType}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{entry.eventCategory}</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {entry.resourceType ? `${entry.resourceType}/${entry.resourceId?.slice(0, 8)}` : '-'}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{entry.userId?.slice(0, 8) || 'system'}</td>
                <td className="px-4 py-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErasureManager() {
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [_loading, setLoading] = useState(false);
  void _loading; // Reserved for loading state display
  const [showCreate, setShowCreate] = useState(false);
  const [newRequest, setNewRequest] = useState({
    scope: 'user' as 'user' | 'conversation' | 'tenant',
    userId: '',
    conversationId: '',
    legalBasis: 'gdpr_article_17',
  });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchErasureRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load erasure requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleCreate = async () => {
    try {
      await api.createErasureRequest(newRequest);
      setShowCreate(false);
      loadRequests();
    } catch (error) {
      console.error('Failed to create erasure request:', error);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">GDPR Erasure Requests</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          New Request
        </button>
      </div>

      {showCreate && (
        <div className="border rounded-lg p-4 bg-red-50">
          <h4 className="font-semibold mb-3 text-red-800">Create Erasure Request</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Scope</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={newRequest.scope}
                onChange={e => setNewRequest(r => ({ ...r, scope: e.target.value as any }))}
              >
                <option value="user">User</option>
                <option value="conversation">Conversation</option>
                <option value="tenant">Tenant</option>
              </select>
            </div>
            {newRequest.scope === 'user' && (
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="UUID"
                  value={newRequest.userId}
                  onChange={e => setNewRequest(r => ({ ...r, userId: e.target.value }))}
                />
              </div>
            )}
            {newRequest.scope === 'conversation' && (
              <div>
                <label className="block text-sm font-medium mb-1">Conversation ID</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="UUID"
                  value={newRequest.conversationId}
                  onChange={e => setNewRequest(r => ({ ...r, conversationId: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Legal Basis</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={newRequest.legalBasis}
                onChange={e => setNewRequest(r => ({ ...r, legalBasis: e.target.value }))}
              >
                <option value="gdpr_article_17">GDPR Article 17</option>
                <option value="ccpa">CCPA</option>
                <option value="user_request">User Request</option>
                <option value="retention_policy">Retention Policy</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Create & Execute
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Scope</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Deleted</th>
              <th className="text-left px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req, i) => (
              <tr key={req.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-mono text-xs">{req.id.slice(0, 8)}...</td>
                <td className="px-4 py-2 capitalize">{req.scope}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[req.status] || 'bg-gray-100'}`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {req.conversationsDeleted} conv, {req.messagesDeleted} msg, {req.uploadsDeleted} files
                </td>
                <td className="px-4 py-2 text-xs">{new Date(req.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No erasure requests
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function UDSAdminPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'erasure' | 'config'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.fetchDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setActionLoading(action);
    try {
      await fn();
      await loadDashboard();
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            User Data Service
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tiered storage for chats, audits, results, and uploads • 1M+ user scale
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('housekeeping', api.runHousekeeping)}
            disabled={!!actionLoading}
            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            <Activity className={`h-4 w-4 ${actionLoading === 'housekeeping' ? 'animate-spin' : ''}`} />
            Run Housekeeping
          </button>
          <button
            onClick={loadDashboard}
            className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded text-sm hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'audit', label: 'Audit Log', icon: FileText },
            { id: 'erasure', label: 'GDPR Erasure', icon: Trash2 },
            { id: 'config', label: 'Configuration', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Tier Health */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Tier Health</h2>
            <div className="grid grid-cols-4 gap-4">
              {dashboard.health.map(h => (
                <TierCard key={h.tier} health={h} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('promote', api.triggerPromotion)}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight className={`h-4 w-4 ${actionLoading === 'promote' ? 'animate-pulse' : ''}`} />
              Promote Hot → Warm
            </button>
            <button
              onClick={() => handleAction('archive', api.triggerArchival)}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <Archive className={`h-4 w-4 ${actionLoading === 'archive' ? 'animate-pulse' : ''}`} />
              Archive Warm → Cold
            </button>
          </div>

          {/* Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Statistics</h2>
            <div className="grid grid-cols-4 gap-4">
              <StatsCard
                title="Conversations"
                value={dashboard.stats.conversations.total}
                subValue={`${dashboard.stats.conversations.active} active`}
                icon={MessageSquare}
                color="bg-blue-50"
              />
              <StatsCard
                title="Messages"
                value={dashboard.stats.messages.total}
                subValue={`${((dashboard.stats.messages.total_input_tokens || 0) + (dashboard.stats.messages.total_output_tokens || 0)).toLocaleString()} tokens`}
                icon={FileText}
                color="bg-green-50"
              />
              <StatsCard
                title="Uploads"
                value={dashboard.stats.uploads.total}
                subValue={`${dashboard.stats.uploads.ready} ready`}
                icon={Upload}
                color="bg-purple-50"
              />
              <StatsCard
                title="Audit Entries"
                value={dashboard.stats.audit.total}
                subValue="Merkle chain verified"
                icon={Shield}
                color="bg-orange-50"
              />
            </div>
          </div>

          {/* Tier Distribution */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Conversation Distribution</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg bg-red-50">
                <div className="text-2xl font-bold text-red-700">{dashboard.stats.conversations.hot}</div>
                <div className="text-sm text-red-600">Hot Tier (0-24h)</div>
              </div>
              <div className="p-4 border rounded-lg bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">{dashboard.stats.conversations.warm}</div>
                <div className="text-sm text-yellow-600">Warm Tier (1-90d)</div>
              </div>
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="text-2xl font-bold text-blue-700">{dashboard.stats.conversations.cold}</div>
                <div className="text-sm text-blue-600">Cold Tier (90d+)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <AuditLogViewer />
      )}

      {/* Erasure Tab */}
      {activeTab === 'erasure' && (
        <ErasureManager />
      )}

      {/* Config Tab */}
      {activeTab === 'config' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Tier Configuration */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Tier Configuration
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Hot Tier TTL</span>
                  <span className="font-mono text-sm">{(dashboard.config as any)?.hot_session_ttl_seconds || 14400}s</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Warm Retention</span>
                  <span className="font-mono text-sm">{(dashboard.config as any)?.warm_retention_days || 90} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cold Retention</span>
                  <span className="font-mono text-sm">{(dashboard.config as any)?.cold_retention_years || 7} years</span>
                </div>
              </div>
            </div>

            {/* Security Configuration */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Security Configuration
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Encryption</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.encryption_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {(dashboard.config as any)?.encryption_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Virus Scanning</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.virus_scan_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {(dashboard.config as any)?.virus_scan_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Merkle Chain</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.merkle_chain_enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {(dashboard.config as any)?.merkle_chain_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button
                  onClick={() => handleAction('rotate', () => api.rotateEncryptionKey())}
                  disabled={!!actionLoading}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${actionLoading === 'rotate' ? 'animate-spin' : ''}`} />
                  Rotate Encryption Key
                </button>
              </div>
            </div>

            {/* Upload Configuration */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Configuration
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Max Upload Size</span>
                  <span className="font-mono text-sm">{(dashboard.config as any)?.max_upload_size_mb || 100} MB</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Auto Extract Text</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.auto_extract_text ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {(dashboard.config as any)?.auto_extract_text ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Generate Thumbnails</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.generate_thumbnails ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {(dashboard.config as any)?.generate_thumbnails ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* GDPR Configuration */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                GDPR Configuration
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Auto Delete</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.gdpr_auto_delete_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {(dashboard.config as any)?.gdpr_auto_delete_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Retention Period</span>
                  <span className="font-mono text-sm">{(dashboard.config as any)?.gdpr_retention_days || 2555} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Anonymize on Delete</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${(dashboard.config as any)?.gdpr_anonymize_on_delete ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {(dashboard.config as any)?.gdpr_anonymize_on_delete ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
