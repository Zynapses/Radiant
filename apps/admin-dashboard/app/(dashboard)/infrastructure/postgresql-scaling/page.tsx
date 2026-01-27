'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Server, 
  Activity, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Layers,
  Search,
  Zap,
  HardDrive,
  BarChart3,
  Settings,
  Play,
  Trash2,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface ConnectionMetrics {
  current: {
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    maxConnections: number;
    utilizationPercent: number;
  };
  latency: {
    acquisitionTimeMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  history: Array<{
    timestamp: string;
    active: number;
    idle: number;
    waiting: number;
  }>;
  avgAcquisitionTimeMs: number;
  totalErrors: number;
}

interface QueueStatus {
  summary: {
    pending: number;
    processing: number;
    failed: number;
    completed: number;
    total: number;
    queueAgeSeconds: number;
    health: 'healthy' | 'warning' | 'critical';
  };
  byTable: Array<{
    status: string;
    table: string;
    count: number;
    oldest: string;
    newest: string;
    avgRetries: number;
  }>;
}

interface ReplicaHealth {
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    avgLagMs: number;
    overallHealth: 'healthy' | 'degraded' | 'critical';
  };
  replicas: Array<{
    name: string;
    endpoint: string;
    isPrimary: boolean;
    isHealthy: boolean;
    lagMs: number | null;
    weight: number;
    status: string;
  }>;
}

interface PartitionStats {
  modelExecutionLogs: {
    partitionCount: number;
    totalRows: number;
    partitions: Array<{ name: string; rowCount: number; size: string; indexSize: string }>;
  };
  usageRecords: {
    partitionCount: number;
    totalRows: number;
    partitions: Array<{ name: string; rowCount: number; size: string; indexSize: string }>;
  };
}

interface SlowQuerySummary {
  summary: {
    totalSlowQueries24h: number;
    uniquePatterns: number;
    avgSlowQueryDurationMs: number;
    queriesNeedingIndexes: number;
  };
  topQueries: Array<{
    digest: string;
    sample: string;
    table: string;
    avgDurationMs: number;
    maxDurationMs: number;
    callCount: number;
    totalTimeMs: number;
    suggestedIndex: string | null;
  }>;
  recentSlowQueries: Array<{
    hash: string;
    preview: string;
    durationMs: number;
    tenantId: string;
    capturedAt: string;
  }>;
}

interface MaterializedViewStatus {
  views: Array<{
    name: string;
    size: string;
    lastRefresh: string | null;
    lastStatus: string;
    lastDurationMs: number | null;
  }>;
  refreshHistory: Array<{
    view: string;
    status: string;
    durationMs: number;
    refreshedAt: string;
  }>;
  summary: {
    totalViews: number;
    lastRefreshSuccess: number;
    lastRefreshFailed: number;
  };
}

interface DashboardData {
  connectionMetrics: ConnectionMetrics;
  queueStatus: QueueStatus;
  replicaHealth: ReplicaHealth;
  partitionStats: PartitionStats;
  slowQuerySummary: SlowQuerySummary;
  mvRefreshStatus: MaterializedViewStatus;
  timestamp: string;
}

const API_BASE = '/api/admin/scaling';

