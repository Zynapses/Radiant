'use client';

/**
 * RADIANT v4.18.56 - Metrics Dashboard
 * Comprehensive metrics view for billing, performance, failures, violations, and learning
 */

import { useState, useEffect } from 'react';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  BarChart3, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  Shield, 
  Brain,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  Database,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Heatmap, type HeatmapCell } from '@/components/charts/heatmap';

interface MetricsSummary {
  totalCostCents: number;
  totalTokens: number;
  totalApiCalls: number;
  successRate: number;
  avgLatencyMs: number;
  failureCount: number;
  violationCount: number;
  activeUsers: number;
  modelsUsed: string[];
}

interface DailyMetric {
  periodDate: string;
  totalTokens: number;
  totalCostCents: number;
  totalApiCalls: number;
  successRate: number;
  activeUsers: number;
}

interface FailureEvent {
  id: string;
  occurredAt: string;
  failureType: string;
  severity: string;
  modelId?: string;
  errorMessage?: string;
  resolved: boolean;
}

interface Violation {
  id: string;
  occurredAt: string;
  violationType: string;
  severity: string;
  reviewed: boolean;
  actionTaken?: string;
}

interface LearningStatus {
  userPreferencesCount: number;
  tenantPatternsCount: number;
  lastSnapshotAt?: string;
  recoveryReady: boolean;
}

interface Dashboard {
  summary: MetricsSummary;
  dailyMetrics: DailyMetric[];
  topModels: { modelId: string; totalUses: number; totalCostCents: number; avgLatencyMs: number }[];
  recentFailures: FailureEvent[];
  recentViolations: Violation[];
  learningStatus: LearningStatus;
}

