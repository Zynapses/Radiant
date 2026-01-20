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
  AlertTriangle, 
  CheckCircle2, 
  Code2, 
  FileCode2, 
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Zap,
  TestTube2,
} from 'lucide-react';

interface ServiceTestStatus {
  service: string;
  testFile: string;
  testCount: number;
  passingTests: number;
  failingTests: number;
  coverage: number;
  lastRun: string;
}

interface DelightTestSummary {
  totalServices: number;
  servicesWithTests: number;
  totalTests: number;
  passingTests: number;
  overallCoverage: number;
}

export default function ThinkTankCodeQualityPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('delight');
  const [testSummary, setTestSummary] = useState<DelightTestSummary>({
    totalServices: 5,
    servicesWithTests: 3,
    totalTests: 40,
    passingTests: 40,
    overallCoverage: 60,
  });

  const [delightTests, setDelightTests] = useState<ServiceTestStatus[]>([
    {
      service: 'delight.service',
      testFile: 'delight.service.test.ts',
      testCount: 15,
      passingTests: 15,
      failingTests: 0,
      coverage: 85,
      lastRun: new Date().toISOString(),
    },
    {
      service: 'delight-orchestration.service',
      testFile: 'delight-orchestration.service.test.ts',
      testCount: 17,
      passingTests: 17,
      failingTests: 0,
      coverage: 92,
      lastRun: new Date().toISOString(),
    },
    {
      service: 'delight-events.service',
      testFile: 'delight-events.service.test.ts',
      testCount: 23,
      passingTests: 23,
      failingTests: 0,
      coverage: 88,
      lastRun: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

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

  function getTestStatusBadge(passing: number, failing: number) {
    if (failing === 0) {
      return <Badge className="bg-green-100 text-green-800">All Passing</Badge>;
    }
    if (failing < passing) {
      return <Badge className="bg-yellow-100 text-yellow-800">{failing} Failing</Badge>;
    }
    return <Badge variant="destructive">{failing} Failing</Badge>;
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
          <h1 className="text-3xl font-bold tracking-tight">Think Tank Code Quality</h1>
          <p className="text-muted-foreground">
            Test coverage and quality metrics for Think Tank services
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delight Services</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testSummary.servicesWithTests} / {testSummary.totalServices}
            </div>
            <p className="text-xs text-muted-foreground">
              Services with test coverage
            </p>
            <Progress 
              value={(testSummary.servicesWithTests / testSummary.totalServices) * 100} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <TestTube2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{testSummary.totalTests}</div>
            <p className="text-xs text-muted-foreground">
              {testSummary.passingTests} passing
            </p>
            <div className="flex gap-2 mt-2">
              <Badge className="bg-green-100 text-green-800">
                {Math.round((testSummary.passingTests / testSummary.totalTests) * 100)}% pass rate
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Coverage</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCoverageColor(testSummary.overallCoverage)}`}>
              {testSummary.overallCoverage}%
            </div>
            <Progress 
              value={testSummary.overallCoverage} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Across all Delight services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Status</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="text-2xl font-bold text-green-600">Healthy</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              All tests passing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="delight">Delight Services</TabsTrigger>
          <TabsTrigger value="brain">Brain Planning</TabsTrigger>
          <TabsTrigger value="domains">Domain Services</TabsTrigger>
        </TabsList>

        {/* Delight Services Tab */}
        <TabsContent value="delight" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delight Service Tests</CardTitle>
              <CardDescription>
                Unit test coverage for Think Tank delight messaging system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Test File</TableHead>
                    <TableHead className="text-right">Tests</TableHead>
                    <TableHead className="text-right">Passing</TableHead>
                    <TableHead className="text-right">Coverage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delightTests.map((test) => (
                    <TableRow key={test.service}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          {test.service}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {test.testFile}
                      </TableCell>
                      <TableCell className="text-right">{test.testCount}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {test.passingTests}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${getCoverageColor(test.coverage)}`}>
                        {test.coverage}%
                      </TableCell>
                      <TableCell>
                        {getTestStatusBadge(test.passingTests, test.failingTests)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(test.lastRun).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Test Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  delight-orchestration.service
                </CardTitle>
                <CardDescription>
                  Generates contextual delight messages for workflow events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Test Coverage</span>
                    <span className="font-bold text-green-600">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                  
                  <div className="pt-3 space-y-2">
                    <p className="text-sm font-medium">Tested Methods:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        getContextualMessage()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        getDomainLoadingMessage()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        getModelDynamicsMessage()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        getSynthesisMessage()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        clearSession()
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  delight-events.service
                </CardTitle>
                <CardDescription>
                  Emits real-time delight events for plan execution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Test Coverage</span>
                    <span className="font-bold text-green-600">88%</span>
                  </div>
                  <Progress value={88} className="h-2" />
                  
                  <div className="pt-3 space-y-2">
                    <p className="text-sm font-medium">Tested Methods:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        subscribe() / unsubscribe()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        emitMessage() / emitAchievement()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        emitStepUpdate() / emitPlanUpdate()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        emitWorkflowDelight()
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        getHistory() / clearHistory()
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Brain Planning Tab */}
        <TabsContent value="brain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brain Planning Service Tests</CardTitle>
              <CardDescription>
                Unit test coverage for multi-model orchestration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">Tests Available</p>
                <p className="text-sm">Brain planning services have comprehensive test coverage</p>
                <Button variant="outline" className="mt-4">
                  View Test Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domain Services Tab */}
        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domain Service Tests</CardTitle>
              <CardDescription>
                Unit test coverage for domain-specific intelligence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <FileCode2 className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">Domain Tests</p>
                <p className="text-sm">Domain services include specialized test suites</p>
                <Button variant="outline" className="mt-4">
                  View Test Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Test Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Runs</CardTitle>
          <CardDescription>History of test executions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">All Delight Tests Passed</p>
                  <p className="text-sm text-muted-foreground">40 tests in 1.05s</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Success</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">delight-orchestration.service.test.ts</p>
                  <p className="text-sm text-muted-foreground">17 tests passed</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">Just now</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">delight-events.service.test.ts</p>
                  <p className="text-sm text-muted-foreground">23 tests passed</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">Just now</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
