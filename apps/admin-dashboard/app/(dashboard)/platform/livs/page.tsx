'use client';

/**
 * LIVS Admin Dashboard Page
 * 
 * LLM Integrity Verification System management:
 * - Configuration toggles
 * - Soft rules management
 * - Model integrity analytics
 * - Interrogation history
 * - Pipeline audit viewer
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Settings,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  BarChart3,
  Brain,
  Workflow,
  FileText,
  Zap,
} from 'lucide-react';

interface LIVSDashboard {
  config: {
    enabled: boolean;
    tier1Enabled: boolean;
    tier2Enabled: boolean;
    costMode: string;
  };
  interrogationMetrics: {
    total24h: number;
    total7d: number;
    total30d: number;
    liesDetected24h: number;
    liesDetected7d: number;
    liesDetected30d: number;
    averageLieRate: number;
  };
  topLyingModels: { modelId: string; lieRate: number; sampleSize: number }[];
  topReliableModels: { modelId: string; lieRate: number; sampleSize: number }[];
  orchestrationMetrics: {
    pipelinesAudited24h: number;
    failurePatternsDetected24h: number;
    averageIntegrityScore: number;
  };
  activeSoftRules: number;
  recentInterrogations: {
    id: string;
    modelId: string;
    verdict: string;
    timestamp: string;
  }[];
}

interface SoftRule {
  id: string;
  name: string;
  description?: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  priority: number;
  createdByType: string;
  active: boolean;
}

const verdictColors: Record<string, string> = {
  trusted: 'bg-green-500',
  suspicious: 'bg-yellow-500',
  likely_lie: 'bg-orange-500',
  confirmed_lie: 'bg-red-500',
};

const verdictIcons: Record<string, React.ReactNode> = {
  trusted: <CheckCircle className="h-4 w-4 text-green-500" />,
  suspicious: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  likely_lie: <ShieldAlert className="h-4 w-4 text-orange-500" />,
  confirmed_lie: <XCircle className="h-4 w-4 text-red-500" />,
};

export default function LIVSPage() {
  const [dashboard, setDashboard] = useState<LIVSDashboard | null>(null);
  const [rules, setRules] = useState<SoftRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const { toast } = useToast();

  // Configuration state
  const [config, setConfig] = useState({
    enabled: true,
    individualInterrogation: {
      enabled: true,
      defaultDepth: 1,
      autoEscalate: true,
    },
    orchestrationIntegrity: {
      enabled: true,
      preActionInterrogation: true,
    },
    costMode: 'balanced',
  });

  // New rule state
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    conditions: '{}',
    actions: '{}',
    priority: 0,
  });

  useEffect(() => {
    fetchDashboard();
    fetchRules();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/livs/dashboard');
      const data = await res.json();
      setDashboard(data.dashboard);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/admin/livs/rules');
      const data = await res.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/livs/config');
      const data = await res.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await fetch('/api/admin/livs/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      toast({
        title: 'Success',
        description: 'Configuration saved',
      });
      setConfigOpen(false);
      fetchDashboard();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  const createRule = async () => {
    try {
      await fetch('/api/admin/livs/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          description: newRule.description,
          conditions: JSON.parse(newRule.conditions),
          actions: JSON.parse(newRule.actions),
          priority: newRule.priority,
        }),
      });
      toast({
        title: 'Success',
        description: 'Rule created',
      });
      setNewRuleOpen(false);
      setNewRule({ name: '', description: '', conditions: '{}', actions: '{}', priority: 0 });
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create rule',
        variant: 'destructive',
      });
    }
  };

  const toggleRule = async (ruleId: string) => {
    try {
      await fetch(`/api/admin/livs/rules/${ruleId}/toggle`, { method: 'POST' });
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle rule',
        variant: 'destructive',
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await fetch(`/api/admin/livs/rules/${ruleId}`, { method: 'DELETE' });
      toast({
        title: 'Success',
        description: 'Rule deleted',
      });
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            LLM Integrity Verification System
          </h1>
          <p className="text-muted-foreground">
            Two-tier defense against AI &quot;lying&quot; behaviors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button onClick={fetchConfig}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>LIVS Configuration</DialogTitle>
                <DialogDescription>
                  Configure integrity verification settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>LIVS Enabled</Label>
                    <p className="text-sm text-muted-foreground">
                      Master toggle for integrity verification
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, enabled: checked })
                    }
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Tier 1: Individual Interrogation</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Enabled</Label>
                      <Switch
                        checked={config.individualInterrogation.enabled}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            individualInterrogation: {
                              ...config.individualInterrogation,
                              enabled: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Default Depth</Label>
                      <Select
                        value={String(config.individualInterrogation.defaultDepth)}
                        onValueChange={(v) =>
                          setConfig({
                            ...config,
                            individualInterrogation: {
                              ...config.individualInterrogation,
                              defaultDepth: parseInt(v),
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          <SelectItem value="1">Spot Check</SelectItem>
                          <SelectItem value="2">Moderate</SelectItem>
                          <SelectItem value="3">Thorough</SelectItem>
                          <SelectItem value="4">Forensic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-Escalate</Label>
                      <Switch
                        checked={config.individualInterrogation.autoEscalate}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            individualInterrogation: {
                              ...config.individualInterrogation,
                              autoEscalate: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Tier 2: Orchestration Integrity</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Enabled</Label>
                      <Switch
                        checked={config.orchestrationIntegrity.enabled}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            orchestrationIntegrity: {
                              ...config.orchestrationIntegrity,
                              enabled: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Pre-Action Interrogation</Label>
                      <Switch
                        checked={config.orchestrationIntegrity.preActionInterrogation}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            orchestrationIntegrity: {
                              ...config.orchestrationIntegrity,
                              preActionInterrogation: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Cost Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Balance between cost and thoroughness
                      </p>
                    </div>
                    <Select
                      value={config.costMode}
                      onValueChange={(v) => setConfig({ ...config, costMode: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="thorough">Thorough</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveConfig}>Save Configuration</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={dashboard?.config.enabled ? 'border-green-500' : 'border-yellow-500'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {dashboard?.config.enabled ? (
                <ShieldCheck className="h-6 w-6 text-green-500" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-yellow-500" />
              )}
              <div>
                <p className="font-medium">
                  {dashboard?.config.enabled ? 'LIVS Active' : 'LIVS Disabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tier 1: {dashboard?.config.tier1Enabled ? 'ON' : 'OFF'} |{' '}
                  Tier 2: {dashboard?.config.tier2Enabled ? 'ON' : 'OFF'} |{' '}
                  Mode: {dashboard?.config.costMode}
                </p>
              </div>
            </div>
            <Badge variant={dashboard?.config.enabled ? 'default' : 'secondary'}>
              {dashboard?.activeSoftRules} Active Rules
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Interrogations (24h)
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.interrogationMetrics.total24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.interrogationMetrics.liesDetected24h || 0} lies detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Lie Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.interrogationMetrics.averageLieRate || 0) * 100).toFixed(1)}%
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {(dashboard?.interrogationMetrics.averageLieRate || 0) > 0.1 ? (
                <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
              )}
              Across all models
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pipelines Audited (24h)
            </CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.orchestrationMetrics.pipelinesAudited24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.orchestrationMetrics.failurePatternsDetected24h || 0} issues found
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrity Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.orchestrationMetrics.averageIntegrityScore || 0) * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">Average pipeline score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">
            <Brain className="h-4 w-4 mr-2" />
            Model Integrity
          </TabsTrigger>
          <TabsTrigger value="rules">
            <FileText className="h-4 w-4 mr-2" />
            Soft Rules
          </TabsTrigger>
          <TabsTrigger value="history">
            <Search className="h-4 w-4 mr-2" />
            Interrogation History
          </TabsTrigger>
        </TabsList>

        {/* Model Integrity Tab */}
        <TabsContent value="models" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-500" />
                  Top Lying Models
                </CardTitle>
                <CardDescription>Models with highest lie detection rates</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Lie Rate</TableHead>
                      <TableHead>Samples</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.topLyingModels.map((model) => (
                      <TableRow key={model.modelId}>
                        <TableCell className="font-mono text-sm">
                          {model.modelId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {(model.lieRate * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{model.sampleSize}</TableCell>
                      </TableRow>
                    ))}
                    {(!dashboard?.topLyingModels || dashboard.topLyingModels.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No data yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-green-500" />
                  Most Reliable Models
                </CardTitle>
                <CardDescription>Models with lowest lie detection rates</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Lie Rate</TableHead>
                      <TableHead>Samples</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.topReliableModels.map((model) => (
                      <TableRow key={model.modelId}>
                        <TableCell className="font-mono text-sm">
                          {model.modelId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600">
                            {(model.lieRate * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{model.sampleSize}</TableCell>
                      </TableRow>
                    ))}
                    {(!dashboard?.topReliableModels || dashboard.topReliableModels.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No data yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Soft Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Soft Rules</CardTitle>
                <CardDescription>
                  Configurable integrity rules for specific domains, models, or query types
                </CardDescription>
              </div>
              <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Soft Rule</DialogTitle>
                    <DialogDescription>
                      Define conditions and actions for integrity verification
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="Medical Domain Verification"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newRule.description}
                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                        placeholder="Deep interrogation for medical queries"
                      />
                    </div>
                    <div>
                      <Label>Conditions (JSON)</Label>
                      <Textarea
                        value={newRule.conditions}
                        onChange={(e) => setNewRule({ ...newRule, conditions: e.target.value })}
                        placeholder='{"queryTypes": ["medical"], "domains": ["healthcare"]}'
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label>Actions (JSON)</Label>
                      <Textarea
                        value={newRule.actions}
                        onChange={(e) => setNewRule({ ...newRule, actions: e.target.value })}
                        placeholder='{"forceInterrogationDepth": 3, "requireEvidenceCitation": true}'
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        value={newRule.priority}
                        onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewRuleOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createRule}>Create Rule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.createdByType}</Badge>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.active}
                          onCheckedChange={() => toggleRule(rule.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {rule.createdByType !== 'system' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No soft rules configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interrogation History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Interrogations</CardTitle>
              <CardDescription>Latest LLM integrity checks</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.recentInterrogations.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.modelId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {verdictIcons[item.verdict]}
                          <span className="capitalize">{item.verdict.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard?.recentInterrogations ||
                    dashboard.recentInterrogations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No interrogations yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