export default function PostgreSQLScalingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch PostgreSQL scaling dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const handleRetryFailed = async () => {
    try {
      const response = await fetch(`${API_BASE}/queues/retry-failed`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        fetchDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to retry writes', variant: 'destructive' });
    }
  };

  const handleClearCompleted = async () => {
    try {
      const response = await fetch(`${API_BASE}/queues/clear-completed`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        fetchDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to clear completed', variant: 'destructive' });
    }
  };

  const handleRefreshMVs = async (priority: 'high' | 'all') => {
    try {
      const response = await fetch(`${API_BASE}/materialized-views/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        fetchDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to refresh views', variant: 'destructive' });
    }
  };

  const handleRunMaintenance = async () => {
    try {
      const response = await fetch(`${API_BASE}/maintenance/run`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        fetchDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to run maintenance', variant: 'destructive' });
    }
  };

  const handleEnsurePartitions = async () => {
    try {
      const response = await fetch(`${API_BASE}/partitions/ensure-future`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthsAhead: 3 }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: `Created ${result.data.created.length} partitions` });
        fetchDashboard();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create partitions', variant: 'destructive' });
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'warning':
      case 'degraded':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      case 'critical':
      case 'unhealthy':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="outline">{health}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-2 w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Failed to load PostgreSQL scaling dashboard data. The database may be unreachable or the admin API is unavailable.
          </AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="w-6 h-6 text-primary" />
            </div>
            PostgreSQL Scaling
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor connection pools, batch writer queues, read replicas, partitions, and query performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="text-sm font-medium">{new Date(data.timestamp).toLocaleTimeString()}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Infrastructure Monitoring</AlertTitle>
        <AlertDescription>
          This dashboard provides real-time visibility into the PostgreSQL scaling infrastructure including RDS Proxy connection pooling, 
          SQS batch writer queues, Aurora read replicas, time-based partitioning, and materialized view refresh status.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Server className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.connectionMetrics.current.activeConnections} / {data.connectionMetrics.current.maxConnections}
            </div>
            <Progress 
              value={data.connectionMetrics.current.utilizationPercent} 
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {data.connectionMetrics.current.utilizationPercent}% utilization • {data.connectionMetrics.current.idleConnections} idle
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <div className="p-2 bg-yellow-500/10 rounded-full">
              <Layers className="w-4 h-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{data.queueStatus.summary.pending}</span>
              <span className="text-muted-foreground text-sm">pending</span>
              {getHealthBadge(data.queueStatus.summary.health)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.queueStatus.summary.failed > 0 && <span className="text-red-500 font-medium">{data.queueStatus.summary.failed} failed</span>}
              {data.queueStatus.summary.failed > 0 && ' • '}
              {data.queueStatus.summary.queueAgeSeconds}s queue age
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Replicas</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-full">
              <Activity className="w-4 h-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {data.replicaHealth.summary.healthy} / {data.replicaHealth.summary.total}
              </span>
              {getHealthBadge(data.replicaHealth.summary.overallHealth)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Avg replication lag: {data.replicaHealth.summary.avgLagMs}ms
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Query Latency (P95)</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-full">
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.connectionMetrics.latency.p95Ms}<span className="text-sm font-normal text-muted-foreground">ms</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              P50: {data.connectionMetrics.latency.p50Ms}ms • P99: {data.connectionMetrics.latency.p99Ms}ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="replicas">Replicas</TabsTrigger>
          <TabsTrigger value="partitions">Partitions</TabsTrigger>
          <TabsTrigger value="slow-queries">Slow Queries</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Connection History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connection History (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.connectionMetrics.history.slice(0, 10).map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-green-600">Active: {h.active}</span>
                        <span className="text-blue-600">Idle: {h.idle}</span>
                        <span className="text-yellow-600">Waiting: {h.waiting}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Materialized Views */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Materialized Views</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleRefreshMVs('high')}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Priority
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRefreshMVs('all')}>
                    All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>View</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Last Refresh</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.mvRefreshStatus.views.map((v) => (
                      <TableRow key={v.name}>
                        <TableCell className="font-mono text-xs">{v.name}</TableCell>
                        <TableCell>{v.size}</TableCell>
                        <TableCell className="text-xs">
                          {v.lastRefresh ? new Date(v.lastRefresh).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          {v.lastStatus === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Queues Tab */}
        <TabsContent value="queues" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Batch Writer Queue</h2>
              <p className="text-sm text-muted-foreground">SQS-backed asynchronous write pipeline for high-throughput operations</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetryFailed} disabled={data.queueStatus.summary.failed === 0}>
                <Play className="w-4 h-4 mr-2" />
                Retry Failed ({data.queueStatus.summary.failed})
              </Button>
              <Button variant="outline" onClick={handleClearCompleted}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Completed
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{data.queueStatus.summary.pending}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{data.queueStatus.summary.processing}</div>
                  <div className="text-sm text-muted-foreground">Processing</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{data.queueStatus.summary.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{data.queueStatus.summary.completed}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Queue by Table</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Oldest</TableHead>
                    <TableHead>Avg Retries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.queueStatus.byTable.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{row.table}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'failed' ? 'destructive' : 'outline'}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className="text-xs">
                        {row.oldest ? new Date(row.oldest).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>{row.avgRetries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replicas Tab */}
        <TabsContent value="replicas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                Read Replicas
              </CardTitle>
              <CardDescription>Aurora read replica health, replication lag, and routing weight configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lag (ms)</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Endpoint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.replicaHealth.replicas.map((replica) => (
                    <TableRow key={replica.name}>
                      <TableCell className="font-medium">{replica.name}</TableCell>
                      <TableCell>
                        <Badge variant={replica.isPrimary ? 'default' : 'secondary'}>
                          {replica.isPrimary ? 'Primary' : 'Replica'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {replica.isHealthy ? (
                          <Badge className="bg-green-500">Healthy</Badge>
                        ) : (
                          <Badge className="bg-red-500">Unhealthy</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {replica.lagMs !== null ? (
                          <span className={replica.lagMs > 1000 ? 'text-red-500' : ''}>
                            {replica.lagMs}ms
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{replica.weight}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">
                        {replica.endpoint}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partitions Tab */}
        <TabsContent value="partitions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Table Partitions</h2>
              <p className="text-sm text-muted-foreground">Time-based partitioning for model_execution_logs and usage_records tables</p>
            </div>
            <Button variant="outline" onClick={handleEnsurePartitions}>
              <Layers className="w-4 h-4 mr-2" />
              Ensure Future Partitions
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Execution Logs</CardTitle>
                <CardDescription>
                  {data.partitionStats.modelExecutionLogs.partitionCount} partitions • {data.partitionStats.modelExecutionLogs.totalRows.toLocaleString()} total rows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partition</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Index</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.partitionStats.modelExecutionLogs.partitions.slice(0, 12).map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-mono text-xs">{p.name}</TableCell>
                        <TableCell>{p.rowCount.toLocaleString()}</TableCell>
                        <TableCell>{p.size}</TableCell>
                        <TableCell>{p.indexSize}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Records</CardTitle>
                <CardDescription>
                  {data.partitionStats.usageRecords.partitionCount} partitions • {data.partitionStats.usageRecords.totalRows.toLocaleString()} total rows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partition</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Index</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.partitionStats.usageRecords.partitions.slice(0, 12).map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-mono text-xs">{p.name}</TableCell>
                        <TableCell>{p.rowCount.toLocaleString()}</TableCell>
                        <TableCell>{p.size}</TableCell>
                        <TableCell>{p.indexSize}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Slow Queries Tab */}
        <TabsContent value="slow-queries" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold">{data.slowQuerySummary.summary.totalSlowQueries24h}</div>
                    <div className="text-xs text-muted-foreground">Slow queries (24h)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold">{data.slowQuerySummary.summary.uniquePatterns}</div>
                    <div className="text-xs text-muted-foreground">Unique patterns</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-bold">{data.slowQuerySummary.summary.avgSlowQueryDurationMs}ms</div>
                    <div className="text-xs text-muted-foreground">Avg duration</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="text-2xl font-bold">{data.slowQuerySummary.summary.queriesNeedingIndexes}</div>
                    <div className="text-xs text-muted-foreground">Need indexes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Slow Query Patterns</CardTitle>
              <CardDescription>Aggregated by query hash, sorted by total time</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query Pattern</TableHead>
                    <TableHead>Avg (ms)</TableHead>
                    <TableHead>Max (ms)</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Total Time</TableHead>
                    <TableHead>Index Suggestion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slowQuerySummary.topQueries.slice(0, 10).map((q, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs max-w-[300px] truncate">
                        {q.sample || q.digest}
                      </TableCell>
                      <TableCell>{q.avgDurationMs}</TableCell>
                      <TableCell>{q.maxDurationMs}</TableCell>
                      <TableCell>{q.callCount}</TableCell>
                      <TableCell>{(q.totalTimeMs / 1000).toFixed(1)}s</TableCell>
                      <TableCell>
                        {q.suggestedIndex ? (
                          <Badge variant="outline" className="text-yellow-600">
                            <Zap className="w-3 h-3 mr-1" />
                            Suggested
                          </Badge>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Database Maintenance</h2>
              <p className="text-sm text-muted-foreground">Scheduled and manual maintenance tasks for optimal database performance</p>
            </div>
            <Button onClick={handleRunMaintenance}>
              <Settings className="w-4 h-4 mr-2" />
              Run Maintenance Now
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Vacuum & Analyze</div>
                    <div className="text-sm text-muted-foreground">Clean up dead tuples and update statistics</div>
                  </div>
                  <Badge variant="outline">Auto-scheduled</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Partition Management</div>
                    <div className="text-sm text-muted-foreground">Create future partitions, archive old data</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleEnsurePartitions}>
                    Run
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Materialized View Refresh</div>
                    <div className="text-sm text-muted-foreground">Update pre-computed dashboard metrics</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRefreshMVs('all')}>
                    Run
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Queue Cleanup</div>
                    <div className="text-sm text-muted-foreground">Clear completed batch writes</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleClearCompleted}>
                    Run
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maintenance Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Priority MV Refresh</TableCell>
                      <TableCell>Every 15 min</TableCell>
                      <TableCell className="text-muted-foreground">Auto</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>All MV Refresh</TableCell>
                      <TableCell>Every hour</TableCell>
                      <TableCell className="text-muted-foreground">Auto</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Vacuum & Analyze</TableCell>
                      <TableCell>Daily</TableCell>
                      <TableCell className="text-muted-foreground">4:00 AM</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Partition Creation</TableCell>
                      <TableCell>Daily</TableCell>
                      <TableCell className="text-muted-foreground">2:00 AM</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Index Health Check</TableCell>
                      <TableCell>Weekly</TableCell>
                      <TableCell className="text-muted-foreground">Sunday 3:00 AM</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