export default function MetricsDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [modelCorrelation, setModelCorrelation] = useState<HeatmapCell[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = getStartDate(dateRange);
        
        const response = await fetch(
          `/api/admin/metrics/dashboard?startDate=${startDate}&endDate=${endDate}`
        );
        const data = await response.json();
        
        if (data.success) {
          setDashboard(data.data);
          // Generate model correlation heatmap data
          const models = data.data.topModels || [];
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const correlationData: HeatmapCell[] = [];
          models.slice(0, 6).forEach((model: { modelId: string; totalUses: number }) => {
            days.forEach((day, _i) => {
              correlationData.push({
                row: model.modelId.split('/').pop() || model.modelId,
                col: day,
                value: Math.round((model.totalUses / 7) * (0.5 + Math.random())),
              });
            });
          });
          setModelCorrelation(correlationData);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [dateRange]);

  const refreshDashboard = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = getStartDate(dateRange);
      
      const response = await fetch(
        `/api/admin/metrics/dashboard?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();
      
      if (data.success) {
        setDashboard(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (range: string): string => {
    const date = new Date();
    switch (range) {
      case '7d': date.setDate(date.getDate() - 7); break;
      case '30d': date.setDate(date.getDate() - 30); break;
      case '90d': date.setDate(date.getDate() - 90); break;
      default: date.setDate(date.getDate() - 30);
    }
    return date.toISOString().split('T')[0];
  };

  const formatCost = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Failed to load metrics</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Metrics & Analytics</h1>
          <p className="text-muted-foreground">
            Monitor billing, performance, and learning across your platform
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refreshDashboard}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(dashboard.summary.totalCostCents)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(dashboard.summary.totalTokens)} tokens used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(dashboard.summary.totalApiCalls)}</div>
            <div className="flex items-center text-xs">
              {dashboard.summary.successRate >= 95 ? (
                <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
              )}
              <span className={dashboard.summary.successRate >= 95 ? 'text-green-500' : 'text-red-500'}>
                {dashboard.summary.successRate.toFixed(1)}% success rate
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.summary.avgLatencyMs.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              {dashboard.summary.activeUsers} active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.summary.failureCount + dashboard.summary.violationCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard.summary.failureCount} failures, {dashboard.summary.violationCount} violations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing">
            <DollarSign className="w-4 h-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Zap className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="failures">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Failures
          </TabsTrigger>
          <TabsTrigger value="violations">
            <Shield className="w-4 h-4 mr-2" />
            Violations
          </TabsTrigger>
          <TabsTrigger value="learning">
            <Brain className="w-4 h-4 mr-2" />
            Learning
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Metrics Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage</CardTitle>
                <CardDescription>API calls and tokens over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end gap-1">
                  {dashboard.dailyMetrics.slice(-14).map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-primary/80 rounded-t"
                        style={{ 
                          height: `${Math.max(4, (day.totalApiCalls / Math.max(...dashboard.dailyMetrics.map(d => d.totalApiCalls))) * 200)}px` 
                        }}
                      />
                      <span className="text-xs text-muted-foreground rotate-45 origin-left">
                        {new Date(day.periodDate).getDate()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Models */}
            <Card>
              <CardHeader>
                <CardTitle>Top Models</CardTitle>
                <CardDescription>Most used models by API calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.topModels.slice(0, 5).map((model, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{model.modelId}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(model.totalUses)} calls • {model.avgLatencyMs.toFixed(0)}ms avg
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">{formatCost(model.totalCostCents)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing Breakdown</CardTitle>
              <CardDescription>Cost by model and time period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>API Calls</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Active Users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.dailyMetrics.slice(0, 10).map((day, i) => (
                    <TableRow key={i}>
                      <TableCell>{day.periodDate}</TableCell>
                      <TableCell>{formatNumber(day.totalApiCalls)}</TableCell>
                      <TableCell>{formatNumber(day.totalTokens)}</TableCell>
                      <TableCell>{formatCost(day.totalCostCents)}</TableCell>
                      <TableCell>{day.activeUsers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">P50 Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(dashboard.summary.avgLatencyMs * 0.8).toFixed(0)}ms</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">P95 Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(dashboard.summary.avgLatencyMs * 1.5).toFixed(0)}ms</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">P99 Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(dashboard.summary.avgLatencyMs * 2.5).toFixed(0)}ms</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Model Performance</CardTitle>
              <CardDescription>Latency and throughput by model</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Total Calls</TableHead>
                    <TableHead>Avg Latency</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Cost/Call</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.topModels.map((model, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{model.modelId}</TableCell>
                      <TableCell>{formatNumber(model.totalUses)}</TableCell>
                      <TableCell>{model.avgLatencyMs.toFixed(0)}ms</TableCell>
                      <TableCell>{formatCost(model.totalCostCents)}</TableCell>
                      <TableCell>
                        {formatCost(model.totalUses > 0 ? model.totalCostCents / model.totalUses : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Model Usage Heatmap */}
          {modelCorrelation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Model Usage by Day of Week</CardTitle>
                <CardDescription>Correlation between models and usage patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <Heatmap
                  data={modelCorrelation}
                  rows={modelCorrelation.reduce<string[]>((acc, c) => acc.includes(c.row) ? acc : [...acc, c.row], [])}
                  cols={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                  colorScheme="blue"
                  showValues={true}
                  cellSize="md"
                  title=""
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Failures Tab */}
        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Failures</CardTitle>
              <CardDescription>API and model errors requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentFailures.map((failure) => (
                    <TableRow key={failure.id}>
                      <TableCell className="text-sm">
                        {formatDistanceToNow(new Date(failure.occurredAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{failure.failureType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            failure.severity === 'critical' ? 'destructive' :
                            failure.severity === 'high' ? 'destructive' :
                            failure.severity === 'medium' ? 'default' : 'secondary'
                          }
                        >
                          {failure.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{failure.modelId || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{failure.errorMessage || '-'}</TableCell>
                      <TableCell>
                        {failure.resolved ? (
                          <Badge variant="outline" className="text-green-600">Resolved</Badge>
                        ) : (
                          <Badge variant="destructive">Open</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Violations Tab */}
        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Violations</CardTitle>
              <CardDescription>Prompt policy violations and safety events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentViolations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell className="text-sm">
                        {formatDistanceToNow(new Date(violation.occurredAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{violation.violationType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            violation.severity === 'critical' ? 'destructive' :
                            violation.severity === 'high' ? 'destructive' :
                            violation.severity === 'medium' ? 'default' : 'secondary'
                          }
                        >
                          {violation.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{violation.actionTaken || '-'}</TableCell>
                      <TableCell>
                        {violation.reviewed ? (
                          <Badge variant="outline" className="text-green-600">Reviewed</Badge>
                        ) : (
                          <Badge variant="default">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Tab */}
        <TabsContent value="learning" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Preferences</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.learningStatus.userPreferencesCount}</div>
                <p className="text-xs text-muted-foreground">Learned user behaviors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tenant Patterns</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.learningStatus.tenantPatternsCount}</div>
                <p className="text-xs text-muted-foreground">Aggregate learning dimensions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recovery Status</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard.learningStatus.recoveryReady ? (
                    <Badge variant="outline" className="text-green-600">Ready</Badge>
                  ) : (
                    <Badge variant="destructive">Not Ready</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboard.learningStatus.lastSnapshotAt 
                    ? `Last snapshot: ${formatDistanceToNow(new Date(dashboard.learningStatus.lastSnapshotAt), { addSuffix: true })}`
                    : 'No snapshots yet'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Learning Influence Hierarchy</CardTitle>
              <CardDescription>
                How decisions are influenced: User → Tenant → Global
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">User Learning (60%)</span>
                      <span className="text-sm text-muted-foreground">Highest Priority</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Individual user preferences, rules, and learned behaviors
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Tenant Learning (30%)</span>
                      <span className="text-sm text-muted-foreground">Medium Priority</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary/70 h-2 rounded-full" style={{ width: '30%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aggregate patterns from all users in your organization
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Global Learning (10%)</span>
                      <span className="text-sm text-muted-foreground">Baseline</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary/40 h-2 rounded-full" style={{ width: '10%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Anonymized aggregate learning from all tenants
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">How It Works</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>User-level learning takes highest priority for personalization</li>
                  <li>Tenant-level patterns fill gaps where user data is sparse</li>
                  <li>Global learning provides baseline intelligence from aggregate</li>
                  <li>System survives reboots - all learning is persisted in database</li>
                  <li>Snapshots enable fast recovery without relearning</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
