'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Flame,
  Thermometer,
  Snowflake,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Network,
  RefreshCw,
  Settings,
  Trash2,
  Play,
  ChevronRight,
  GitBranch,
  CloudOff,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TierHealth {
  tier: 'hot' | 'warm' | 'cold';
  status: 'healthy' | 'degraded' | 'critical';
  metrics: Record<string, number | undefined>;
}

interface CortexOverview {
  config: any;
  tiers: { hot: TierHealth; warm: TierHealth; cold: TierHealth };
  stats: { nodeCount: number; edgeCount: number; documentCount: number; archiveCount: number };
  dataFlow: any;
  alerts: any[];
  mounts: any[];
  housekeeping: any[];
}

async function fetchOverview(): Promise<CortexOverview> {
  const res = await fetch('/api/admin/cortex/overview');
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

async function triggerHealthCheck(): Promise<any> {
  const res = await fetch('/api/admin/cortex/health/check', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to check health');
  return res.json();
}

async function triggerHousekeeping(taskType: string): Promise<any> {
  const res = await fetch('/api/admin/cortex/housekeeping/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskType }),
  });
  if (!res.ok) throw new Error('Failed to trigger task');
  return res.json();
}

const tierIcons = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
};

const tierColors = {
  hot: 'text-red-500 bg-red-500/10',
  warm: 'text-amber-500 bg-amber-500/10',
  cold: 'text-blue-500 bg-blue-500/10',
};

const statusColors = {
  healthy: 'text-green-500',
  degraded: 'text-amber-500',
  critical: 'text-red-500',
};

