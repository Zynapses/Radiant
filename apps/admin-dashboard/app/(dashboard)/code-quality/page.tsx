'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Code2, 
  FileCode2, 
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Eye,
  AlertCircle,
  Bug,
  FileWarning,
} from 'lucide-react';

interface CoverageByComponent {
  component: string;
  lineCoverage: number;
  functionCoverage: number;
  branchCoverage: number;
  overallCoverage: number;
  capturedAt: string;
}

interface DebtSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalEstimatedHours: number;
}

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  component: string;
  status: string;
  createdAt: string;
}

interface DebtItem {
  id: string;
  debtId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  component: string;
  estimatedHours: number;
}

interface JsonSafetyProgress {
  component: string;
  migratedCount: number;
  totalCount: number;
  percentage: number;
}

interface DashboardData {
  summary: {
    overallCoverage: number;
    componentsWithTests: number;
    totalComponents: number;
    openDebtItems: number;
    criticalAlerts: number;
    jsonSafetyProgress: number;
  };
  coverageByComponent: CoverageByComponent[];
  recentAlerts: Alert[];
  debtSummary: DebtSummary;
  trends: {
    coverageTrend: number;
    debtTrend: number;
  };
}

export default function CodeQualityPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [debtItems, setDebtItems] = useState<DebtItem[]>([]);
  const [jsonProgress, setJsonProgress] = useState<JsonSafetyProgress[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [debtFilter, setDebtFilter] = useState('all');

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'debt') {
      loadDebtItems();
    } else if (activeTab === 'json-safety') {
      loadJsonProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, debtFilter]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/code-quality/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDebtItems() {
    try {
      const status = debtFilter === 'all' ? 'open,in_progress' : debtFilter;
      const res = await fetch(`/api/admin/code-quality/debt?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setDebtItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load debt items:', error);
    }
  }

  async function loadJsonProgress() {
    try {
      const res = await fetch('/api/admin/code-quality/json-safety');
      if (res.ok) {
        const data = await res.json();
        setJsonProgress(data.byComponent || []);
      }
    } catch (error) {
      console.error('Failed to load JSON safety progress:', error);
    }
  }

  function getCoverageColor(coverage: number): string {
    if (coverage >= 80) return 'text-green-600';
    if (coverage >= 60) return 'text-yellow-600';
    if (coverage >= 40) return 'text-orange-600';
    return 'text-red-600';
  }

  function getCoverageBadge(coverage: number) {
    if (coverage >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (coverage >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    if (coverage >= 40) return <Badge className="bg-orange-100 text-orange-800">Fair</Badge>;
    return <Badge className="bg-red-100 text-red-800">Needs Work</Badge>;
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case 'p0_critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'p1_high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'p2_medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Code Quality</h1>
          <p className="text-muted-foreground">
            Test coverage, technical debt, and code quality metrics
          </p>
        </div>
        <Button onClick={loadDashboard} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Coverage</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCoverageColor(dashboard?.summary.overallCoverage || 0)}`}>
              {dashboard?.summary.overallCoverage || 0}%
            </div>
            <Progress 
              value={dashboard?.summary.overallCoverage || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {dashboard?.summary.componentsWithTests || 0} of {dashboard?.summary.totalComponents || 0} components tested
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Technical Debt</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.summary.openDebtItems || 0}</div>
            <p className="text-xs text-muted-foreground">
              Open items
            </p>
            <div className="flex gap-2 mt-2">
              {dashboard?.debtSummary.critical ? (
                <Badge variant="destructive">{dashboard.debtSummary.critical} critical</Badge>
              ) : null}
              {dashboard?.debtSummary.high ? (
                <Badge className="bg-orange-100 text-orange-800">{dashboard.debtSummary.high} high</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">JSON Safety</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCoverageColor(dashboard?.summary.jsonSafetyProgress || 0)}`}>
              {dashboard?.summary.jsonSafetyProgress || 0}%
            </div>
            <Progress 
              value={dashboard?.summary.jsonSafetyProgress || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Migrated to safe utilities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.summary.criticalAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Critical issues requiring attention
            </p>
            <div className="flex gap-2 mt-2">
              {(dashboard?.recentAlerts?.length || 0) > 0 && (
                <Badge variant="outline">{dashboard?.recentAlerts.length} total alerts</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="coverage">Test Coverage</TabsTrigger>
          <TabsTrigger value="debt">Technical Debt</TabsTrigger>
          <TabsTrigger value="json-safety">JSON Safety</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Coverage by Component */}
            <Card>
              <CardHeader>
                <CardTitle>Coverage by Component</CardTitle>
                <CardDescription>Test coverage across platform components</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard?.coverageByComponent.map((comp) => (
                    <div key={comp.component} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{comp.component}</span>
                        <span className={`text-sm font-bold ${getCoverageColor(comp.overallCoverage)}`}>
                          {comp.overallCoverage}%
                        </span>
                      </div>
                      <Progress value={comp.overallCoverage} className="h-2" />
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Lines: {comp.lineCoverage}%</span>
                        <span>Functions: {comp.functionCoverage}%</span>
                        <span>Branches: {comp.branchCoverage}%</span>
                      </div>
                    </div>
                  ))}
                  {(!dashboard?.coverageByComponent || dashboard.coverageByComponent.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No coverage data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Code quality issues requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard?.recentAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {alert.component}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!dashboard?.recentAlerts || dashboard.recentAlerts.length === 0) && (
                    <div className="flex flex-col items-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mb-2" />
                      <p className="text-sm">No active alerts</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Debt Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Debt Summary</CardTitle>
              <CardDescription>
                Estimated {dashboard?.debtSummary.totalEstimatedHours || 0} hours to resolve all open items
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600">{dashboard?.debtSummary.critical || 0}</div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950">
                  <div className="text-2xl font-bold text-orange-600">{dashboard?.debtSummary.high || 0}</div>
                  <div className="text-sm text-muted-foreground">High</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <div className="text-2xl font-bold text-yellow-600">{dashboard?.debtSummary.medium || 0}</div>
                  <div className="text-sm text-muted-foreground">Medium</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-950">
                  <div className="text-2xl font-bold text-gray-600">{dashboard?.debtSummary.low || 0}</div>
                  <div className="text-sm text-muted-foreground">Low</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Coverage Details</CardTitle>
              <CardDescription>Detailed coverage metrics by component</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead className="text-right">Line Coverage</TableHead>
                    <TableHead className="text-right">Function Coverage</TableHead>
                    <TableHead className="text-right">Branch Coverage</TableHead>
                    <TableHead className="text-right">Overall</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.coverageByComponent.map((comp) => (
                    <TableRow key={comp.component}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileCode2 className="h-4 w-4 text-muted-foreground" />
                          {comp.component}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right ${getCoverageColor(comp.lineCoverage)}`}>
                        {comp.lineCoverage}%
                      </TableCell>
                      <TableCell className={`text-right ${getCoverageColor(comp.functionCoverage)}`}>
                        {comp.functionCoverage}%
                      </TableCell>
                      <TableCell className={`text-right ${getCoverageColor(comp.branchCoverage)}`}>
                        {comp.branchCoverage}%
                      </TableCell>
                      <TableCell className={`text-right font-bold ${getCoverageColor(comp.overallCoverage)}`}>
                        {comp.overallCoverage}%
                      </TableCell>
                      <TableCell>
                        {getCoverageBadge(comp.overallCoverage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technical Debt Tab */}
        <TabsContent value="debt" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Technical Debt Items</CardTitle>
                <CardDescription>Track and manage technical debt</CardDescription>
              </div>
              <Select value={debtFilter} onValueChange={setDebtFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Open</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead className="text-right">Est. Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.debtId}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {item.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell>{item.component || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {item.estimatedHours}h
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'in_progress' ? 'default' : 'secondary'}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {debtItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No technical debt items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JSON Safety Tab */}
        <TabsContent value="json-safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>JSON.parse Migration Progress</CardTitle>
              <CardDescription>
                Tracking migration from JSON.parse to safe utilities with schema validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {jsonProgress.map((item) => (
                  <div key={item.component} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileWarning className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{item.component}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.migratedCount} / {item.totalCount}
                        </span>
                        <span className={`text-sm font-bold ${getCoverageColor(item.percentage)}`}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}
                {jsonProgress.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
                    <p>No JSON.parse locations tracked yet</p>
                    <p className="text-xs mt-1">Run the analysis script to populate this data</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Safe JSON Utilities</CardTitle>
              <CardDescription>Available utilities for safe JSON parsing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">safeJsonParse</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Basic safe parsing with optional fallback value
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    safeJsonParse(json, fallback?)
                  </code>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">parseJsonWithSchema</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Parse with Zod schema validation
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    parseJsonWithSchema(json, schema)
                  </code>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">parseEventBody</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Parse API Gateway event body safely
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    parseEventBody(body, schema?)
                  </code>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">parseJsonField</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Parse nested JSON fields from database
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    parseJsonField(value, fallback?)
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code Quality Alerts</CardTitle>
              <CardDescription>Active alerts and issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.recentAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-4 rounded-lg border ${
                      alert.severity === 'critical' 
                        ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' 
                        : alert.severity === 'warning'
                        ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
                        : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{alert.component}</Badge>
                            <Badge variant="outline">{alert.alertType.replace('_', ' ')}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(alert.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!dashboard?.recentAlerts || dashboard.recentAlerts.length === 0) && (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">All Clear!</p>
                    <p className="text-sm">No active code quality alerts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
