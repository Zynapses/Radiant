'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api/client';
import {
  Code,
  Shield,
  Package,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DashboardData {
  metrics: {
    totalGenerated: number;
    successRate: number;
    averageGenerationTime: number;
    reflexionRate: number;
    totalTokens: number;
    totalCost: number;
    topIntents: Array<{ intent: string; count: number }>;
    recentSessions: Array<{
      id: string;
      prompt: string;
      intent: string;
      status: string;
      reflexion_attempts: number;
      created_at: string;
    }>;
  };
  patterns: Array<{
    id: string;
    pattern_name: string;
    pattern_type: string;
    description: string | null;
    usage_count: number;
    success_rate: number;
  }>;
  validationRules: Array<{
    id: string;
    rule_name: string;
    rule_type: string;
    severity: string;
    is_active: boolean;
  }>;
  allowlist: Array<{
    package_name: string;
    security_reviewed: boolean;
  }>;
}

export default function ArtifactEnginePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [newPackage, setNewPackage] = useState({ name: '', reason: '' });
  const [showAddPackage, setShowAddPackage] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await api.get<DashboardData>('/api/admin/artifact-engine/dashboard');
      setDashboard(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      await api.put(`/api/admin/artifact-engine/validation-rules/${ruleId}`, {
        is_active: !currentActive,
      });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleAddPackage = async () => {
    if (!newPackage.name) return;
    try {
      await api.post('/api/admin/artifact-engine/allowlist', {
        package_name: newPackage.name,
        reason: newPackage.reason,
      });
      setNewPackage({ name: '', reason: '' });
      setShowAddPackage(false);
      fetchDashboard();
    } catch (err) {
      console.error('Failed to add package:', err);
    }
  };

  const handleRemovePackage = async (packageName: string) => {
    try {
      await api.delete(`/api/admin/artifact-engine/allowlist/${encodeURIComponent(packageName)}`);
      fetchDashboard();
    } catch (err) {
      console.error('Failed to remove package:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>Error loading dashboard: {error}</p>
        <Button onClick={fetchDashboard} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Code className="w-8 h-8" />
            Artifact Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            GenUI pipeline for generating React/TypeScript components with Cato safety validation
          </p>
        </div>
        <Button onClick={fetchDashboard} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.metrics.totalGenerated}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {(dashboard.metrics.successRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Passed validation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Generation Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboard.metrics.averageGenerationTime / 1000).toFixed(1)}s
            </div>
            <p className="text-xs text-muted-foreground">End-to-end</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reflexion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboard.metrics.reflexionRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Needed re-attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            <Activity className="w-4 h-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="validation">
            <Shield className="w-4 h-4 mr-2" />
            Validation Rules
          </TabsTrigger>
          <TabsTrigger value="allowlist">
            <Package className="w-4 h-4 mr-2" />
            Allowlist
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <TrendingUp className="w-4 h-4 mr-2" />
            Patterns
          </TabsTrigger>
        </TabsList>

        {/* Recent Sessions */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                Latest artifact generation sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prompt</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reflexion</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.metrics.recentSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="max-w-[300px] truncate">
                        {session.prompt}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.intent}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={session.status} />
                      </TableCell>
                      <TableCell>{session.reflexion_attempts}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSession(session.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validation Rules */}
        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle>Validation Rules</CardTitle>
              <CardDescription>
                Cato safety validation rules for generated artifacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.validationRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-sm">{rule.rule_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.rule_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={rule.severity} />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggleRule(rule.id, rule.is_active)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependency Allowlist */}
        <TabsContent value="allowlist">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dependency Allowlist</CardTitle>
                <CardDescription>
                  Only these npm packages can be imported in generated artifacts
                </CardDescription>
              </div>
              <Dialog open={showAddPackage} onOpenChange={setShowAddPackage}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Package
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Package to Allowlist</DialogTitle>
                    <DialogDescription>
                      Add a new npm package that can be used in generated artifacts
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="package-name">Package Name</Label>
                      <Input
                        id="package-name"
                        placeholder="e.g., lodash"
                        value={newPackage.name}
                        onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="package-reason">Reason</Label>
                      <Input
                        id="package-reason"
                        placeholder="Why is this package needed?"
                        value={newPackage.reason}
                        onChange={(e) => setNewPackage({ ...newPackage, reason: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddPackage(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddPackage}>Add Package</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {dashboard.allowlist.map((pkg) => (
                    <div
                      key={pkg.package_name}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {pkg.security_reviewed ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="font-mono text-sm">{pkg.package_name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePackage(pkg.package_name)}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Patterns */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <CardTitle>Code Patterns</CardTitle>
              <CardDescription>
                Templates and patterns used to improve generation quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Success Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.patterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell>{pattern.pattern_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pattern.pattern_type}</Badge>
                      </TableCell>
                      <TableCell>{pattern.usage_count}</TableCell>
                      <TableCell>
                        <span
                          className={
                            pattern.success_rate >= 0.8
                              ? 'text-green-500'
                              : pattern.success_rate >= 0.5
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          }
                        >
                          {(pattern.success_rate * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case 'failed':
    case 'rejected':
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          {status}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <RefreshCw className="w-3 h-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'block':
      return <Badge variant="destructive">Block</Badge>;
    case 'warn':
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">
          Warn
        </Badge>
      );
    case 'log':
      return <Badge variant="outline">Log</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}
