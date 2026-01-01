'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  FlaskConical,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
  Brain,
  Users,
  Database,
  Lock,
  Cpu,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: 'unit' | 'integration' | 'e2e';
  testCount: number;
  lastRun?: string;
  lastStatus?: 'passed' | 'failed' | 'running' | 'pending';
  passRate?: number;
  duration?: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface TestResult {
  id: string;
  suiteId: string;
  suiteName: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration: number;
  error?: string;
  timestamp: string;
}

interface TestRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration?: number;
  triggeredBy: string;
}

interface CoverageData {
  overall: number;
  byCategory: {
    category: string;
    coverage: number;
    files: number;
  }[];
}

const TEST_SUITES: TestSuite[] = [
  {
    id: 'user-registry',
    name: 'User Registry Service',
    description: 'User assignments, consent, DSAR, break glass, legal hold',
    category: 'unit',
    testCount: 25,
    icon: Users,
  },
  {
    id: 'db-context',
    name: 'DB Context Service',
    description: 'Secure database context, RLS, permissions, scopes',
    category: 'unit',
    testCount: 22,
    icon: Database,
  },
  {
    id: 'consciousness-middleware',
    name: 'Consciousness Middleware',
    description: 'State injection, affect mapping, hyperparameters',
    category: 'unit',
    testCount: 18,
    icon: Brain,
  },
  {
    id: 'ego-context',
    name: 'Ego Context Service',
    description: 'Persistent consciousness, identity, affect, memory',
    category: 'unit',
    testCount: 20,
    icon: Brain,
  },
  {
    id: 'security-protection',
    name: 'Security Protection',
    description: 'Prompt injection, PII, canary detection, Thompson sampling',
    category: 'unit',
    testCount: 28,
    icon: Shield,
  },
  {
    id: 'agi-brain-planner',
    name: 'AGI Brain Planner',
    description: 'Plan generation, orchestration modes, step execution',
    category: 'unit',
    testCount: 24,
    icon: Cpu,
  },
  {
    id: 'admin-api-integration',
    name: 'Admin API Integration',
    description: 'Full request/response flow for admin endpoints',
    category: 'integration',
    testCount: 35,
    icon: Lock,
  },
  {
    id: 'auth-flow-integration',
    name: 'Authentication Flow',
    description: 'Cognito, pre-token, permissions, break glass',
    category: 'integration',
    testCount: 30,
    icon: Lock,
  },
];

