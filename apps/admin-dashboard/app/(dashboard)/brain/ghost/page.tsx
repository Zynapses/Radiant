'use client';

/**
 * RADIANT v6.0.4 - Ghost Status Page
 * Monitor and manage Ghost Vector consciousness continuity
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  Ghost,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Search,
  ChevronLeft,
  Activity,
  Clock,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

interface GhostStats {
  totalGhosts: number;
  activeGhosts: number;
  avgTurnCount: number;
  avgTimeSinceReanchor: number;
  versionDistribution: Record<string, number>;
  migrationsPending: number;
}

interface GhostHealthCheck {
  userId: string;
  tenantId: string;
  healthy: boolean;
  issues: string[];
  lastAccess: string | null;
  turnsSinceReanchor: number;
}

export default function GhostStatusPage() {
  const [stats, setStats] = useState<GhostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchUserId, setSearchUserId] = useState('');
  const [searchTenantId, setSearchTenantId] = useState('');
  const [healthCheck, setHealthCheck] = useState<GhostHealthCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/brain/ghost/stats');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load ghost stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async () => {
    if (!searchUserId || !searchTenantId) return;
    setChecking(true);
    try {
      const response = await fetch(
        `/api/admin/brain/ghost/${searchUserId}/health?tenantId=${searchTenantId}`
      );
      if (!response.ok) throw new Error('Failed to check health');
      const data = await response.json();
      setHealthCheck(data);
    } catch (err) {
      console.error('Failed to check health:', err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <GhostSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/brain">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ghost className="h-6 w-6 text-purple-600" />
              Ghost Vector Status
            </h1>
            <p className="text-muted-foreground">
              Consciousness continuity monitoring
            </p>
          </div>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Ghosts"
          value={stats?.totalGhosts || 0}
          icon={<Ghost className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Active (24h)"
          value={stats?.activeGhosts || 0}
          icon={<Activity className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          title="Avg Turn Count"
          value={stats?.avgTurnCount?.toFixed(1) || '0'}
          icon={<Layers className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Avg Hours Since Re-anchor"
          value={stats?.avgTimeSinceReanchor?.toFixed(1) || '0'}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
      </div>

      {/* Version Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Version Distribution</CardTitle>
          <CardDescription>
            Ghost vectors by model version. Version mismatches trigger cold starts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats && Object.entries(stats.versionDistribution).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.versionDistribution).map(([version, count]) => {
                const percentage = stats.totalGhosts > 0 
                  ? ((count / stats.totalGhosts) * 100).toFixed(1) 
                  : 0;
                return (
                  <div key={version} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{version}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {count} ghosts ({percentage}%)
                        </span>
                      </div>
                    </div>
                    <Progress value={Number(percentage)} className="h-2" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No ghost vectors found</p>
          )}

          {stats?.migrationsPending && stats.migrationsPending > 0 && (
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                  {stats.migrationsPending} migrations pending
                </span>
              </div>
              <p className="text-sm text-amber-600 mt-1">
                These ghosts have outdated versions and will cold-start on next access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Check */}
      <Card>
        <CardHeader>
          <CardTitle>Ghost Health Check</CardTitle>
          <CardDescription>
            Check the health status of a specific user&apos;s ghost vector
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Enter user ID"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Tenant ID</label>
              <Input
                placeholder="Enter tenant ID"
                value={searchTenantId}
                onChange={(e) => setSearchTenantId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={checkHealth}
                disabled={!searchUserId || !searchTenantId || checking}
              >
                {checking ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Check
              </Button>
            </div>
          </div>

          {healthCheck && (
            <div
              className={`p-4 rounded-lg border ${
                healthCheck.healthy
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {healthCheck.healthy ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span
                  className={`font-medium ${
                    healthCheck.healthy ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {healthCheck.healthy ? 'Healthy' : 'Issues Detected'}
                </span>
              </div>

              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">User ID</TableCell>
                    <TableCell>{healthCheck.userId}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Tenant ID</TableCell>
                    <TableCell>{healthCheck.tenantId}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Turns Since Re-anchor</TableCell>
                    <TableCell>{healthCheck.turnsSinceReanchor}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Last Access</TableCell>
                    <TableCell>
                      {healthCheck.lastAccess
                        ? new Date(healthCheck.lastAccess).toLocaleString()
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                  {healthCheck.issues.length > 0 && (
                    <TableRow>
                      <TableCell className="font-medium">Issues</TableCell>
                      <TableCell>
                        <ul className="list-disc list-inside text-red-600">
                          {healthCheck.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'purple' | 'green' | 'blue' | 'amber';
}) {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`p-2 rounded-lg w-fit ${colorClasses[color]}`}>{icon}</div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold">{value}</h3>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GhostSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
