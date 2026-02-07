'use client';

/**
 * Cognitive Precision Protocols Admin Page
 * v7.10.0 - Context Anchor Gate, Negative Constraints, Critic Model Separation
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Anchor,
  Shield,
  Brain,
  Settings,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  BarChart3,
  Eye,
  Layers,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';

interface CognitivePrecisionConfig {
  context_anchor_enabled: boolean;
  context_anchor_min_confidence: number;
  context_anchor_allow_override: boolean;
  context_anchor_max_clarifying_questions: number;
  constraint_injection_enabled: boolean;
  constraint_max_per_request: number;
  constraint_include_system_defaults: boolean;
  critic_enabled: boolean;
  critic_model_id: string;
  screening_model_id: string;
  critic_temperature: number;
  tiered_escalation_enabled: boolean;
  screening_escalation_threshold: number;
  ensemble_enabled: boolean;
  ensemble_critic_models: string[];
  ensemble_voting_strategy: 'majority' | 'unanimous' | 'weighted';
  isolation_enabled: boolean;
  isolation_level: 'none' | 'partial' | 'full';
  apply_critic_constraints: boolean;
  max_critic_retries: number;
  track_performance: boolean;
}

interface NegativeConstraint {
  id: string;
  constraint_text: string;
  task_types: string[];
  category: string;
  severity: string;
  is_active: boolean;
  is_system_default: boolean;
  created_at: string;
}

interface AnchorStats {
  gate_action: string;
  count: number;
  avg_confidence: number;
  avg_constraints: number;
}

interface CriticMetrics {
  total_invocations: number;
  avg_escalation_rate: number;
  lie_detection_rate: number;
}

interface Dashboard {
  config: CognitivePrecisionConfig | null;
  anchorStats: AnchorStats[];
  customConstraintCount: number;
  criticMetrics: CriticMetrics;
}

const TASK_TYPES = [
  'code_generation',
  'analysis',
  'explanation',
  'creative',
  'unknown',
];

const CONSTRAINT_CATEGORIES = [
  { value: 'content', label: 'Content', color: 'bg-blue-500' },
  { value: 'behavior', label: 'Behavior', color: 'bg-purple-500' },
  { value: 'format', label: 'Format', color: 'bg-green-500' },
  { value: 'safety', label: 'Safety', color: 'bg-red-500' },
  { value: 'custom', label: 'Custom', color: 'bg-gray-500' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-gray-400' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-600' },
];

export default function CognitivePrecisionPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddingConstraint, setIsAddingConstraint] = useState(false);
  const [newConstraint, setNewConstraint] = useState({
    constraintText: '',
    taskTypes: ['unknown'],
    category: 'custom',
    severity: 'medium',
  });

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['cognitive-precision-dashboard'],
    queryFn: () => apiClient.get<Dashboard>('/api/admin/livs/cognitive-precision/dashboard'),
  });

  // Fetch constraints
  const { data: constraintsData, isLoading: constraintsLoading } = useQuery({
    queryKey: ['cognitive-precision-constraints'],
    queryFn: () => apiClient.get<{ constraints: NegativeConstraint[]; count: number }>(
      '/api/admin/livs/cognitive-precision/constraints'
    ),
  });

  // Fetch anchor logs
  const { data: anchorLogs } = useQuery({
    queryKey: ['cognitive-precision-anchor-logs'],
    queryFn: () => apiClient.get<{ logs: Record<string, unknown>[]; count: number }>(
      '/api/admin/livs/cognitive-precision/anchor-logs?limit=20'
    ),
  });

  // Fetch critic metrics
  const { data: criticMetricsData } = useQuery({
    queryKey: ['cognitive-precision-metrics'],
    queryFn: () => apiClient.get<{ metrics: Record<string, number>; periodDays: number }>(
      '/api/admin/livs/cognitive-precision/metrics?days=30'
    ),
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (updates: Partial<CognitivePrecisionConfig>) =>
      apiClient.put('/api/admin/livs/cognitive-precision/config', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cognitive-precision-dashboard'] });
    },
  });

  // Add constraint mutation
  const addConstraintMutation = useMutation({
    mutationFn: (constraint: typeof newConstraint) =>
      apiClient.post('/api/admin/livs/cognitive-precision/constraints', constraint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cognitive-precision-constraints'] });
      setIsAddingConstraint(false);
      setNewConstraint({ constraintText: '', taskTypes: ['unknown'], category: 'custom', severity: 'medium' });
    },
  });

  // Delete constraint mutation
  const deleteConstraintMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/admin/livs/cognitive-precision/constraints/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cognitive-precision-constraints'] });
    },
  });

  const config = dashboard?.config;
  const constraints = constraintsData?.constraints || [];

  const handleConfigUpdate = (key: keyof CognitivePrecisionConfig, value: unknown) => {
    updateConfigMutation.mutate({ [key]: value } as Partial<CognitivePrecisionConfig>);
  };

  if (dashboardLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">Cognitive Precision Protocols</h1>
          <p className="text-muted-foreground">
            v7.10.0 - Context Anchor Gate, Negative Constraints, Critic Model Separation
          </p>
        </div>
        <Button onClick={() => refetchDashboard()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Context Anchor Gate</CardTitle>
            <Anchor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={config?.context_anchor_enabled ? 'default' : 'secondary'}>
                {config?.context_anchor_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Min confidence: {((config?.context_anchor_min_confidence || 0.7) * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negative Constraints</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.customConstraintCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Custom constraints + system defaults
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critic Analysis</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.criticMetrics?.total_invocations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total critic invocations (7d)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lie Detection Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.criticMetrics?.lie_detection_rate || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Weakens verdicts (7d)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="context-anchor">Context Anchor</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
          <TabsTrigger value="critic">Critic Model</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Context Anchor Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Anchor className="h-5 w-5" />
                  Context Anchor Gate
                </CardTitle>
                <CardDescription>
                  Pre-generation context validation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {dashboard?.anchorStats?.map((stat) => (
                    <div key={stat.gate_action} className="flex justify-between items-center">
                      <span className="text-sm flex items-center gap-2">
                        {stat.gate_action === 'PROCEED' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {stat.gate_action === 'CLARIFY' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                        {stat.gate_action === 'BLOCKED' && <XCircle className="h-4 w-4 text-red-500" />}
                        {stat.gate_action}
                      </span>
                      <Badge variant="outline">{stat.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Constraints Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Negative Constraints
                </CardTitle>
                <CardDescription>
                  Pre-generation &quot;don&apos;t do&quot; rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {CONSTRAINT_CATEGORIES.map((cat) => {
                    const count = constraints.filter(c => c.category === cat.value).length;
                    return (
                      <div key={cat.value} className="flex justify-between items-center">
                        <span className="text-sm flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                          {cat.label}
                        </span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Critic Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Critic Model
                </CardTitle>
                <CardDescription>
                  Discriminative analysis settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Tiered Escalation</span>
                    <Badge variant={config?.tiered_escalation_enabled ? 'default' : 'secondary'}>
                      {config?.tiered_escalation_enabled ? 'On' : 'Off'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Ensemble Mode</span>
                    <Badge variant={config?.ensemble_enabled ? 'default' : 'secondary'}>
                      {config?.ensemble_enabled ? 'On' : 'Off'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Isolation</span>
                    <Badge variant="outline">{config?.isolation_level || 'none'}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Context Anchor Tab */}
        <TabsContent value="context-anchor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context Anchor Gate Configuration</CardTitle>
              <CardDescription>
                Configure how the system validates context before AI generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Context Anchor Gate</Label>
                  <p className="text-sm text-muted-foreground">
                    Block generation until sufficient context is established
                  </p>
                </div>
                <Switch
                  checked={config?.context_anchor_enabled ?? true}
                  onCheckedChange={(v) => handleConfigUpdate('context_anchor_enabled', v)}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Minimum Confidence Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[(config?.context_anchor_min_confidence || 0.7) * 100]}
                      onValueChange={(v) => handleConfigUpdate('context_anchor_min_confidence', v[0] / 100)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">
                      {((config?.context_anchor_min_confidence || 0.7) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requests below this confidence will require clarification
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Override</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow users to proceed despite low confidence
                    </p>
                  </div>
                  <Switch
                    checked={config?.context_anchor_allow_override ?? true}
                    onCheckedChange={(v) => handleConfigUpdate('context_anchor_allow_override', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Clarifying Questions</Label>
                  <Select
                    value={String(config?.context_anchor_max_clarifying_questions || 3)}
                    onValueChange={(v) => handleConfigUpdate('context_anchor_max_clarifying_questions', parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Anchor Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Context Anchor Evaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Constraints</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(anchorLogs?.logs || []).slice(0, 10).map((log: Record<string, unknown>, i) => (
                    <TableRow key={i}>
                      <TableCell>{String(log.task_type)}</TableCell>
                      <TableCell>{((log.confidence_score as number) * 100).toFixed(0)}%</TableCell>
                      <TableCell>
                        <Badge variant={
                          log.gate_action === 'PROCEED' ? 'default' :
                          log.gate_action === 'CLARIFY' ? 'secondary' : 'destructive'
                        }>
                          {String(log.gate_action)}
                        </Badge>
                      </TableCell>
                      <TableCell>{String(log.constraints_applied)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.created_at as string).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Constraints Tab */}
        <TabsContent value="constraints" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Negative Constraints</CardTitle>
                  <CardDescription>
                    Pre-generation rules that tell the AI what NOT to do
                  </CardDescription>
                </div>
                <Dialog open={isAddingConstraint} onOpenChange={setIsAddingConstraint}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Constraint
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Negative Constraint</DialogTitle>
                      <DialogDescription>
                        Create a new &quot;don&apos;t do&quot; rule for AI generation
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Constraint Text</Label>
                        <Textarea
                          placeholder="DO NOT ..."
                          value={newConstraint.constraintText}
                          onChange={(e) => setNewConstraint({ ...newConstraint, constraintText: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={newConstraint.category}
                          onValueChange={(v) => setNewConstraint({ ...newConstraint, category: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONSTRAINT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select
                          value={newConstraint.severity}
                          onValueChange={(v) => setNewConstraint({ ...newConstraint, severity: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEVERITY_LEVELS.map((sev) => (
                              <SelectItem key={sev.value} value={sev.value}>{sev.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Task Types</Label>
                        <div className="flex flex-wrap gap-2">
                          {TASK_TYPES.map((type) => (
                            <Badge
                              key={type}
                              variant={newConstraint.taskTypes.includes(type) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                const types = newConstraint.taskTypes.includes(type)
                                  ? newConstraint.taskTypes.filter(t => t !== type)
                                  : [...newConstraint.taskTypes, type];
                                setNewConstraint({ ...newConstraint, taskTypes: types });
                              }}
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddingConstraint(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addConstraintMutation.mutate(newConstraint)}
                        disabled={!newConstraint.constraintText || addConstraintMutation.isPending}
                      >
                        {addConstraintMutation.isPending ? 'Adding...' : 'Add Constraint'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Constraint</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Task Types</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {constraints.map((constraint) => (
                    <TableRow key={constraint.id}>
                      <TableCell className="font-mono text-sm">
                        {constraint.constraint_text}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {constraint.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            constraint.severity === 'critical' ? 'destructive' :
                            constraint.severity === 'high' ? 'default' : 'secondary'
                          }
                        >
                          {constraint.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {constraint.task_types.slice(0, 2).map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {constraint.task_types.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{constraint.task_types.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={constraint.is_system_default ? 'secondary' : 'default'}>
                          {constraint.is_system_default ? 'System' : 'Custom'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!constraint.is_system_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConstraintMutation.mutate(constraint.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Critic Model Tab */}
        <TabsContent value="critic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Critic Model Configuration</CardTitle>
                <CardDescription>
                  Configure the discriminative model for analysis tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Critic Model</Label>
                    <p className="text-sm text-muted-foreground">
                      Use a separate model for discriminative tasks
                    </p>
                  </div>
                  <Switch
                    checked={config?.critic_enabled ?? true}
                    onCheckedChange={(v) => handleConfigUpdate('critic_enabled', v)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Primary Critic Model</Label>
                  <Input
                    value={config?.critic_model_id || ''}
                    onChange={(e) => handleConfigUpdate('critic_model_id', e.target.value)}
                    placeholder="anthropic/claude-3-5-sonnet-20241022"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Screening Model</Label>
                  <Input
                    value={config?.screening_model_id || ''}
                    onChange={(e) => handleConfigUpdate('screening_model_id', e.target.value)}
                    placeholder="anthropic/claude-3-haiku"
                  />
                  <p className="text-xs text-muted-foreground">
                    Faster, cheaper model for initial screening
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Critic Temperature</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[(config?.critic_temperature || 0.1) * 100]}
                      onValueChange={(v) => handleConfigUpdate('critic_temperature', v[0] / 100)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">
                      {(config?.critic_temperature || 0.1).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Tiered escalation, ensemble, and isolation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tiered Escalation</Label>
                    <p className="text-sm text-muted-foreground">
                      Screening → Full Critic → Ensemble
                    </p>
                  </div>
                  <Switch
                    checked={config?.tiered_escalation_enabled ?? true}
                    onCheckedChange={(v) => handleConfigUpdate('tiered_escalation_enabled', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Escalation Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[(config?.screening_escalation_threshold || 0.7) * 100]}
                      onValueChange={(v) => handleConfigUpdate('screening_escalation_threshold', v[0] / 100)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">
                      {((config?.screening_escalation_threshold || 0.7) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Ensemble Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Multiple critics vote for high-stakes patterns
                    </p>
                  </div>
                  <Switch
                    checked={config?.ensemble_enabled ?? false}
                    onCheckedChange={(v) => handleConfigUpdate('ensemble_enabled', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Voting Strategy</Label>
                  <Select
                    value={config?.ensemble_voting_strategy || 'majority'}
                    onValueChange={(v) => handleConfigUpdate('ensemble_voting_strategy', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="majority">Majority</SelectItem>
                      <SelectItem value="unanimous">Unanimous</SelectItem>
                      <SelectItem value="weighted">Weighted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Critic Isolation</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide original query from critic to prevent bias
                    </p>
                  </div>
                  <Switch
                    checked={config?.isolation_enabled ?? false}
                    onCheckedChange={(v) => handleConfigUpdate('isolation_enabled', v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Isolation Level</Label>
                  <Select
                    value={config?.isolation_level || 'none'}
                    onValueChange={(v) => handleConfigUpdate('isolation_level', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="partial">Partial (query hidden)</SelectItem>
                      <SelectItem value="full">Full (response-only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Invocations</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {criticMetricsData?.metrics?.total_invocations || 0}
                </div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((criticMetricsData?.metrics?.avg_escalation_rate || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Screening → Full</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Screening Confidence</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((criticMetricsData?.metrics?.avg_confidence_screening || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Screening tier</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(criticMetricsData?.metrics?.avg_processing_time_full_ms || 0).toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">Full critic tier</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Verdict Distribution (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['supports', 'weakens', 'inconclusive'].map((verdict) => {
                  const count = criticMetricsData?.metrics?.[`verdict_${verdict}`] || 0;
                  const total = (criticMetricsData?.metrics?.verdict_supports || 0) +
                               (criticMetricsData?.metrics?.verdict_weakens || 0) +
                               (criticMetricsData?.metrics?.verdict_inconclusive || 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  
                  return (
                    <div key={verdict} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize flex items-center gap-2">
                          {verdict === 'supports' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {verdict === 'weakens' && <XCircle className="h-4 w-4 text-red-500" />}
                          {verdict === 'inconclusive' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                          {verdict}
                        </span>
                        <span>{count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            verdict === 'supports' ? 'bg-green-500' :
                            verdict === 'weakens' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Invocations by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Screening</span>
                    <span className="font-medium">
                      {criticMetricsData?.metrics?.screening_invocations || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Full</span>
                    <span className="font-medium">
                      {criticMetricsData?.metrics?.full_invocations || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ensemble</span>
                    <span className="font-medium">
                      {criticMetricsData?.metrics?.ensemble_invocations || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Confidence by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Screening</span>
                    <span className="font-medium">
                      {((criticMetricsData?.metrics?.avg_confidence_screening || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Full</span>
                    <span className="font-medium">
                      {((criticMetricsData?.metrics?.avg_confidence_full || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ensemble</span>
                    <span className="font-medium">
                      {((criticMetricsData?.metrics?.avg_confidence_ensemble || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Heuristic Agreement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {((criticMetricsData?.metrics?.avg_heuristic_agreement_rate || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Rate at which heuristic and critic verdicts align
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
