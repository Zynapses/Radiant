'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Shield,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  ChevronRight,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  ListChecks,
  AlertCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AuditRun {
  id: string;
  tenantId: string | null;
  framework: string;
  runType: 'manual' | 'scheduled' | 'triggered';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;
  score: number;
  durationMs: number | null;
  triggeredBy: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AuditResult {
  id: string;
  runId: string;
  checkCode: string;
  checkName: string;
  category: string;
  controlType: string | null;
  isRequired: boolean;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  details: string | null;
  evidence: Record<string, unknown> | null;
  remediation: string | null;
  durationMs: number | null;
  executedAt: string;
}

interface AuditSummary {
  run: AuditRun;
  results: AuditResult[];
  byCategory: Record<string, { passed: number; failed: number; total: number }>;
  bySeverity: Record<string, { passed: number; failed: number; total: number }>;
  criticalFailures: AuditResult[];
}

interface Framework {
  name: string;
  code: string;
  totalChecks: number;
  requiredChecks: number;
  categories: string[];
}

interface Dashboard {
  recentRuns: AuditRun[];
  frameworkScores: Record<string, { latestScore: number; latestRun: string; trend: number }>;
  criticalIssues: number;
  totalChecks: number;
  passRate: number;
}

const STATUS_COLORS: Record<string, string> = {
  passed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-600',
  error: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-blue-500 text-white',
};

const FRAMEWORK_NAMES: Record<string, string> = {
  soc2: 'SOC 2',
  hipaa: 'HIPAA',
  gdpr: 'GDPR',
  iso27001: 'ISO 27001',
  'pci-dss': 'PCI-DSS',
  all: 'All Frameworks',
};

export default function SelfAuditPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRun, setSelectedRun] = useState<AuditSummary | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string>('all');
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<Dashboard>({
    queryKey: ['self-audit-dashboard'],
    queryFn: () => fetch('/api/admin/self-audit/dashboard').then(r => r.json()).then(r => r.data),
  });

  // Fetch history
  const { data: history, isLoading: historyLoading } = useQuery<AuditRun[]>({
    queryKey: ['self-audit-history', selectedFramework],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedFramework !== 'all') params.set('framework', selectedFramework);
      params.set('limit', '50');
      return fetch(`/api/admin/self-audit/history?${params}`).then(r => r.json()).then(r => r.data);
    },
  });

  // Fetch frameworks
  const { data: frameworks } = useQuery<Framework[]>({
    queryKey: ['self-audit-frameworks'],
    queryFn: () => fetch('/api/admin/self-audit/frameworks').then(r => r.json()).then(r => r.data),
  });

  // Run audit mutation
  const runAuditMutation = useMutation({
    mutationFn: (framework: string) =>
      fetch('/api/admin/self-audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['self-audit-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['self-audit-history'] });
      setSelectedRun(data.data);
      setIsRunDialogOpen(false);
    },
  });

  // Fetch run details
  const fetchRunDetails = async (runId: string) => {
    const response = await fetch(`/api/admin/self-audit/runs/${runId}`);
    const data = await response.json();
    setSelectedRun(data.data);
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Self-Audit</h1>
          <p className="text-muted-foreground">
            Run compliance audits and generate regulatory reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Run Audit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run Compliance Audit</DialogTitle>
                <DialogDescription>
                  Select a framework to audit or run all frameworks at once.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {frameworks?.map(fw => (
                  <Button
                    key={fw.code}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => runAuditMutation.mutate(fw.code)}
                    disabled={runAuditMutation.isPending}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Shield className="h-5 w-5" />
                      <div className="text-left flex-1">
                        <div className="font-medium">{fw.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fw.totalChecks} checks • {fw.requiredChecks} required
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Button>
                ))}
                <Button
                  variant="default"
                  className="justify-start h-auto py-3"
                  onClick={() => runAuditMutation.mutate('all')}
                  disabled={runAuditMutation.isPending}
                >
                  <div className="flex items-center gap-3 w-full">
                    <ListChecks className="h-5 w-5" />
                    <div className="text-left flex-1">
                      <div className="font-medium">All Frameworks</div>
                      <div className="text-xs opacity-80">
                        Run complete audit across all standards
                      </div>
                    </div>
                    {runAuditMutation.isPending && (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Audit History
          </TabsTrigger>
          <TabsTrigger value="checks" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Check Registry
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Overall Pass Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard.passRate}%</div>
                    <Progress value={dashboard.passRate} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Checks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard.totalChecks}</div>
                    <p className="text-xs text-muted-foreground mt-1">Automated compliance checks</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Critical Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${dashboard.criticalIssues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {dashboard.criticalIssues}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.criticalIssues > 0 ? 'Requires immediate attention' : 'No critical issues'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Frameworks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{Object.keys(dashboard.frameworkScores).length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Active compliance frameworks</p>
                  </CardContent>
                </Card>
              </div>

              {/* Framework Scores */}
              <Card>
                <CardHeader>
                  <CardTitle>Framework Compliance Scores</CardTitle>
                  <CardDescription>Latest audit scores by regulatory framework</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(dashboard.frameworkScores).map(([code, data]) => (
                      <Card key={code} className="border-2">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{FRAMEWORK_NAMES[code] || code.toUpperCase()}</h3>
                            <div className="flex items-center gap-1">
                              {getTrendIcon(data.trend)}
                              <span className={`text-xs ${data.trend > 0 ? 'text-green-600' : data.trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {data.trend > 0 ? '+' : ''}{data.trend}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className={`text-4xl font-bold ${data.latestScore >= 80 ? 'text-green-600' : data.latestScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {data.latestScore}%
                            </span>
                          </div>
                          <Progress value={data.latestScore} className="mt-2" />
                          <p className="text-xs text-muted-foreground mt-2">
                            Last run: {formatDistanceToNow(new Date(data.latestRun), { addSuffix: true })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Runs */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Audit Runs</CardTitle>
                  <CardDescription>Latest compliance audit executions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Framework</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Checks</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.recentRuns.slice(0, 5).map(run => (
                        <TableRow key={run.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {FRAMEWORK_NAMES[run.framework] || run.framework.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(run.status)}
                              <Badge className={STATUS_COLORS[run.status]}>
                                {run.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${run.score >= 80 ? 'text-green-600' : run.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {run.score}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600">{run.passedChecks}</span>
                            {' / '}
                            <span className="text-red-600">{run.failedChecks}</span>
                            {' / '}
                            <span className="text-gray-500">{run.skippedChecks}</span>
                          </TableCell>
                          <TableCell>
                            {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(run.startedAt), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchRunDetails(run.id)}
                            >
                              Details
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="flex items-center gap-4">
            <Select value={selectedFramework} onValueChange={setSelectedFramework}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                {frameworks?.map(fw => (
                  <SelectItem key={fw.code} value={fw.code}>
                    {fw.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Framework</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.map(run => (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(run.startedAt), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {FRAMEWORK_NAMES[run.framework] || run.framework}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{run.runType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(run.status)}
                            <span>{run.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${run.score >= 80 ? 'text-green-600' : run.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {run.score}%
                          </span>
                        </TableCell>
                        <TableCell className="text-green-600">{run.passedChecks}</TableCell>
                        <TableCell className="text-red-600">{run.failedChecks}</TableCell>
                        <TableCell>{run.triggeredBy || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchRunDetails(run.id)}
                            >
                              View
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checks Registry Tab */}
        <TabsContent value="checks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Check Registry</CardTitle>
              <CardDescription>
                All automated compliance checks organized by framework
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {frameworks?.map(fw => (
                  <AccordionItem key={fw.code} value={fw.code}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5" />
                        <span className="font-semibold">{fw.name}</span>
                        <Badge variant="outline">{fw.totalChecks} checks</Badge>
                        <Badge variant="secondary">{fw.requiredChecks} required</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-8 space-y-2">
                        <div className="text-sm text-muted-foreground mb-3">
                          Categories: {fw.categories.join(', ')}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runAuditMutation.mutate(fw.code)}
                          disabled={runAuditMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Run {fw.name} Audit
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Run Details Sheet */}
      <Sheet open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
          {selectedRun && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg">
                    {FRAMEWORK_NAMES[selectedRun.run.framework] || selectedRun.run.framework}
                  </Badge>
                  <Badge className={STATUS_COLORS[selectedRun.run.status]}>
                    {selectedRun.run.status}
                  </Badge>
                </div>
                <SheetTitle>
                  Audit Run - {format(new Date(selectedRun.run.startedAt), 'MMM d, yyyy HH:mm')}
                </SheetTitle>
                <SheetDescription>
                  {selectedRun.run.triggeredBy && `Triggered by ${selectedRun.run.triggeredBy}`}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Score Overview */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-5xl font-bold ${selectedRun.run.score >= 80 ? 'text-green-600' : selectedRun.run.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {selectedRun.run.score}%
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Compliance Score</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-green-600 font-bold">{selectedRun.run.passedChecks}</span>
                            <span className="text-muted-foreground"> passed</span>
                          </div>
                          <div>
                            <span className="text-red-600 font-bold">{selectedRun.run.failedChecks}</span>
                            <span className="text-muted-foreground"> failed</span>
                          </div>
                          <div>
                            <span className="text-gray-500 font-bold">{selectedRun.run.skippedChecks}</span>
                            <span className="text-muted-foreground"> skipped</span>
                          </div>
                        </div>
                        {selectedRun.run.durationMs && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Duration: {(selectedRun.run.durationMs / 1000).toFixed(2)}s
                          </p>
                        )}
                      </div>
                    </div>
                    <Progress value={selectedRun.run.score} className="mt-4" />
                  </CardContent>
                </Card>

                {/* Critical Failures */}
                {selectedRun.criticalFailures.length > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-red-700 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Critical Failures ({selectedRun.criticalFailures.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedRun.criticalFailures.map(result => (
                          <div key={result.id} className="bg-white p-3 rounded border border-red-200">
                            <div className="flex items-start justify-between">
                              <div>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {result.checkCode}
                                </Badge>
                                <p className="font-medium mt-1">{result.checkName}</p>
                              </div>
                              <XCircle className="h-5 w-5 text-red-500" />
                            </div>
                            {result.remediation && (
                              <p className="text-sm text-muted-foreground mt-2">
                                <strong>Fix:</strong> {result.remediation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* By Category */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Results by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(selectedRun.byCategory).map(([category, stats]) => (
                        <div key={category} className="flex items-center gap-3">
                          <span className="text-sm w-40 truncate">{category}</span>
                          <Progress
                            value={(stats.passed / stats.total) * 100}
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {stats.passed}/{stats.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* All Results */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">All Check Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {selectedRun.results.map(result => (
                        <div
                          key={result.id}
                          className={`p-3 rounded border ${
                            result.status === 'passed' ? 'border-green-200 bg-green-50' :
                            result.status === 'failed' ? 'border-red-200 bg-red-50' :
                            'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(result.status)}
                              <Badge variant="outline" className="font-mono text-xs">
                                {result.checkCode}
                              </Badge>
                              {result.isRequired && (
                                <Badge variant="secondary" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <Badge className={STATUS_COLORS[result.status]}>
                              {result.status}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm mt-1">{result.checkName}</p>
                          <p className="text-xs text-muted-foreground">{result.category}</p>
                          {result.details && (
                            <p className="text-xs mt-2">{result.details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF Report
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <FileText className="h-4 w-4 mr-2" />
                    View Evidence
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
