'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  Database,
  HardDrive,
  Archive,
  Snowflake,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Clock,
  FileText,
  Shield,
  Trash2,
  BarChart3,
  Layers,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierBreakdown {
  tier: string;
  totalPartitions: number;
  totalRecords: number;
  totalBytes: number;
  totalCompressedBytes: number;
  oldestData: string | null;
  newestData: string | null;
}

interface DataTypeInfo {
  id: string;
  typeKey: string;
  displayName: string;
  category: string;
  description: string;
  defaultRetentionDays: number;
  isActive: boolean;
}

interface GlacierQueueStats {
  totalQueued: number;
  totalEligible: number;
  totalExecuting: number;
  totalCompleted: number;
  totalFailed: number;
  estimatedPendingCostUsd: number;
  nextEligibleAt: string | null;
}

interface GlobalStats {
  totalLocations: number;
  totalRecords: number;
  totalBytes: number;
  totalCompressedBytes: number;
  tierCounts: Record<string, number>;
  uniqueTenants: number;
  uniqueDataTypes: number;
  oldestData: string | null;
  newestData: string | null;
  immutableCount: number;
  expiredCount: number;
}

interface LifecycleStatus {
  lastRun: string | null;
  lastDurationMs: number;
  totalErrors: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatRelative(d: string | null): string {
  if (!d) return '—';
  const now = Date.now();
  const then = new Date(d).getTime();
  const diffMs = now - then;
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

const TIER_COLORS: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-400 border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  glacier: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  deep_archive: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

const TIER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hot: Activity,
  warm: TrendingUp,
  cold: Snowflake,
  glacier: Archive,
  deep_archive: Database,
};

const TIER_LABELS: Record<string, string> = {
  hot: 'Hot (S3 IT Frequent)',
  warm: 'Warm (S3 IT Infrequent)',
  cold: 'Cold (Glacier Instant)',
  glacier: 'Glacier (Flexible)',
  deep_archive: 'Deep Archive',
};

const CATEGORY_COLORS: Record<string, string> = {
  audit: 'bg-purple-500/20 text-purple-400',
  security: 'bg-red-500/20 text-red-400',
  ai_model: 'bg-blue-500/20 text-blue-400',
  compliance: 'bg-green-500/20 text-green-400',
  billing: 'bg-yellow-500/20 text-yellow-400',
  infrastructure: 'bg-gray-500/20 text-gray-400',
  application: 'bg-teal-500/20 text-teal-400',
  collaboration: 'bg-pink-500/20 text-pink-400',
};

// ---------------------------------------------------------------------------
// API fetch functions
// ---------------------------------------------------------------------------

async function fetchStats(): Promise<GlobalStats> {
  return api.get('/admin/data-lake/stats');
}

async function fetchTiers(): Promise<TierBreakdown[]> {
  return api.get('/admin/data-lake/tiers');
}

async function fetchDataTypes(): Promise<DataTypeInfo[]> {
  return api.get('/admin/data-lake/data-types');
}

async function fetchGlacierStats(): Promise<GlacierQueueStats> {
  return api.get('/admin/data-lake/glacier-queue');
}

async function fetchLifecycleStatus(): Promise<LifecycleStatus> {
  return api.get('/admin/data-lake/lifecycle-status');
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  queryExecutionId: string;
  dataScannedBytes: number;
  executionTimeMs: number;
}

async function executeAthenaQuery(body: {
  sql?: string;
  tenantId?: string;
  dataTypeKey?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<QueryResult> {
  return api.post('/admin/data-lake/query', body);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatCard({ label, value, subValue, icon: Icon, color }: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier }: { tier: TierBreakdown }) {
  const TierIcon = TIER_ICONS[tier.tier] || Database;
  const colorClass = TIER_COLORS[tier.tier] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const label = TIER_LABELS[tier.tier] || tier.tier;

  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <TierIcon className="h-5 w-5" />
        <h3 className="font-semibold">{label}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs opacity-70">Partitions</p>
          <p className="font-medium">{formatNumber(tier.totalPartitions)}</p>
        </div>
        <div>
          <p className="text-xs opacity-70">Records</p>
          <p className="font-medium">{formatNumber(tier.totalRecords)}</p>
        </div>
        <div>
          <p className="text-xs opacity-70">Size</p>
          <p className="font-medium">{formatBytes(tier.totalBytes)}</p>
        </div>
        <div>
          <p className="text-xs opacity-70">Compressed</p>
          <p className="font-medium">{formatBytes(tier.totalCompressedBytes)}</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-current/20 text-xs opacity-70">
        {formatDate(tier.oldestData)} — {formatDate(tier.newestData)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataLakePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'types' | 'glacier' | 'query'>('overview');
  const [queryInput, setQueryInput] = useState({ sql: '', dataTypeKey: '', tenantId: '', startDate: '', endDate: '' });
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<GlobalStats>({
    queryKey: ['data-lake-stats'],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });

  const { data: tiers = [] } = useQuery<TierBreakdown[]>({
    queryKey: ['data-lake-tiers'],
    queryFn: fetchTiers,
    refetchInterval: 30000,
  });

  const { data: dataTypes = [] } = useQuery<DataTypeInfo[]>({
    queryKey: ['data-lake-data-types'],
    queryFn: fetchDataTypes,
  });

  const { data: glacierStats } = useQuery<GlacierQueueStats>({
    queryKey: ['data-lake-glacier-queue'],
    queryFn: fetchGlacierStats,
    refetchInterval: 30000,
  });

  const { data: lifecycle } = useQuery<LifecycleStatus>({
    queryKey: ['data-lake-lifecycle-status'],
    queryFn: fetchLifecycleStatus,
    refetchInterval: 30000,
  });

  const queryMutation = useMutation({
    mutationFn: executeAthenaQuery,
    onSuccess: (data) => {
      setQueryResults(data);
      setQueryError(null);
    },
    onError: (err: Error) => {
      setQueryError(err.message);
      setQueryResults(null);
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['data-lake-stats'] });
    queryClient.invalidateQueries({ queryKey: ['data-lake-tiers'] });
    queryClient.invalidateQueries({ queryKey: ['data-lake-data-types'] });
    queryClient.invalidateQueries({ queryKey: ['data-lake-glacier-queue'] });
    queryClient.invalidateQueries({ queryKey: ['data-lake-lifecycle-status'] });
  };

  if (statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-7 w-7 text-blue-400" />
            Data Lake
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zero-database-write event pipeline — Kinesis Firehose → S3 Parquet → Athena
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-slate-800/50 hover:bg-slate-700/50 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Lifecycle Status Banner */}
      {lifecycle && (
        <div className={`rounded-lg border px-4 py-2 flex items-center gap-3 text-sm ${
          lifecycle.totalErrors > 0
            ? 'border-red-500/30 bg-red-500/10 text-red-400'
            : 'border-green-500/30 bg-green-500/10 text-green-400'
        }`}>
          <Activity className="h-4 w-4" />
          <span>
            Lifecycle manager last ran {formatRelative(lifecycle.lastRun)} ({lifecycle.lastDurationMs}ms)
          </span>
          {lifecycle.totalErrors > 0 && (
            <span className="ml-auto font-medium">{lifecycle.totalErrors} errors</span>
          )}
          {lifecycle.totalErrors === 0 && (
            <span className="ml-auto opacity-70">No errors</span>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Records"
          value={formatNumber(stats.totalRecords)}
          subValue={`${formatNumber(stats.totalLocations)} partitions`}
          icon={BarChart3}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          label="Total Size"
          value={formatBytes(stats.totalBytes)}
          subValue={`${formatBytes(stats.totalCompressedBytes)} compressed`}
          icon={HardDrive}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          label="Tenants"
          value={formatNumber(stats.uniqueTenants)}
          subValue={`${stats.uniqueDataTypes} data types`}
          icon={Layers}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          label="Immutable"
          value={formatNumber(stats.immutableCount)}
          subValue="compliance-locked"
          icon={Shield}
          color="bg-orange-500/20 text-orange-400"
        />
        <StatCard
          label="Expired"
          value={formatNumber(stats.expiredCount)}
          subValue="pending cleanup"
          icon={Trash2}
          color="bg-red-500/20 text-red-400"
        />
        <StatCard
          label="DB Writes Eliminated"
          value="~100M/day"
          subValue="→ Firehose + S3"
          icon={TrendingUp}
          color="bg-emerald-500/20 text-emerald-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {(['overview', 'types', 'glacier', 'query'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' && 'Storage Tiers'}
            {tab === 'types' && 'Data Types'}
            {tab === 'glacier' && 'Glacier Queue'}
            {tab === 'query' && 'Query'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Storage Tier Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {tiers.map(tier => (
              <TierCard key={tier.tier} tier={tier} />
            ))}
          </div>

          {/* Tier distribution bar */}
          <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
            <h3 className="text-sm font-medium mb-3">Storage Distribution</h3>
            <div className="flex rounded-full overflow-hidden h-4">
              {tiers.map(tier => {
                const totalBytes = tiers.reduce((s, t) => s + t.totalBytes, 0);
                const pct = totalBytes > 0 ? (tier.totalBytes / totalBytes) * 100 : 0;
                const bgColor = {
                  hot: 'bg-red-500',
                  warm: 'bg-orange-500',
                  cold: 'bg-blue-500',
                  glacier: 'bg-cyan-500',
                  deep_archive: 'bg-indigo-500',
                }[tier.tier] || 'bg-gray-500';

                return (
                  <div
                    key={tier.tier}
                    className={`${bgColor} transition-all`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                    title={`${TIER_LABELS[tier.tier]}: ${formatBytes(tier.totalBytes)} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              {tiers.map(tier => {
                const totalBytes = tiers.reduce((s, t) => s + t.totalBytes, 0);
                const pct = totalBytes > 0 ? (tier.totalBytes / totalBytes) * 100 : 0;
                return (
                  <span key={tier.tier} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${{
                      hot: 'bg-red-500',
                      warm: 'bg-orange-500',
                      cold: 'bg-blue-500',
                      glacier: 'bg-cyan-500',
                      deep_archive: 'bg-indigo-500',
                    }[tier.tier] || 'bg-gray-500'}`} />
                    {pct.toFixed(1)}%
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'types' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Registered Data Types</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-slate-800/50">
                  <th className="text-left p-3 font-medium">Data Type</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Retention</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dataTypes.map(dt => (
                  <tr key={dt.id} className="border-b border-white/5 hover:bg-slate-800/30">
                    <td className="p-3">
                      <div className="font-medium">{dt.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{dt.typeKey}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[dt.category] || 'bg-gray-500/20'}`}>
                        {dt.category}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">{dt.description}</td>
                    <td className="p-3 text-right">
                      <span className="font-medium">{dt.defaultRetentionDays}</span>
                      <span className="text-muted-foreground"> days</span>
                      {dt.defaultRetentionDays >= 2555 && (
                        <span className="ml-1 text-xs text-orange-400">(7yr)</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {dt.isActive ? (
                        <span className="text-green-400 text-xs">Active</span>
                      ) : (
                        <span className="text-red-400 text-xs">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'glacier' && glacierStats && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Glacier Deletion Queue</h2>
          <p className="text-sm text-muted-foreground">
            Glacier charges for early deletion. This queue holds deletions until the minimum storage period passes to avoid extra costs.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Queued" value={formatNumber(glacierStats.totalQueued)} icon={Clock} color="bg-yellow-500/20 text-yellow-400" />
            <StatCard label="Eligible" value={formatNumber(glacierStats.totalEligible)} subValue="ready to delete" icon={Trash2} color="bg-green-500/20 text-green-400" />
            <StatCard label="Completed" value={formatNumber(glacierStats.totalCompleted)} icon={Archive} color="bg-blue-500/20 text-blue-400" />
            <StatCard label="Failed" value={formatNumber(glacierStats.totalFailed)} icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 space-y-3">
            <h3 className="font-medium">Cost Analysis</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Estimated early-delete cost if deleted now</p>
                <p className="text-xl font-bold text-yellow-400">
                  ${glacierStats.estimatedPendingCostUsd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Next batch eligible for free deletion</p>
                <p className="text-xl font-bold text-green-400">
                  {glacierStats.nextEligibleAt ? formatDate(glacierStats.nextEligibleAt) : 'None'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-white/10 pt-2">
              Glacier Flexible Retrieval: 90-day minimum storage. Deep Archive: 180-day minimum.
              Deleting before the minimum incurs prorated storage charges. The lifecycle manager
              automatically deletes objects once they pass the minimum period.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'query' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Data Lake Query (Athena)</h2>
          <p className="text-sm text-muted-foreground">
            Query data lake events via Amazon Athena. All queries are automatically partitioned
            by tenant_id and date for optimal cost and performance.
          </p>

          <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data Type</label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                  value={queryInput.dataTypeKey}
                  onChange={e => setQueryInput(prev => ({ ...prev, dataTypeKey: e.target.value }))}
                >
                  <option value="">Select data type...</option>
                  {dataTypes.map(dt => (
                    <option key={dt.id} value={dt.typeKey}>{dt.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                  value={queryInput.startDate}
                  onChange={e => setQueryInput(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                  value={queryInput.endDate}
                  onChange={e => setQueryInput(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">SQL Query (Advanced)</label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-mono"
                placeholder={`SELECT *\nFROM radiant_data_lake.audit_logs\nWHERE tenant_id = 'your-tenant-id'\n  AND year = 2026 AND month = 2\nLIMIT 100`}
                value={queryInput.sql}
                onChange={e => setQueryInput(prev => ({ ...prev, sql: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => queryMutation.mutate({
                  sql: queryInput.sql || undefined,
                  tenantId: queryInput.tenantId || undefined,
                  dataTypeKey: queryInput.dataTypeKey || undefined,
                  startDate: queryInput.startDate || undefined,
                  endDate: queryInput.endDate || undefined,
                  limit: 100,
                })}
                disabled={queryMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium"
              >
                {queryMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {queryMutation.isPending ? 'Running...' : 'Execute Query'}
              </button>
              <span className="text-xs text-muted-foreground">
                Athena pricing: $5.00 per TB scanned. Partition pruning reduces costs significantly.
              </span>
            </div>

            {queryError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {queryError}
              </div>
            )}

            {queryResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatNumber(queryResults.rowCount)} rows</span>
                  <span>{formatBytes(queryResults.dataScannedBytes)} scanned</span>
                  <span>{queryResults.executionTimeMs}ms</span>
                  <span className="font-mono text-[10px]">{queryResults.queryExecutionId}</span>
                </div>
                <div className="rounded-lg border border-white/10 overflow-x-auto max-h-96">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-800/80">
                        {queryResults.columns.map(col => (
                          <th key={col} className="text-left p-2 font-medium whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResults.rows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-slate-800/30">
                          {queryResults.columns.map(col => (
                            <td key={col} className="p-2 whitespace-nowrap max-w-xs truncate">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {queryResults.rowCount > 50 && (
                  <p className="text-xs text-muted-foreground">Showing first 50 of {formatNumber(queryResults.rowCount)} rows</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Query Tips
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Always include <code className="text-blue-400">tenant_id</code> and date partitions to minimize scan cost</li>
              <li>• Use <code className="text-blue-400">json_extract_scalar(payload, &apos;$.field&apos;)</code> to filter on payload fields</li>
              <li>• The <code className="text-blue-400">payload</code> column contains all event-specific data as JSON</li>
              <li>• Partition keys: <code className="text-blue-400">tenant_id, year, month, day, hour</code></li>
              <li>• Data is stored in Parquet format with SNAPPY compression for fast columnar queries</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