export function QAClient() {
  const [suites, setSuites] = useState<TestSuite[]>(TEST_SUITES);
  const [results, setResults] = useState<TestResult[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('suites');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/qa/dashboard');
      if (response.ok) {
        const data = await response.json();
        setSuites(data.suites || TEST_SUITES);
        setResults(data.recentResults || []);
        setRuns(data.recentRuns || []);
        setCoverage(data.coverage || null);
      }
    } catch (error) {
      console.error('Failed to fetch QA data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runTests = async (suiteId?: string) => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/admin/qa/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Test Run Started',
          description: suiteId 
            ? `Running ${suiteId} test suite...` 
            : 'Running all test suites...',
        });
        
        // Poll for results
        pollTestRun(data.runId);
      } else {
        throw new Error('Failed to start test run');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start test run',
        variant: 'destructive',
      });
      setIsRunning(false);
    }
  };

  const pollTestRun = async (runId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/qa/runs/${runId}`);
        if (response.ok) {
          const run = await response.json();
          
          if (run.status === 'completed' || run.status === 'failed') {
            setIsRunning(false);
            fetchData();
            toast({
              title: run.status === 'completed' ? 'Tests Completed' : 'Tests Failed',
              description: `${run.passed} passed, ${run.failed} failed, ${run.skipped} skipped`,
              variant: run.failed > 0 ? 'destructive' : 'default',
            });
          } else {
            setTimeout(poll, 2000);
          }
        }
      } catch (error) {
        console.error('Failed to poll test run:', error);
        setIsRunning(false);
      }
    };
    
    poll();
  };

  const toggleSuiteExpanded = (suiteId: string) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Passed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case 'skipped':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Skipped</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'unit':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Unit</Badge>;
      case 'integration':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Integration</Badge>;
      case 'e2e':
        return <Badge variant="outline" className="bg-green-50 text-green-700">E2E</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const totalTests = suites.reduce((sum, s) => sum + s.testCount, 0);
  const passedSuites = suites.filter(s => s.lastStatus === 'passed').length;
  const failedSuites = suites.filter(s => s.lastStatus === 'failed').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            QA & Testing
          </h1>
          <p className="text-muted-foreground">
            Manage automated tests, view results, and monitor test coverage
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isRunning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => runTests()} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run All Tests
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Test Suites</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suites.length}</div>
            <p className="text-xs text-muted-foreground">
              {totalTests} total tests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedSuites}</div>
            <p className="text-xs text-muted-foreground">
              {suites.length > 0 ? Math.round((passedSuites / suites.length) * 100) : 0}% of suites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedSuites}</div>
            <p className="text-xs text-muted-foreground">
              {failedSuites > 0 ? 'Needs attention' : 'All passing'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coverage?.overall || 0}%</div>
            <Progress value={coverage?.overall || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
          <TabsTrigger value="results">Recent Results</TabsTrigger>
          <TabsTrigger value="runs">Test Runs</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
        </TabsList>

        {/* Test Suites Tab */}
        <TabsContent value="suites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Suites</CardTitle>
              <CardDescription>
                All available test suites organized by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['unit', 'integration', 'e2e'].map(category => {
                  const categorySuites = suites.filter(s => s.category === category);
                  if (categorySuites.length === 0) return null;
                  
                  return (
                    <div key={category}>
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                        {category === 'e2e' ? 'End-to-End' : category.charAt(0).toUpperCase() + category.slice(1)} Tests
                      </h3>
                      <div className="space-y-2">
                        {categorySuites.map(suite => {
                          const Icon = suite.icon;
                          const isExpanded = expandedSuites.has(suite.id);
                          
                          return (
                            <div key={suite.id} className="border rounded-lg">
                              <div 
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSuiteExpanded(suite.id)}
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Icon className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">{suite.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {suite.description}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-muted-foreground">
                                    {suite.testCount} tests
                                  </span>
                                  {getCategoryBadge(suite.category)}
                                  {suite.lastStatus && getStatusBadge(suite.lastStatus)}
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      runTests(suite.id);
                                    }}
                                    disabled={isRunning}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Run
                                  </Button>
                                </div>
                              </div>
                              
                              {isExpanded && (
                                <div className="border-t p-4 bg-muted/30">
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Last Run:</span>
                                      <span className="ml-2 font-medium">
                                        {suite.lastRun || 'Never'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Pass Rate:</span>
                                      <span className="ml-2 font-medium">
                                        {suite.passRate !== undefined ? `${suite.passRate}%` : 'N/A'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Duration:</span>
                                      <span className="ml-2 font-medium">
                                        {suite.duration !== undefined ? `${suite.duration}ms` : 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Test Results</CardTitle>
                  <CardDescription>
                    Individual test results from recent runs
                  </CardDescription>
                </div>
                <Select value={selectedSuite || 'all'} onValueChange={(v) => setSelectedSuite(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by suite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suites</SelectItem>
                    {suites.map(suite => (
                      <SelectItem key={suite.id} value={suite.id}>{suite.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Name</TableHead>
                      <TableHead>Suite</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results
                      .filter(r => !selectedSuite || r.suiteId === selectedSuite)
                      .map(result => (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium">{result.testName}</TableCell>
                          <TableCell>{result.suiteName}</TableCell>
                          <TableCell>{getStatusBadge(result.status)}</TableCell>
                          <TableCell>{result.duration}ms</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(result.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    {results.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No test results yet. Run tests to see results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Run History</CardTitle>
              <CardDescription>
                History of all test runs and their outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Passed</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Triggered By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(run => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-sm">{run.id.slice(0, 8)}...</TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell>{run.totalTests}</TableCell>
                      <TableCell className="text-green-600">{run.passed}</TableCell>
                      <TableCell className="text-red-600">{run.failed}</TableCell>
                      <TableCell className="text-muted-foreground">{run.skipped}</TableCell>
                      <TableCell>{run.duration ? `${run.duration}ms` : '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{run.triggeredBy}</TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No test runs yet. Click &quot;Run All Tests&quot; to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Coverage</CardTitle>
              <CardDescription>
                Code coverage metrics by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coverage ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold">{coverage.overall}%</div>
                    <div className="flex-1">
                      <Progress value={coverage.overall} className="h-4" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {coverage.byCategory.map(cat => (
                      <div key={cat.category} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cat.category}</span>
                          <span className="text-muted-foreground">
                            {cat.coverage}% ({cat.files} files)
                          </span>
                        </div>
                        <Progress value={cat.coverage} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run tests with coverage to see metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
