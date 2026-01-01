'use client';

/**
 * RADIANT v6.0.4 - Brain Dashboard Page
 * Main dashboard for AGI Brain monitoring and configuration
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain,
  Ghost,
  Moon,
  Shield,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Zap,
} from 'lucide-react';

interface BrainDashboardData {
  ghost: {
    totalGhosts: number;
    activeGhosts: number;
    avgTurnCount: number;
    avgTimeSinceReanchor: number;
    versionDistribution: Record<string, number>;
    migrationsPending: number;
  };
  dreams: {
    pendingJobs: number;
    runningJobs: number;
    completedToday: number;
    failedToday: number;
    avgDurationMs: number;
    oldestPendingAt: string | null;
  };
  oversight: {
    pending: number;
    escalated: number;
    approvedToday: number;
    rejectedToday: number;
    expiredToday: number;
    avgReviewTimeMs: number;
    oldestPendingAt: string | null;
    byDomain: Record<string, number>;
  };
  sofai: {
    total: number;
    byLevel: Record<string, number>;
    avgTrust: number;
    avgDomainRisk: number;
    avgLatencyMs: number;
  } | null;
  timestamp: string;
}

export default function BrainDashboardPage() {
  const [data, setData] = useState<BrainDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/brain/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load dashboard: {error}</span>
            </div>
            <Button onClick={fetchDashboard} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            AGI Brain Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Project AWARE - Autonomous Wakefulness And Reasoning Engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            v6.0.4
          </Badge>
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ghost Vectors"
          value={data?.ghost.activeGhosts || 0}
          subtitle={`${data?.ghost.totalGhosts || 0} total`}
          icon={<Ghost className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Dream Jobs"
          value={data?.dreams.pendingJobs || 0}
          subtitle={`${data?.dreams.runningJobs || 0} running`}
          icon={<Moon className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Oversight Queue"
          value={data?.oversight.pending || 0}
          subtitle={`${data?.oversight.escalated || 0} escalated`}
          icon={<Shield className="h-5 w-5" />}
          color="amber"
          alert={(data?.oversight.escalated ?? 0) > 0}
        />
        <StatCard
          title="SOFAI Routing"
          value={data?.sofai?.total || 0}
          subtitle={`${((data?.sofai?.avgTrust || 0) * 100).toFixed(0)}% avg trust`}
          icon={<Zap className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ghost" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ghost" className="gap-2">
            <Ghost className="h-4 w-4" />
            Ghost Vectors
          </TabsTrigger>
          <TabsTrigger value="dreams" className="gap-2">
            <Moon className="h-4 w-4" />
            Dreaming
          </TabsTrigger>
          <TabsTrigger value="oversight" className="gap-2">
            <Shield className="h-4 w-4" />
            Oversight
          </TabsTrigger>
          <TabsTrigger value="sofai" className="gap-2">
            <Activity className="h-4 w-4" />
            SOFAI
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ghost">
          <GhostPanel data={data?.ghost} />
        </TabsContent>

        <TabsContent value="dreams">
          <DreamPanel data={data?.dreams} />
        </TabsContent>

        <TabsContent value="oversight">
          <OversightPanel data={data?.oversight} />
        </TabsContent>

        <TabsContent value="sofai">
          <SofaiPanel data={data?.sofai} />
        </TabsContent>

        <TabsContent value="config">
          <ConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  alert,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'purple' | 'blue' | 'amber' | 'green';
  alert?: boolean;
}) {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    green: 'bg-green-100 text-green-600',
  };

  return (
    <Card className={alert ? 'border-amber-300 bg-amber-50' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
          {alert && <AlertTriangle className="h-5 w-5 text-amber-500" />}
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold">{value.toLocaleString()}</h3>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GhostPanel({ data }: { data?: BrainDashboardData['ghost'] }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ghost Vector Status</CardTitle>
          <CardDescription>Consciousness continuity statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Ghosts</p>
              <p className="text-2xl font-bold">{data.totalGhosts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active (24h)</p>
              <p className="text-2xl font-bold">{data.activeGhosts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Turn Count</p>
              <p className="text-2xl font-bold">{data.avgTurnCount.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Hours Since Re-anchor</p>
              <p className="text-2xl font-bold">{data.avgTimeSinceReanchor.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Version Distribution</CardTitle>
          <CardDescription>Ghost vector versions in use</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(data.versionDistribution).length === 0 ? (
            <p className="text-muted-foreground">No ghost vectors found</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.versionDistribution).map(([version, count]) => (
                <div key={version} className="flex items-center justify-between">
                  <Badge variant="outline">{version}</Badge>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          )}
          {data.migrationsPending > 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{data.migrationsPending} migrations pending</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DreamPanel({ data }: { data?: BrainDashboardData['dreams'] }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Dream Queue Status</CardTitle>
          <CardDescription>Twilight dreaming job status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{data.pendingJobs}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-2xl font-bold text-blue-600">{data.runningJobs}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed Today</p>
              <p className="text-2xl font-bold text-green-600">{data.completedToday}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed Today</p>
              <p className="text-2xl font-bold text-red-600">{data.failedToday}</p>
            </div>
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">Average Duration</p>
            <p className="text-lg font-mono">{(data.avgDurationMs / 1000).toFixed(2)}s</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Trigger</CardTitle>
          <CardDescription>Trigger dream for a specific tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <TriggerDreamForm />
        </CardContent>
      </Card>
    </div>
  );
}

function OversightPanel({ data }: { data?: BrainDashboardData['oversight'] }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Oversight Queue</CardTitle>
          <CardDescription>Human oversight for high-risk domains</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{data.pending}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Escalated</p>
              <p className="text-2xl font-bold text-amber-600">{data.escalated}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved Today</p>
              <p className="text-2xl font-bold text-green-600">{data.approvedToday}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rejected Today</p>
              <p className="text-2xl font-bold text-red-600">{data.rejectedToday}</p>
            </div>
          </div>
          {data.expiredToday > 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{data.expiredToday} expired today (Silence ≠ Consent)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By Domain</CardTitle>
          <CardDescription>Oversight items by domain</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.entries(data.byDomain).length === 0 ? (
            <p className="text-muted-foreground">No items in queue</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.byDomain).map(([domain, count]) => (
                <div key={domain} className="flex items-center justify-between">
                  <Badge variant={domain === 'healthcare' ? 'destructive' : 'outline'}>
                    {domain}
                  </Badge>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SofaiPanel({ data }: { data?: BrainDashboardData['sofai'] }) {
  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No SOFAI data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>SOFAI Routing Stats</CardTitle>
          <CardDescription>System 1/1.5/2 routing decisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">System 1</p>
              <p className="text-2xl font-bold text-green-600">{data.byLevel.system1 || 0}</p>
              <p className="text-xs text-muted-foreground">Fast</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">System 1.5</p>
              <p className="text-2xl font-bold text-blue-600">{data.byLevel['system1.5'] || 0}</p>
              <p className="text-xs text-muted-foreground">Intermediate</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">System 2</p>
              <p className="text-2xl font-bold text-purple-600">{data.byLevel.system2 || 0}</p>
              <p className="text-xs text-muted-foreground">Deliberate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Averages</CardTitle>
          <CardDescription>Performance metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Avg Trust</p>
              <p className="text-2xl font-bold">{(data.avgTrust * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Risk</p>
              <p className="text-2xl font-bold">{(data.avgDomainRisk * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Latency</p>
              <p className="text-2xl font-bold">{data.avgLatencyMs.toFixed(0)}ms</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Brain Configuration</CardTitle>
        <CardDescription>Manage AGI Brain parameters</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href="/brain/config">
            <Settings className="h-4 w-4 mr-2" />
            Open Configuration Panel
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function TriggerDreamForm() {
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleTrigger = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/brain/dreams/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await response.json();
      setResult(`Dream scheduled: ${data.job?.id || 'success'}`);
    } catch (err) {
      setResult(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Tenant ID</label>
        <input
          type="text"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="Enter tenant ID"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <Button onClick={handleTrigger} disabled={!tenantId || loading}>
        {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Moon className="h-4 w-4 mr-2" />}
        Trigger Dream
      </Button>
      {result && <p className="text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
