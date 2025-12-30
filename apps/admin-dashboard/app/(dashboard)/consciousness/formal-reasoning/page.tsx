'use client';

/**
 * Formal Reasoning Admin Dashboard
 * 
 * Admin interface for managing the 8 formal reasoning libraries integrated
 * with the consciousness engine. Provides configuration, monitoring,
 * testing, and cost tracking capabilities.
 * 
 * Libraries:
 * 1. Z3 Theorem Prover - SMT solving, constraint verification
 * 2. PyArg - Structured argumentation semantics
 * 3. PyReason - Temporal graph reasoning
 * 4. RDFLib - Semantic web stack, SPARQL
 * 5. OWL-RL - Ontological inference
 * 6. pySHACL - Graph constraint validation
 * 7. Logic Tensor Networks - Differentiable FOL
 * 8. DeepProbLog - Probabilistic logic programming
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Zap,
  Brain,
  Network,
  GitBranch,
  Database,
  Shield,
  Cpu,
  BarChart3,
  Settings,
  Play,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

// Types
interface LibraryInfo {
  id: string;
  name: string;
  version: string;
  license: string;
  description: string;
  capabilities: string[];
  useCases: string[];
  limitations: string[];
  costPerInvocation: number;
  averageLatencyMs: number;
  enabled: boolean;
}

interface LibraryHealth {
  library: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  errorRate24h: number;
  averageLatency24h: number;
  lastSuccessfulInvocation?: string;
  lastError?: string;
}

interface InvocationLog {
  id: string;
  library: string;
  taskType: string;
  status: string;
  computeTimeMs: number;
  costUsd: number;
  createdAt: string;
  error?: string;
}

interface DashboardData {
  config: {
    enabled: boolean;
    enabledLibraries: string[];
    budgetLimits: {
      dailyInvocations: number;
      dailyCostUsd: number;
      monthlyInvocations: number;
      monthlyCostUsd: number;
    };
  };
  stats: {
    totalInvocations: number;
    totalSuccessful: number;
    totalFailed: number;
    totalCostUsd: number;
  };
  recentInvocations: InvocationLog[];
  libraryHealth: Record<string, LibraryHealth>;
  budgetUsage: {
    daily: { invocations: number; costUsd: number; percentUsed: number };
    monthly: { invocations: number; costUsd: number; percentUsed: number };
  };
}

// Library icons
const LIBRARY_ICONS: Record<string, React.ReactNode> = {
  z3: <Zap className="h-5 w-5" />,
  pyarg: <GitBranch className="h-5 w-5" />,
  pyreason: <Clock className="h-5 w-5" />,
  rdflib: <Database className="h-5 w-5" />,
  owlrl: <Network className="h-5 w-5" />,
  pyshacl: <Shield className="h-5 w-5" />,
  ltn: <Brain className="h-5 w-5" />,
  deepproblog: <Cpu className="h-5 w-5" />,
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unavailable: 'bg-red-500',
  sat: 'bg-green-500',
  unsat: 'bg-orange-500',
  valid: 'bg-green-500',
  invalid: 'bg-red-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  conforms: 'bg-green-500',
  violation: 'bg-red-500',
  inferred: 'bg-blue-500',
  error: 'bg-red-500',
  unknown: 'bg-gray-500',
};

export default function FormalReasoningPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Test inputs
  const [z3Expression, setZ3Expression] = useState('(declare-const x Int)\n(assert (> x 0))\n(assert (< x 10))\n(check-sat)');
  const [sparqlQuery, setSparqlQuery] = useState('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10');
  const [beliefClaim, setBeliefClaim] = useState('');
  const [beliefConfidence, setBeliefConfidence] = useState(0.8);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const [dashboardRes, librariesRes] = await Promise.all([
        fetch('/api/admin/formal-reasoning/dashboard'),
        fetch('/api/admin/formal-reasoning/libraries'),
      ]);

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setDashboard(data);
      }

      if (librariesRes.ok) {
        const data = await librariesRes.json();
        setLibraries(data.libraries || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Toggle library
  const toggleLibrary = async (libraryId: string, enabled: boolean) => {
    if (!dashboard) return;

    const newEnabledLibraries = enabled
      ? [...dashboard.config.enabledLibraries, libraryId]
      : dashboard.config.enabledLibraries.filter(l => l !== libraryId);

    await fetch('/api/admin/formal-reasoning/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabledLibraries: newEnabledLibraries }),
    });

    fetchDashboard();
  };

  // Test Z3
  const testZ3 = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/admin/formal-reasoning/test/z3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          constraints: [{
            expression: z3Expression,
            variables: [{ name: 'x', type: 'Int' }],
          }],
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: String(error) });
    } finally {
      setTestLoading(false);
    }
  };

  // Test SPARQL
  const testSparql = async () => {
    setTestLoading(true);
    try {
      const res = await fetch('/api/admin/formal-reasoning/test/sparql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sparqlQuery }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: String(error) });
    } finally {
      setTestLoading(false);
    }
  };

  // Add belief
  const addBelief = async () => {
    if (!beliefClaim) return;
    setTestLoading(true);
    try {
      const res = await fetch('/api/admin/formal-reasoning/beliefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: beliefClaim,
          confidence: beliefConfidence,
          verify: true,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      setBeliefClaim('');
    } catch (error) {
      setTestResult({ error: String(error) });
    } finally {
      setTestLoading(false);
    }
  };

  // Update budget
  const updateBudget = async (field: string, value: number) => {
    await fetch('/api/admin/formal-reasoning/budget', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    fetchDashboard();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formal Reasoning</h1>
          <p className="text-muted-foreground">
            8 libraries for verified reasoning, constraint satisfaction, and symbolic AI
          </p>
        </div>
        <Button onClick={fetchDashboard} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invocations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.stats.totalInvocations.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.stats.totalSuccessful || 0} successful, {dashboard?.stats.totalFailed || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${dashboard?.stats.totalCostUsd.toFixed(4) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Today: ${dashboard?.budgetUsage.daily.costUsd.toFixed(4) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Budget</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.budgetUsage.daily.percentUsed.toFixed(1) || 0}%
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min(dashboard?.budgetUsage.daily.percentUsed || 0, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Libraries</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.config.enabledLibraries.length || 0} / 8
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.values(dashboard?.libraryHealth || {}).filter(h => h.status === 'healthy').length} healthy
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="libraries">Libraries</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="beliefs">Beliefs</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Library Health Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Library Health</CardTitle>
              <CardDescription>Real-time status of all formal reasoning libraries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {libraries.map((lib) => {
                  const health = dashboard?.libraryHealth[lib.id];
                  const isEnabled = dashboard?.config.enabledLibraries.includes(lib.id);
                  
                  return (
                    <div
                      key={lib.id}
                      className={`p-4 rounded-lg border ${
                        !isEnabled ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {LIBRARY_ICONS[lib.id]}
                          <span className="font-medium">{lib.name}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${STATUS_COLORS[health?.status || 'unknown']} text-white`}
                        >
                          {health?.status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>v{lib.version}</div>
                        <div>Latency: {health?.averageLatency24h?.toFixed(0) || lib.averageLatencyMs}ms</div>
                        <div>Error rate: {((health?.errorRate24h || 0) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Invocations */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Invocations</CardTitle>
              <CardDescription>Last 20 formal reasoning operations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Library</TableHead>
                    <TableHead>Task Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.recentInvocations || []).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {LIBRARY_ICONS[inv.library]}
                          <span className="capitalize">{inv.library}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {inv.taskType.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${STATUS_COLORS[inv.status]} text-white`}
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{inv.computeTimeMs}ms</TableCell>
                      <TableCell>${inv.costUsd.toFixed(6)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard?.recentInvocations || dashboard.recentInvocations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No invocations yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Libraries Tab */}
        <TabsContent value="libraries" className="space-y-4">
          {libraries.map((lib) => {
            const isEnabled = dashboard?.config.enabledLibraries.includes(lib.id);
            
            return (
              <Card key={lib.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {LIBRARY_ICONS[lib.id]}
                      <div>
                        <CardTitle>{lib.name}</CardTitle>
                        <CardDescription>v{lib.version} • {lib.license}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => toggleLibrary(lib.id, checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{lib.description}</p>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Capabilities
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {lib.capabilities.slice(0, 5).map((cap, i) => (
                          <li key={i}>• {cap}</li>
                        ))}
                        {lib.capabilities.length > 5 && (
                          <li className="text-xs">+{lib.capabilities.length - 5} more</li>
                        )}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        Use Cases
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {lib.useCases.map((use, i) => (
                          <li key={i}>• {use}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Limitations
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {lib.limitations.map((lim, i) => (
                          <li key={i}>• {lim}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span>${lib.costPerInvocation.toFixed(5)}/call</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{lib.averageLatencyMs}ms avg</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Z3 Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Z3 Theorem Prover
                </CardTitle>
                <CardDescription>Test SMT constraint solving</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SMT-LIB2 Expression</Label>
                  <Textarea
                    value={z3Expression}
                    onChange={(e) => setZ3Expression(e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
                <Button onClick={testZ3} disabled={testLoading}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Z3
                </Button>
              </CardContent>
            </Card>

            {/* SPARQL Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  RDFLib SPARQL
                </CardTitle>
                <CardDescription>Test SPARQL queries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SPARQL Query</Label>
                  <Textarea
                    value={sparqlQuery}
                    onChange={(e) => setSparqlQuery(e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
                <Button onClick={testSparql} disabled={testLoading}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Query
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Test Result */}
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle>Test Result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-96">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Beliefs Tab */}
        <TabsContent value="beliefs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Verified Belief</CardTitle>
              <CardDescription>
                Add a belief to the consciousness and optionally verify it using Z3
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Claim</Label>
                <Textarea
                  value={beliefClaim}
                  onChange={(e) => setBeliefClaim(e.target.value)}
                  placeholder="Enter a claim to be verified..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Confidence: {beliefConfidence.toFixed(2)}</Label>
                <Slider
                  value={[beliefConfidence]}
                  onValueChange={([v]) => setBeliefConfidence(v)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
              <Button onClick={addBelief} disabled={testLoading || !beliefClaim}>
                <Brain className="h-4 w-4 mr-2" />
                Add & Verify Belief
              </Button>
            </CardContent>
          </Card>

          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle>Verification Result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Invocations</span>
                  <span className="font-mono">
                    {dashboard?.budgetUsage.daily.invocations.toLocaleString()} / {dashboard?.config.budgetLimits.dailyInvocations.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cost</span>
                  <span className="font-mono">
                    ${dashboard?.budgetUsage.daily.costUsd.toFixed(4)} / ${dashboard?.config.budgetLimits.dailyCostUsd.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      (dashboard?.budgetUsage.daily.percentUsed || 0) > 90
                        ? 'bg-red-500'
                        : (dashboard?.budgetUsage.daily.percentUsed || 0) > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(dashboard?.budgetUsage.daily.percentUsed || 0, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Invocations</span>
                  <span className="font-mono">
                    {dashboard?.budgetUsage.monthly.invocations.toLocaleString()} / {dashboard?.config.budgetLimits.monthlyInvocations.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cost</span>
                  <span className="font-mono">
                    ${dashboard?.budgetUsage.monthly.costUsd.toFixed(4)} / ${dashboard?.config.budgetLimits.monthlyCostUsd.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      (dashboard?.budgetUsage.monthly.percentUsed || 0) > 90
                        ? 'bg-red-500'
                        : (dashboard?.budgetUsage.monthly.percentUsed || 0) > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(dashboard?.budgetUsage.monthly.percentUsed || 0, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost by Library</CardTitle>
              <CardDescription>Estimated cost per invocation</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Library</TableHead>
                    <TableHead>Cost/Invocation</TableHead>
                    <TableHead>Avg Latency</TableHead>
                    <TableHead>Use Case</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {libraries.map((lib) => (
                    <TableRow key={lib.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {LIBRARY_ICONS[lib.id]}
                          <span>{lib.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        ${lib.costPerInvocation.toFixed(5)}
                      </TableCell>
                      <TableCell>{lib.averageLatencyMs}ms</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lib.useCases[0]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget Limits</CardTitle>
              <CardDescription>Configure spending limits for formal reasoning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Daily Invocation Limit</Label>
                  <Input
                    type="number"
                    value={dashboard?.config.budgetLimits.dailyInvocations || 10000}
                    onChange={(e) => updateBudget('dailyInvocations', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily Cost Limit ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dashboard?.config.budgetLimits.dailyCostUsd || 10}
                    onChange={(e) => updateBudget('dailyCostUsd', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Invocation Limit</Label>
                  <Input
                    type="number"
                    value={dashboard?.config.budgetLimits.monthlyInvocations || 100000}
                    onChange={(e) => updateBudget('monthlyInvocations', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Cost Limit ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dashboard?.config.budgetLimits.monthlyCostUsd || 100}
                    onChange={(e) => updateBudget('monthlyCostUsd', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Formal Reasoning Enabled</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable/disable all formal reasoning capabilities
                  </p>
                </div>
                <Switch
                  checked={dashboard?.config.enabled || false}
                  onCheckedChange={async (checked) => {
                    await fetch('/api/admin/formal-reasoning/config', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: checked }),
                    });
                    fetchDashboard();
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
