'use client';

/**
 * RADIANT v6.0.4 - SOFAI Stats Page
 * System 1/1.5/2 routing statistics and monitoring
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Brain,
  RefreshCw,
  ChevronLeft,
  Zap,
  Scale,
  Lightbulb,
  TrendingUp,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface SOFAIStats {
  totalRoutings: number;
  byLevel: {
    system1: { count: number; avgLatencyMs: number; avgCost: number };
    system15: { count: number; avgLatencyMs: number; avgCost: number };
    system2: { count: number; avgLatencyMs: number; avgCost: number };
  };
  avgTrustScore: number;
  avgDomainRisk: number;
  avgRoutingScore: number;
  byDomain: Record<string, { count: number; avgLevel: number }>;
  last24Hours: {
    hour: number;
    system1: number;
    system15: number;
    system2: number;
  }[];
}

export default function SOFAIStatsPage() {
  const [stats, setStats] = useState<SOFAIStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/brain/sofai/stats');
      if (response.ok) {
        setStats(await response.json());
      }
    } catch (err) {
      console.error('Failed to load SOFAI stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <SOFAISkeleton />;
  }

  const totalByLevel = stats
    ? (stats.byLevel.system1.count + stats.byLevel.system15.count + stats.byLevel.system2.count)
    : 0;

  const getPercentage = (count: number) => {
    if (totalByLevel === 0) return 0;
    return ((count / totalByLevel) * 100).toFixed(1);
  };

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
              <Brain className="h-6 w-6 text-indigo-600" />
              SOFAI Routing Stats
            </h1>
            <p className="text-muted-foreground">
              System Of Fast And Intuitive routing analysis
            </p>
          </div>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* System 1 */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">System 1</CardTitle>
            </div>
            <CardDescription>Fast intuitive responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-green-600">
                  {stats?.byLevel.system1.count || 0}
                </span>
                <Badge variant="outline" className="bg-green-50">
                  {getPercentage(stats?.byLevel.system1.count || 0)}%
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Latency</span>
                  <span>{(stats?.byLevel.system1.avgLatencyMs || 0).toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Cost</span>
                  <span>${(stats?.byLevel.system1.avgCost || 0).toFixed(4)}</span>
                </div>
              </div>
              <Progress value={Number(getPercentage(stats?.byLevel.system1.count || 0))} className="h-2 bg-green-100" />
            </div>
          </CardContent>
        </Card>

        {/* System 1.5 */}
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">System 1.5</CardTitle>
            </div>
            <CardDescription>Moderate deliberation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-amber-600">
                  {stats?.byLevel.system15.count || 0}
                </span>
                <Badge variant="outline" className="bg-amber-50">
                  {getPercentage(stats?.byLevel.system15.count || 0)}%
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Latency</span>
                  <span>{(stats?.byLevel.system15.avgLatencyMs || 0).toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Cost</span>
                  <span>${(stats?.byLevel.system15.avgCost || 0).toFixed(4)}</span>
                </div>
              </div>
              <Progress value={Number(getPercentage(stats?.byLevel.system15.count || 0))} className="h-2 bg-amber-100" />
            </div>
          </CardContent>
        </Card>

        {/* System 2 */}
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-red-600" />
              <CardTitle className="text-lg">System 2</CardTitle>
            </div>
            <CardDescription>Deep analytical reasoning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-red-600">
                  {stats?.byLevel.system2.count || 0}
                </span>
                <Badge variant="outline" className="bg-red-50">
                  {getPercentage(stats?.byLevel.system2.count || 0)}%
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Latency</span>
                  <span>{(stats?.byLevel.system2.avgLatencyMs || 0).toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Cost</span>
                  <span>${(stats?.byLevel.system2.avgCost || 0).toFixed(4)}</span>
                </div>
              </div>
              <Progress value={Number(getPercentage(stats?.byLevel.system2.count || 0))} className="h-2 bg-red-100" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Averages */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-muted-foreground">Total Routings</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats?.totalRoutings || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-500" />
              <span className="text-muted-foreground">Avg Trust Score</span>
            </div>
            <p className="text-2xl font-bold mt-2">{(stats?.avgTrustScore || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-muted-foreground">Avg Domain Risk</span>
            </div>
            <p className="text-2xl font-bold mt-2">{(stats?.avgDomainRisk || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <span className="text-muted-foreground">Avg Routing Score</span>
            </div>
            <p className="text-2xl font-bold mt-2">{(stats?.avgRoutingScore || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* By Domain */}
      <Card>
        <CardHeader>
          <CardTitle>Routing by Domain</CardTitle>
          <CardDescription>
            Domain-specific routing patterns and average system levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.byDomain && Object.keys(stats.byDomain).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Avg System Level</TableHead>
                  <TableHead>Distribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(stats.byDomain)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([domain, data]) => (
                    <TableRow key={domain}>
                      <TableCell className="font-medium capitalize">{domain}</TableCell>
                      <TableCell>{data.count}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            data.avgLevel < 1.3
                              ? 'bg-green-50 text-green-700'
                              : data.avgLevel < 1.7
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                          }
                        >
                          {data.avgLevel.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <Progress
                            value={stats.totalRoutings > 0 ? (data.count / stats.totalRoutings) * 100 : 0}
                            className="h-2"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No domain routing data available</p>
          )}
        </CardContent>
      </Card>

      {/* Formula Reference */}
      <Card>
        <CardHeader>
          <CardTitle>SOFAI Routing Formula</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
            <p className="mb-2">
              <strong>routingScore</strong> = (1 - trustScore) × domainRisk
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• routingScore &lt; 0.3 → <span className="text-green-600">System 1</span> (fast)</li>
              <li>• routingScore &lt; 0.6 → <span className="text-amber-600">System 1.5</span> (moderate)</li>
              <li>• routingScore ≥ 0.6 → <span className="text-red-600">System 2</span> (deep)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SOFAISkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
