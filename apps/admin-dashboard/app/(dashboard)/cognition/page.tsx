'use client';

import { useState, useEffect } from 'react';
import {
  Zap, Database, Bot, RefreshCw, Settings,
  Play, Pause, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronRight, Network, Layers, Cpu, Eye, Shield, Activity, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

interface CausalNode {
  nodeId: string;
  name: string;
  nodeType: string;
  currentValue?: unknown;
  isManipulable: boolean;
}

interface CausalEdge {
  edgeId: string;
  causeNodeId: string;
  effectNodeId: string;
  causalStrength: number;
  confidence: number;
  mechanism?: string;
}

interface AutonomousTask {
  taskId: string;
  taskType: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  isPaused: boolean;
  requiresApproval: boolean;
  runCount: number;
  lastRunAt?: string;
}

interface PendingApproval {
  executionId: string;
  taskName: string;
  proposedActions: Array<{
    action: string;
    target: string;
    impactAssessment: { level: string; description: string };
  }>;
  triggeredAt: string;
}

interface ConsolidationJob {
  jobId: string;
  jobType: string;
  status: string;
  memoriesProcessed: number;
  conflictsFound: number;
  startedAt?: string;
}

interface MemoryConflict {
  conflictId: string;
  conflictType: string;
  severity: string;
  memoryAContent: string;
  memoryBContent: string;
  resolutionStatus: string;
}

interface CognitionStats {
  causalNodes: number;
  causalEdges: number;
  multimodalRepresentations: number;
  executableSkills: number;
  autonomousTasksEnabled: number;
  pendingApprovals: number;
  memoryConflicts: number;
  consolidationJobsRunning: number;
}

interface CognitionSettings {
  causalReasoningEnabled: boolean;
  consolidationEnabled: boolean;
  consolidationSchedule: string;
  multimodalBindingEnabled: boolean;
  skillExecutionEnabled: boolean;
  autonomousEnabled: boolean;
  autonomousApprovalRequired: boolean;
  maxAutonomousActionsPerDay: number;
}

const impactStyles: Record<string, string> = {
  none: 'bg-muted text-muted-foreground border-border',
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

export default function CognitionPage() {
  const [stats, setStats] = useState<CognitionStats | null>(null);
  const [settings, setSettings] = useState<CognitionSettings | null>(null);
  const [causalNodes, setCausalNodes] = useState<CausalNode[]>([]);
  const [causalEdges, setCausalEdges] = useState<CausalEdge[]>([]);
  const [autonomousTasks, setAutonomousTasks] = useState<AutonomousTask[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [consolidationJobs, setConsolidationJobs] = useState<ConsolidationJob[]>([]);
  const [memoryConflicts, setMemoryConflicts] = useState<MemoryConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'causal' | 'memory' | 'skills' | 'autonomous'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const [_error, setError] = useState<string | null>(null);
  void _error; // Reserved for error display

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [statsRes, settingsRes, nodesRes, edgesRes, tasksRes, approvalsRes, jobsRes, conflictsRes] = await Promise.all([
        fetch(`${API}/admin/cognition/stats`),
        fetch(`${API}/admin/cognition/settings`),
        fetch(`${API}/admin/cognition/causal-nodes`),
        fetch(`${API}/admin/cognition/causal-edges`),
        fetch(`${API}/admin/cognition/autonomous-tasks`),
        fetch(`${API}/admin/cognition/pending-approvals`),
        fetch(`${API}/admin/cognition/consolidation-jobs`),
        fetch(`${API}/admin/cognition/memory-conflicts`),
      ]);
      if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data); }
      else setError('Failed to load cognition data.');
      if (settingsRes.ok) { const { data } = await settingsRes.json(); setSettings(data); }
      if (nodesRes.ok) { const { data } = await nodesRes.json(); setCausalNodes(data || []); }
      if (edgesRes.ok) { const { data } = await edgesRes.json(); setCausalEdges(data || []); }
      if (tasksRes.ok) { const { data } = await tasksRes.json(); setAutonomousTasks(data || []); }
      if (approvalsRes.ok) { const { data } = await approvalsRes.json(); setPendingApprovals(data || []); }
      if (jobsRes.ok) { const { data } = await jobsRes.json(); setConsolidationJobs(data || []); }
      if (conflictsRes.ok) { const { data } = await conflictsRes.json(); setMemoryConflicts(data || []); }
    } catch { setError('Failed to connect to cognition service.'); }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-7 w-7 text-primary" />
            Advanced Cognition
          </h1>
          <p className="text-muted-foreground mt-1">
            Causal reasoning, memory consolidation, multimodal binding, skills, and autonomous agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={loadData}>
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Causal Nodes" value={stats.causalNodes} icon={Network} color="indigo" />
          <StatCard title="Representations" value={stats.multimodalRepresentations} icon={Layers} color="blue" />
          <StatCard title="Skills" value={stats.executableSkills} icon={Zap} color="green" />
          <StatCard title="Auto Tasks" value={stats.autonomousTasksEnabled} icon={Bot} color="purple" />
          <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={Clock} color={stats.pendingApprovals > 0 ? 'orange' : 'gray'} />
          <StatCard title="Conflicts" value={stats.memoryConflicts} icon={AlertTriangle} color={stats.memoryConflicts > 0 ? 'red' : 'gray'} />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview"><Eye className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="causal"><Network className="h-4 w-4 mr-1.5" />Causal Graph</TabsTrigger>
          <TabsTrigger value="memory"><Database className="h-4 w-4 mr-1.5" />Memory</TabsTrigger>
          <TabsTrigger value="skills"><Zap className="h-4 w-4 mr-1.5" />Skills</TabsTrigger>
          <TabsTrigger value="autonomous"><Bot className="h-4 w-4 mr-1.5" />Autonomous</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
        {settings && (
        <div className="grid grid-cols-2 gap-6">
          {/* Feature Status */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FeatureToggle name="Causal Reasoning" enabled={settings.causalReasoningEnabled} description="Do-calculus and counterfactual reasoning" />
              <FeatureToggle name="Memory Consolidation" enabled={settings.consolidationEnabled} description={`Schedule: ${settings.consolidationSchedule}`} />
              <FeatureToggle name="Multimodal Binding" enabled={settings.multimodalBindingEnabled} description="Cross-modal search and grounding" />
              <FeatureToggle name="Skill Execution" enabled={settings.skillExecutionEnabled} description="Procedural memory replay" />
              <FeatureToggle name="Autonomous Agent" enabled={settings.autonomousEnabled} description={settings.autonomousApprovalRequired ? 'Approval required' : 'Auto-execute'} warning={!settings.autonomousApprovalRequired} />
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Pending Approvals</CardTitle>
              {pendingApprovals.length > 0 && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                  {pendingApprovals.length} pending
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {pendingApprovals.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <ApprovalRow key={approval.executionId} approval={approval} />
                ))
              )}
            </div>
            </CardContent>
          </Card>

          {/* Memory Conflicts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Memory Conflicts</CardTitle>
              {memoryConflicts.length > 0 && (
                <Badge variant="destructive">
                  {memoryConflicts.length} unresolved
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {memoryConflicts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No memory conflicts</p>
                </div>
              ) : (
                memoryConflicts.map((conflict) => (
                  <ConflictRow key={conflict.conflictId} conflict={conflict} />
                ))
              )}
            </div>
            </CardContent>
          </Card>

          {/* Consolidation Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Consolidation Jobs</CardTitle>
              <Button size="sm">Run Now</Button>
            </CardHeader>
            <CardContent className="p-0">
            <div className="divide-y divide-border">
              {consolidationJobs.map((job) => (
                <JobRow key={job.jobId} job={job} />
              ))}
            </div>
            </CardContent>
          </Card>
        </div>
      )}
        </TabsContent>

        <TabsContent value="causal">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Causal Knowledge Graph</CardTitle>
              <p className="text-sm text-muted-foreground">Nodes and edges representing causal relationships</p>
            </CardHeader>
            <CardContent>
              {/* Simple graph visualization - in production would use D3 or similar */}
              <div className="h-96 bg-muted rounded-lg p-4 relative overflow-hidden">
                {causalNodes.map((node, i) => {
                  const x = 50 + (i % 4) * 150;
                  const y = 50 + Math.floor(i / 4) * 100;
                  return (
                    <div
                      key={node.nodeId}
                      className="absolute p-2 bg-card rounded-lg shadow border border-border cursor-pointer hover:ring-2 hover:ring-primary"
                      style={{ left: x, top: y }}
                    >
                      <div className="text-sm font-medium text-foreground">{node.name}</div>
                      <div className="text-xs text-muted-foreground">{node.nodeType}</div>
                    </div>
                  );
                })}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {causalEdges.map((edge, _i) => {
                    const sourceIdx = causalNodes.findIndex((n) => n.nodeId === edge.causeNodeId);
                    const targetIdx = causalNodes.findIndex((n) => n.nodeId === edge.effectNodeId);
                    if (sourceIdx === -1 || targetIdx === -1) return null;
                    const x1 = 100 + (sourceIdx % 4) * 150;
                    const y1 = 70 + Math.floor(sourceIdx / 4) * 100;
                    const x2 = 50 + (targetIdx % 4) * 150;
                    const y2 = 70 + Math.floor(targetIdx / 4) * 100;
                    return (
                      <line
                        key={edge.edgeId}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        className="stroke-primary"
                        strokeWidth={Math.max(1, edge.causalStrength * 3)}
                        strokeOpacity={edge.confidence}
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Intervention Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Causal Intervention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Variable</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {causalNodes.filter((n) => n.isManipulable).map((n) => (
                        <SelectItem key={n.nodeId} value={n.nodeId}>{n.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Set Value To</Label>
                  <Input type="text" placeholder="New value..." />
                </div>
                <Button className="w-full">
                  do(X = value)
                </Button>
                <Button variant="outline" className="w-full">
                  Counterfactual Query
                </Button>
              </CardContent>
            </Card>

            {/* Edge List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Causal Edges</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
              <div className="divide-y divide-border max-h-60 overflow-y-auto">
                {causalEdges.map((edge) => {
                  const cause = causalNodes.find((n) => n.nodeId === edge.causeNodeId);
                  const effect = causalNodes.find((n) => n.nodeId === edge.effectNodeId);
                  return (
                    <div key={edge.edgeId} className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{cause?.name || '?'}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{effect?.name || '?'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Strength: {(edge.causalStrength * 100).toFixed(0)}% • Confidence: {(edge.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </TabsContent>

        <TabsContent value="autonomous">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Autonomous Tasks</CardTitle>
                <p className="text-sm text-muted-foreground">Background tasks with bounded autonomy</p>
              </div>
              <Button size="sm">+ Add Task</Button>
            </CardHeader>
            <CardContent className="p-0">
            <div className="divide-y divide-border">
              {autonomousTasks.map((task) => (
                <TaskRow key={task.taskId} task={task} />
              ))}
            </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Safety Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Safety Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Require Approval</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Max Actions/Day</Label>
                  <Input type="number" defaultValue={10} />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens/Day</Label>
                  <Input type="number" defaultValue={100000} />
                </div>
                <div className="space-y-2">
                  <Label>Allowed Task Types</Label>
                  <div className="mt-2 space-y-2">
                    {['suggestion', 'maintenance', 'background_learning', 'monitoring'].map((type) => (
                      <div key={type} className="flex items-center gap-2">
                        <Checkbox id={`task-type-${type}`} defaultChecked={['suggestion', 'maintenance'].includes(type)} />
                        <Label htmlFor={`task-type-${type}`} className="text-sm font-normal capitalize cursor-pointer">{type.replace('_', ' ')}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm max-h-60 overflow-y-auto">
                <ActivityItem time="2m ago" action="Memory consolidation completed" status="success" />
                <ActivityItem time="15m ago" action="Suggestion approved by admin" status="success" />
                <ActivityItem time="1h ago" action="Pattern analysis triggered" status="pending" />
                <ActivityItem time="3h ago" action="Skill extraction failed" status="failed" />
              </CardContent>
            </Card>
          </div>
        </div>
        </TabsContent>

        <TabsContent value="memory">
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Consolidation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select defaultValue="daily">
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Compression Ratio</Label>
                <Slider defaultValue={[70]} min={0} max={100} step={1} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Keep All</span>
                  <span>70%</span>
                  <span>Max Compression</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Importance Decay Rate (per day)</Label>
                <Input type="number" defaultValue={0.05} step={0.01} />
              </div>
              <div className="space-y-2">
                <Label>Auto-Prune Threshold</Label>
                <Input type="number" defaultValue={0.1} step={0.01} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-Resolve Conflicts</Label>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Memory Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">1,247</p>
                  <p className="text-xs text-muted-foreground">Episodic Memories</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">438</p>
                  <p className="text-xs text-muted-foreground">Semantic Memories</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">56</p>
                  <p className="text-xs text-muted-foreground">Procedural Memories</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">89</p>
                  <p className="text-xs text-muted-foreground">Consolidated</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-medium">2.4 GB / 10 GB</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '24%' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="skills">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Executable Skills</CardTitle>
              <p className="text-sm text-muted-foreground">Learned procedures that can be replayed</p>
            </div>
            <Button size="sm">+ Learn Skill</Button>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {([] as Array<{skillId: string; name: string; skillType: string; executionCount: number; successRate: number}>).map((skill) => (
              <SkillRow key={skill.skillId} skill={skill} />
            ))}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'indigo' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';
}) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    gray: 'bg-muted text-muted-foreground',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureToggle({ name, enabled, description, warning }: { name: string; enabled: boolean; description: string; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {warning && <AlertTriangle className="h-4 w-4 text-orange-500" />}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={enabled} />
    </div>
  );
}

function ApprovalRow({ approval }: { approval: PendingApproval }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{approval.taskName}</h4>
          <p className="text-xs text-muted-foreground">{new Date(approval.triggeredAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700 hover:bg-green-500/10">
            <CheckCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-500/10">
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {approval.proposedActions.map((action, i) => (
          <div key={i} className="text-sm flex items-center gap-2">
            <Badge variant="outline" className={impactStyles[action.impactAssessment.level] || impactStyles.none}>
              {action.impactAssessment.level}
            </Badge>
            <span className="text-muted-foreground">{action.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  major: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  minor: 'bg-muted text-muted-foreground border-border',
};

function ConflictRow({ conflict }: { conflict: MemoryConflict }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={severityStyles[conflict.severity] || severityStyles.minor}>
          {conflict.severity}
        </Badge>
        <span className="text-sm text-muted-foreground capitalize">{conflict.conflictType.replace('_', ' ')}</span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
        A: {conflict.memoryAContent.substring(0, 50)}...
      </div>
      <div className="text-sm text-muted-foreground line-clamp-2">
        B: {conflict.memoryBContent.substring(0, 50)}...
      </div>
      <Button variant="link" size="sm" className="mt-1 px-0 h-auto">Resolve</Button>
    </div>
  );
}

const jobStatusStyles: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

function JobRow({ job }: { job: ConsolidationJob }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{job.jobType}</span>
          <Badge variant="outline" className={jobStatusStyles[job.status] || jobStatusStyles.pending}>
            {job.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{job.memoriesProcessed} processed • {job.conflictsFound} conflicts</p>
      </div>
      {job.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
    </div>
  );
}

function TaskRow({ task }: { task: AutonomousTask }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${task.isEnabled && !task.isPaused ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{task.name}</span>
            {task.requiresApproval && <Shield className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <p className="text-xs text-muted-foreground">{task.taskType} • {task.runCount} runs</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {task.isEnabled && !task.isPaused ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10">
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10">
            <Play className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
          <Zap className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SkillRow({ skill }: { skill: { skillId: string; name: string; skillType: string; executionCount: number; successRate: number } }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <span className="font-medium">{skill.name}</span>
          <p className="text-xs text-muted-foreground">{skill.skillType} • {skill.executionCount} executions • {(skill.successRate * 100).toFixed(0)}% success</p>
        </div>
      </div>
      <Button variant="outline" size="sm">Execute</Button>
    </div>
  );
}

function ActivityItem({ time, action, status }: { time: string; action: string; status: 'success' | 'pending' | 'failed' }) {
  const colors = { success: 'text-green-500', pending: 'text-yellow-500', failed: 'text-red-500' };
  const icons = { success: CheckCircle, pending: Clock, failed: XCircle };
  const Icon = icons[status];
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-4 w-4 mt-0.5 ${colors[status]}`} />
      <div className="flex-1">
        <p className="text-sm">{action}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

