'use client';

/**
 * RADIANT v6.0.4-S1 - ECD Monitor Page
 * Entity-Context Divergence metrics for hallucination prevention
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  Target,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Activity,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';
import { brainApi, type ECDStats } from '@/lib/api';

interface ECDTrendData {
  date: string;
  avgScore: number;
  passRate: number;
  totalRequests: number;
}

interface ECDEntityData {
  entityType: string;
  totalCount: number;
  groundedCount: number;
  divergentCount: number;
  divergenceRate: number;
}

interface ECDDivergence {
  entity: string;
  type: string;
  reason: string;
  timestamp: string;
}

export default function ECDMonitorPage() {
  const [stats, setStats] = useState<ECDStats | null>(null);
  const [trend, setTrend] = useState<ECDTrendData[]>([]);
  const [entities, setEntities] = useState<ECDEntityData[]>([]);
  const [divergences, setDivergences] = useState<ECDDivergence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, trendData, entitiesData, divergencesData] = await Promise.all([
        brainApi.getECDStats(7),
        brainApi.getECDTrend(7),
        brainApi.getECDEntityBreakdown(7),
        brainApi.getECDRecentDivergences(10),
      ]);
      setStats(statsData);
      setTrend(trendData);
      setEntities(entitiesData);
      setDivergences(divergencesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ECD metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <ECDSkeleton />;
  }

  if (error && !stats) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load ECD metrics: {error}</span>
            </div>
            <Button onClick={fetchData} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scoreStatus = (stats?.avgScore ?? 0) < 0.05 ? 'excellent' : (stats?.avgScore ?? 0) < 0.1 ? 'good' : 'warning';
  const passRateStatus = (stats?.firstPassRate ?? 0) > 90 ? 'excellent' : (stats?.firstPassRate ?? 0) > 80 ? 'good' : 'warning';
  const alignmentPercent = 100 - (stats?.avgScore ?? 0) * 100;

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
              <Shield className="h-6 w-6 text-green-600" />
              Entity-Context Alignment
            </h1>
            <p className="text-muted-foreground">
              Project TRUTH - Hallucination prevention metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={scoreStatus === 'excellent' ? 'default' : scoreStatus === 'good' ? 'secondary' : 'destructive'}
            className="text-lg px-4 py-2"
          >
            {alignmentPercent.toFixed(1)}% Aligned
          </Badge>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Average ECD Score"
          value={(stats?.avgScore ?? 0).toFixed(3)}
          target="< 0.100"
          icon={<Target className="h-4 w-4" />}
          status={scoreStatus}
          description="Lower is better (0 = perfect)"
        />
        <MetricCard
          title="First-Pass Success"
          value={`${(stats?.firstPassRate ?? 0).toFixed(1)}%`}
          target="> 85%"
          icon={<CheckCircle className="h-4 w-4" />}
          status={passRateStatus}
          description="Responses passing on first try"
        />
        <MetricCard
          title="Refinements Today"
          value={(stats?.refinementsToday ?? 0).toString()}
          icon={<RefreshCw className="h-4 w-4" />}
          status="neutral"
          description="Auto-corrections applied"
        />
        <MetricCard
          title="Blocked Today"
          value={(stats?.blockedToday ?? 0).toString()}
          icon={<XCircle className="h-4 w-4" />}
          status={(stats?.blockedToday ?? 0) === 0 ? 'excellent' : 'warning'}
          description="Responses blocked for safety"
        />
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            ECD Score Trend (7 Days)
          </CardTitle>
          <CardDescription>
            Daily average divergence score and pass rate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No trend data available yet
            </div>
          ) : (
            <div className="space-y-4">
              {trend.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-muted-foreground">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Progress value={(1 - day.avgScore) * 100} className="flex-1" />
                      <span className="w-16 text-sm font-medium">
                        {((1 - day.avgScore) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <span className="w-20 text-sm text-muted-foreground text-right">
                    {day.totalRequests} reqs
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entity Breakdown and Recent Divergences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Divergence by Entity Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entities.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No entity data available yet
              </div>
            ) : (
              <div className="space-y-3">
                {entities.slice(0, 8).map((entity) => (
                  <div key={entity.entityType} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">
                        {entity.entityType.replace(/_/g, ' ')}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {entity.totalCount}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={100 - entity.divergenceRate} 
                        className="w-24" 
                      />
                      <span className={`w-12 text-sm font-medium ${
                        entity.divergenceRate > 20 ? 'text-red-600' : 
                        entity.divergenceRate > 10 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {entity.divergenceRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Divergences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {divergences.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No recent divergences detected 🎉
                </p>
              ) : (
                divergences.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">&quot;{d.entity}&quot;</p>
                      <p className="text-sm text-muted-foreground">
                        {d.type} • {d.reason.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Guarantee Badge */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-800 dark:text-green-200">
                Truth Verification Active
              </h3>
              <p className="text-green-700 dark:text-green-300">
                All responses are verified against source materials before delivery
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {alignmentPercent.toFixed(1)}%
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Factual Accuracy
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  target,
  icon,
  status,
  description,
}: {
  title: string;
  value: string;
  target?: string;
  icon: React.ReactNode;
  status: 'excellent' | 'good' | 'warning' | 'neutral';
  description: string;
}) {
  const statusColors = {
    excellent: 'text-green-600 bg-green-50 dark:bg-green-950 border-green-200',
    good: 'text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200',
    warning: 'text-amber-600 bg-amber-50 dark:bg-amber-950 border-amber-200',
    neutral: 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200',
  };

  return (
    <Card className={statusColors[status]}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {target && (
          <p className="text-xs opacity-70">Target: {target}</p>
        )}
        <p className="text-xs mt-1 opacity-80">{description}</p>
      </CardContent>
    </Card>
  );
}

function ECDSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