export default function CortexPage() {
  const [selectedTier, setSelectedTier] = useState<'hot' | 'warm' | 'cold' | null>(null);
  const queryClient = useQueryClient();

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['cortex-overview'],
    queryFn: fetchOverview,
    refetchInterval: 30000,
  });

  const healthCheckMutation = useMutation({
    mutationFn: triggerHealthCheck,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cortex-overview'] }),
  });

  const housekeepingMutation = useMutation({
    mutationFn: triggerHousekeeping,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cortex-overview'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="p-6 text-center text-red-500">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p>Failed to load Cortex overview</p>
      </div>
    );
  }

  const { tiers, stats, alerts, mounts, housekeeping } = overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Cortex Memory System
          </h1>
          <p className="text-muted-foreground mt-1">
            Tiered Memory Architecture: Hot → Warm → Cold
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => healthCheckMutation.mutate()}
            disabled={healthCheckMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", healthCheckMutation.isPending && "animate-spin")} />
            Health Check
          </button>
          <a
            href="/cortex/graph"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Network className="h-4 w-4" />
            Graph Explorer
          </a>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-amber-500">{alerts.length} Active Alerts</span>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert: any) => (
              <div key={alert.id} className="flex items-center justify-between text-sm">
                <span>{alert.message}</span>
                <span className="text-muted-foreground">{alert.tier} tier</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {(['hot', 'warm', 'cold'] as const).map((tier) => {
          const Icon = tierIcons[tier];
          const health = tiers[tier];

          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
              className={cn(
                'p-5 rounded-xl border bg-card text-left transition-all',
                selectedTier === tier && 'ring-2 ring-primary',
                'hover:shadow-md'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn('p-3 rounded-xl', tierColors[tier])}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className={cn('flex items-center gap-1', statusColors[health.status])}>
                  {health.status === 'healthy' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium capitalize">{health.status}</span>
                </div>
              </div>

              <h3 className="text-lg font-semibold capitalize mb-1">{tier} Tier</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {tier === 'hot' && 'Real-time context (Redis + DynamoDB)'}
                {tier === 'warm' && 'Knowledge Graph (Neptune + pgvector)'}
                {tier === 'cold' && 'Historical Archive (S3 + Iceberg)'}
              </p>

              <div className="space-y-2 text-sm">
                {tier === 'hot' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memory Usage</span>
                      <span>{health.metrics.redisMemoryUsagePercent || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cache Hit Rate</span>
                      <span>{((health.metrics.redisCacheHitRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">p99 Latency</span>
                      <span>{health.metrics.redisP99LatencyMs || 0}ms</span>
                    </div>
                  </>
                )}
                {tier === 'warm' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Graph Nodes</span>
                      <span>{stats.nodeCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Graph Edges</span>
                      <span>{stats.edgeCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Documents</span>
                      <span>{stats.documentCount.toLocaleString()}</span>
                    </div>
                  </>
                )}
                {tier === 'cold' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Archives</span>
                      <span>{stats.archiveCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zero-Copy Mounts</span>
                      <span>{mounts.length}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end mt-3 text-primary">
                <span className="text-sm">Details</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Data Flow */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Data Flow (Last 24h)
          </h2>
          {overview.dataFlow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-red-500/10">
                    <Flame className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <span className="font-medium">Hot → Warm</span>
                    <p className="text-xs text-muted-foreground">Promotions</p>
                  </div>
                </div>
                <span className="text-xl font-bold">
                  {overview.dataFlow.hotToWarmPromotions?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-amber-500/10">
                    <Thermometer className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <span className="font-medium">Warm → Cold</span>
                    <p className="text-xs text-muted-foreground">Archivals</p>
                  </div>
                </div>
                <span className="text-xl font-bold">
                  {overview.dataFlow.warmToColdArchivals?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-blue-500/10">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <span className="font-medium">Cold → Warm</span>
                    <p className="text-xs text-muted-foreground">Retrievals</p>
                  </div>
                </div>
                <span className="text-xl font-bold">
                  {overview.dataFlow.coldToWarmRetrievals?.toLocaleString() || 0}
                </span>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tier Miss Rate</span>
                  <span className={cn(
                    (overview.dataFlow.tierMissRate || 0) > 0.05 ? 'text-amber-500' : 'text-green-500'
                  )}>
                    {((overview.dataFlow.tierMissRate || 0) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No data flow metrics yet</p>
          )}
        </div>

        {/* Housekeeping (Twilight Dreaming) */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Twilight Dreaming Tasks
          </h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {housekeeping.map((task: any) => (
              <div
                key={task.taskType}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded',
                    task.status === 'completed' ? 'bg-green-500/10' :
                    task.status === 'running' ? 'bg-blue-500/10' :
                    task.status === 'failed' ? 'bg-red-500/10' : 'bg-muted'
                  )}>
                    {task.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : task.status === 'running' ? (
                      <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : task.status === 'failed' ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-sm">
                      {task.taskType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                    <p className="text-xs text-muted-foreground">{task.frequency}</p>
                  </div>
                </div>
                <button
                  onClick={() => housekeepingMutation.mutate(task.taskType)}
                  disabled={housekeepingMutation.isPending || task.status === 'running'}
                  className="p-2 hover:bg-accent rounded-lg disabled:opacity-50"
                  title="Run now"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zero-Copy Mounts */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Zero-Copy Mounts
          </h2>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent">
            <CloudOff className="h-4 w-4" />
            Add Mount
          </button>
        </div>

        {mounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Source</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Objects</th>
                  <th className="pb-2">Last Scan</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mounts.map((mount: any) => (
                  <tr key={mount.id}>
                    <td className="py-3 font-medium">{mount.name}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 text-xs rounded bg-muted">
                        {mount.source_type}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={cn(
                        'px-2 py-1 text-xs rounded',
                        mount.status === 'active' ? 'bg-green-500/10 text-green-500' :
                        mount.status === 'scanning' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-red-500/10 text-red-500'
                      )}>
                        {mount.status}
                      </span>
                    </td>
                    <td className="py-3">{mount.object_count?.toLocaleString() || 0}</td>
                    <td className="py-3 text-muted-foreground">
                      {mount.last_scan_at ? new Date(mount.last_scan_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 text-right">
                      <button className="p-1 hover:bg-accent rounded" title="Rescan">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button className="p-1 hover:bg-accent rounded text-red-500" title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No Zero-Copy mounts configured</p>
            <p className="text-sm mt-1">Connect to Snowflake, Databricks, or S3</p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <a
          href="/cortex/graph"
          className="p-4 rounded-xl border bg-card hover:border-primary transition-colors"
        >
          <Network className="h-6 w-6 mb-2 text-primary" />
          <h3 className="font-medium">Graph Explorer</h3>
          <p className="text-sm text-muted-foreground">Visualize knowledge graph</p>
        </a>
        <a
          href="/cortex/conflicts"
          className="p-4 rounded-xl border bg-card hover:border-primary transition-colors"
        >
          <GitBranch className="h-6 w-6 mb-2 text-amber-500" />
          <h3 className="font-medium">Conflicts</h3>
          <p className="text-sm text-muted-foreground">Review contradictions</p>
        </a>
        <a
          href="/cortex/gdpr"
          className="p-4 rounded-xl border bg-card hover:border-primary transition-colors"
        >
          <Shield className="h-6 w-6 mb-2 text-blue-500" />
          <h3 className="font-medium">GDPR Erasure</h3>
          <p className="text-sm text-muted-foreground">Data deletion requests</p>
        </a>
        <a
          href="/cortex/settings"
          className="p-4 rounded-xl border bg-card hover:border-primary transition-colors"
        >
          <Settings className="h-6 w-6 mb-2 text-muted-foreground" />
          <h3 className="font-medium">Settings</h3>
          <p className="text-sm text-muted-foreground">Configure tiers</p>
        </a>
      </div>
    </div>
  );
}
