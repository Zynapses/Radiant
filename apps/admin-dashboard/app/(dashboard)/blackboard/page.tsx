'use client';

/**
 * RADIANT v5.52.4 - Semantic Blackboard Admin Dashboard
 * 
 * Multi-agent orchestration control center:
 * - Resolved Decisions (Facts) - semantic question matching
 * - Question Groups - fan-out answer delivery
 * - Active Agents - real-time agent monitoring
 * - Resource Locks - deadlock prevention
 * - Process Hydration - state serialization
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Brain, Users, Lock, RefreshCw, 
  CheckCircle, XCircle, Loader2,
  MessageSquare, Archive, Trash2, Play
} from 'lucide-react';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/client';
import { GlassCard } from '@/components/ui/glass-card';

interface DashboardStats {
  resolvedDecisions: number;
  activeAgents: number;
  pendingGroups: number;
  activeLocks: number;
  hydratedAgents: number;
}

interface ResolvedDecision {
  id: string;
  question: string;
  answer: string;
  answerSource: string;
  confidence: number;
  isValid: boolean;
  topic?: string;
  timesReused: number;
  createdAt: string;
}

interface QuestionGroup {
  id: string;
  canonicalQuestion: string;
  topic?: string;
  status: string;
  memberCount: number;
  createdAt: string;
}

interface ActiveAgent {
  id: string;
  agentType: string;
  agentInstanceId: string;
  status: string;
  isHydrated: boolean;
  blockedReason?: string;
  startedAt: string;
  lastHeartbeatAt: string;
}

interface ResourceLock {
  id: string;
  resourceType: string;
  resourceUri: string;
  holderAgentType: string;
  lockType: string;
  acquiredAt: string;
  expiresAt: string;
  waitQueueLength: number;
}

interface BlackboardConfig {
  similarityThreshold: number;
  enableQuestionGrouping: boolean;
  groupingWindowSeconds: number;
  enableAnswerReuse: boolean;
  answerTtlSeconds: number;
  enableAutoHydration: boolean;
  hydrationThresholdSeconds: number;
  enableCycleDetection: boolean;
}

export default function BlackboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [invalidateDialogOpen, setInvalidateDialogOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<ResolvedDecision | null>(null);
  const [invalidateReason, setInvalidateReason] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // Dashboard query
  const { data: dashboard, isLoading: _dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['blackboard', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: { data: DashboardStats } }>('/admin/blackboard/dashboard');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  // Resolved decisions query
  const { data: decisions, isLoading: decisionsLoading } = useQuery({
    queryKey: ['blackboard', 'decisions'],
    queryFn: async () => {
      const res = await api.get<{ data: { data: { decisions: ResolvedDecision[] } } }>('/admin/blackboard/decisions?limit=50');
      return res.data.data.decisions;
    },
    enabled: activeTab === 'decisions',
  });

  // Question groups query
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['blackboard', 'groups'],
    queryFn: async () => {
      const res = await api.get<{ data: { data: { groups: QuestionGroup[] } } }>('/admin/blackboard/groups');
      return res.data.data.groups;
    },
    enabled: activeTab === 'groups',
  });

  // Active agents query
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['blackboard', 'agents'],
    queryFn: async () => {
      const res = await api.get<{ data: { data: { agents: ActiveAgent[] } } }>('/admin/blackboard/agents');
      return res.data.data.agents;
    },
    enabled: activeTab === 'agents',
    refetchInterval: 10000,
  });

  // Resource locks query
  const { data: locks, isLoading: locksLoading } = useQuery({
    queryKey: ['blackboard', 'locks'],
    queryFn: async () => {
      const res = await api.get<{ data: { data: { locks: ResourceLock[] } } }>('/admin/blackboard/locks');
      return res.data.data.locks;
    },
    enabled: activeTab === 'locks',
    refetchInterval: 10000,
  });

  // Config query
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['blackboard', 'config'],
    queryFn: async () => {
      const res = await api.get<{ data: { data: { config: BlackboardConfig } } }>('/admin/blackboard/config');
      return res.data.data.config;
    },
    enabled: activeTab === 'config',
  });

  // Invalidate decision mutation
  const invalidateMutation = useMutation({
    mutationFn: async ({ decisionId, reason, newAnswer }: { decisionId: string; reason: string; newAnswer?: string }) => {
      await api.post(`/admin/blackboard/decisions/${decisionId}/invalidate`, { reason, newAnswer });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackboard'] });
      setInvalidateDialogOpen(false);
      setSelectedDecision(null);
      setInvalidateReason('');
      setNewAnswer('');
    },
  });

  // Release lock mutation
  const releaseLockMutation = useMutation({
    mutationFn: async (lockId: string) => {
      await api.post(`/admin/blackboard/locks/${lockId}/release`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackboard', 'locks'] });
    },
  });

  // Restore agent mutation
  const restoreAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await api.post(`/admin/blackboard/agents/${agentId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackboard', 'agents'] });
    },
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/blackboard/cleanup');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackboard'] });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<BlackboardConfig>) => {
      await api.put('/admin/blackboard/config', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackboard', 'config'] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>;
      case 'waiting':
        return <Badge className="bg-amber-500/20 text-amber-400">Waiting</Badge>;
      case 'blocked':
        return <Badge className="bg-red-500/20 text-red-400">Blocked</Badge>;
      case 'hydrated':
        return <Badge className="bg-cyan-500/20 text-cyan-400">Hydrated</Badge>;
      case 'completed':
        return <Badge className="bg-slate-500/20 text-slate-400">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Semantic Blackboard</h1>
          <p className="text-slate-400 mt-1">Multi-agent orchestration & semantic question matching</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
          >
            {cleanupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Cleanup Expired
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDashboard()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <GlassCard glowColor="violet">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Brain className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.resolvedDecisions ?? '-'}</p>
                <p className="text-xs text-slate-400">Resolved Facts</p>
              </div>
            </div>
          </CardContent>
        </GlassCard>

        <GlassCard glowColor="emerald">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.activeAgents ?? '-'}</p>
                <p className="text-xs text-slate-400">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </GlassCard>

        <GlassCard glowColor="cyan">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <MessageSquare className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.pendingGroups ?? '-'}</p>
                <p className="text-xs text-slate-400">Pending Groups</p>
              </div>
            </div>
          </CardContent>
        </GlassCard>

        <GlassCard glowColor="fuchsia">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-fuchsia-500/20">
                <Lock className="h-5 w-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.activeLocks ?? '-'}</p>
                <p className="text-xs text-slate-400">Active Locks</p>
              </div>
            </div>
          </CardContent>
        </GlassCard>

        <GlassCard glowColor="blue">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Archive className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.hydratedAgents ?? '-'}</p>
                <p className="text-xs text-slate-400">Hydrated</p>
              </div>
            </div>
          </CardContent>
        </GlassCard>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="decisions">Resolved Facts</TabsTrigger>
          <TabsTrigger value="groups">Question Groups</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="locks">Resource Locks</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <GlassCard>
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">1</div>
                  <div>
                    <p className="font-medium text-white">Semantic Matching</p>
                    <p className="text-slate-400">Agent questions are vectorized and matched against previously answered questions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">2</div>
                  <div>
                    <p className="font-medium text-white">Answer Reuse</p>
                    <p className="text-slate-400">Similar questions get cached answers instantly, preventing repeated user prompts</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">3</div>
                  <div>
                    <p className="font-medium text-white">Question Grouping</p>
                    <p className="text-slate-400">Multiple agents asking similar questions are grouped for single-answer fan-out</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400">4</div>
                  <div>
                    <p className="font-medium text-white">Process Hydration</p>
                    <p className="text-slate-400">Long-waiting agents are serialized to disk, freeing resources until answers arrive</p>
                  </div>
                </div>
              </CardContent>
            </GlassCard>

            <GlassCard>
              <CardHeader>
                <CardTitle className="text-lg">Architecture Benefits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <span className="text-slate-300">Thundering Herd Prevention</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <span className="text-slate-300">Deadlock Detection</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <span className="text-slate-300">Resource Lock Management</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <span className="text-slate-300">State Serialization</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <span className="text-slate-300">Vector Similarity Search</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
              </CardContent>
            </GlassCard>
          </div>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions">
          <GlassCard>
            <CardHeader>
              <CardTitle>Resolved Decisions (Facts)</CardTitle>
              <CardDescription>Previously answered questions available for semantic reuse</CardDescription>
            </CardHeader>
            <CardContent>
              {decisionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Answer</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Reused</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisions?.map((decision) => (
                      <TableRow key={decision.id}>
                        <TableCell className="max-w-xs truncate">{decision.question}</TableCell>
                        <TableCell className="max-w-xs truncate">{decision.answer}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{decision.answerSource}</Badge>
                        </TableCell>
                        <TableCell>{decision.timesReused}x</TableCell>
                        <TableCell>
                          {decision.isValid ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400">Valid</Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400">Invalid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {decision.isValid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDecision(decision);
                                setInvalidateDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 text-red-400" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups">
          <GlassCard>
            <CardHeader>
              <CardTitle>Pending Question Groups</CardTitle>
              <CardDescription>Similar questions waiting for a single answer</CardDescription>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : groups?.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No pending question groups
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canonical Question</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups?.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="max-w-md truncate">{group.canonicalQuestion}</TableCell>
                        <TableCell>{group.topic || '-'}</TableCell>
                        <TableCell>{group.memberCount} agents</TableCell>
                        <TableCell>{getStatusBadge(group.status)}</TableCell>
                        <TableCell>{new Date(group.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <GlassCard>
            <CardHeader>
              <CardTitle>Active Agents</CardTitle>
              <CardDescription>Currently running and hydrated agents</CardDescription>
            </CardHeader>
            <CardContent>
              {agentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : agents?.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No active agents
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Type</TableHead>
                      <TableHead>Instance ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Blocked Reason</TableHead>
                      <TableHead>Last Heartbeat</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents?.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>{agent.agentType}</TableCell>
                        <TableCell className="font-mono text-xs">{agent.agentInstanceId}</TableCell>
                        <TableCell>{getStatusBadge(agent.status)}</TableCell>
                        <TableCell className="max-w-xs truncate">{agent.blockedReason || '-'}</TableCell>
                        <TableCell>{new Date(agent.lastHeartbeatAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {agent.isHydrated && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => restoreAgentMutation.mutate(agent.id)}
                              disabled={restoreAgentMutation.isPending}
                            >
                              <Play className="h-4 w-4 text-emerald-400" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>

        {/* Locks Tab */}
        <TabsContent value="locks">
          <GlassCard>
            <CardHeader>
              <CardTitle>Resource Locks</CardTitle>
              <CardDescription>Active locks preventing race conditions</CardDescription>
            </CardHeader>
            <CardContent>
              {locksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : locks?.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No active resource locks
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Holder</TableHead>
                      <TableHead>Lock Type</TableHead>
                      <TableHead>Wait Queue</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locks?.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell className="font-mono text-xs max-w-xs truncate">{lock.resourceUri}</TableCell>
                        <TableCell>{lock.resourceType}</TableCell>
                        <TableCell>{lock.holderAgentType}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{lock.lockType}</Badge>
                        </TableCell>
                        <TableCell>{lock.waitQueueLength} waiting</TableCell>
                        <TableCell>{new Date(lock.expiresAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => releaseLockMutation.mutate(lock.id)}
                            disabled={releaseLockMutation.isPending}
                          >
                            <Lock className="h-4 w-4 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config">
          <GlassCard>
            <CardHeader>
              <CardTitle>Blackboard Configuration</CardTitle>
              <CardDescription>Tune semantic matching and orchestration behavior</CardDescription>
            </CardHeader>
            <CardContent>
              {configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Semantic Matching</h3>
                    <div className="space-y-2">
                      <Label>Similarity Threshold</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={config?.similarityThreshold ?? 0.85}
                        onChange={(e) => updateConfigMutation.mutate({ similarityThreshold: parseFloat(e.target.value) })}
                        className="bg-slate-800/50"
                      />
                      <p className="text-xs text-slate-400">Minimum cosine similarity for question matching (0-1)</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Answer Reuse</Label>
                        <p className="text-xs text-slate-400">Auto-reply with cached answers</p>
                      </div>
                      <Switch
                        checked={config?.enableAnswerReuse ?? true}
                        onCheckedChange={(checked) => updateConfigMutation.mutate({ enableAnswerReuse: checked })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer TTL (seconds)</Label>
                      <Input
                        type="number"
                        value={config?.answerTtlSeconds ?? 3600}
                        onChange={(e) => updateConfigMutation.mutate({ answerTtlSeconds: parseInt(e.target.value) })}
                        className="bg-slate-800/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Question Grouping</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Question Grouping</Label>
                        <p className="text-xs text-slate-400">Group similar questions for fan-out</p>
                      </div>
                      <Switch
                        checked={config?.enableQuestionGrouping ?? true}
                        onCheckedChange={(checked) => updateConfigMutation.mutate({ enableQuestionGrouping: checked })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Grouping Window (seconds)</Label>
                      <Input
                        type="number"
                        value={config?.groupingWindowSeconds ?? 60}
                        onChange={(e) => updateConfigMutation.mutate({ groupingWindowSeconds: parseInt(e.target.value) })}
                        className="bg-slate-800/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Process Hydration</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto Hydration</Label>
                        <p className="text-xs text-slate-400">Serialize waiting agents to disk</p>
                      </div>
                      <Switch
                        checked={config?.enableAutoHydration ?? true}
                        onCheckedChange={(checked) => updateConfigMutation.mutate({ enableAutoHydration: checked })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hydration Threshold (seconds)</Label>
                      <Input
                        type="number"
                        value={config?.hydrationThresholdSeconds ?? 300}
                        onChange={(e) => updateConfigMutation.mutate({ hydrationThresholdSeconds: parseInt(e.target.value) })}
                        className="bg-slate-800/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Safety</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Cycle Detection</Label>
                        <p className="text-xs text-slate-400">Prevent dependency deadlocks</p>
                      </div>
                      <Switch
                        checked={config?.enableCycleDetection ?? true}
                        onCheckedChange={(checked) => updateConfigMutation.mutate({ enableCycleDetection: checked })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </GlassCard>
        </TabsContent>
      </Tabs>

      {/* Invalidate Dialog */}
      <Dialog open={invalidateDialogOpen} onOpenChange={setInvalidateDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle>Invalidate Decision</DialogTitle>
            <DialogDescription>
              This will mark the decision as invalid and notify affected agents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Question</Label>
              <p className="text-sm text-slate-300 mt-1">{selectedDecision?.question}</p>
            </div>
            <div>
              <Label>Current Answer</Label>
              <p className="text-sm text-slate-300 mt-1">{selectedDecision?.answer}</p>
            </div>
            <div className="space-y-2">
              <Label>Reason for Invalidation</Label>
              <Textarea
                value={invalidateReason}
                onChange={(e) => setInvalidateReason(e.target.value)}
                placeholder="Why is this answer invalid?"
                className="bg-slate-800/50"
              />
            </div>
            <div className="space-y-2">
              <Label>New Answer (optional)</Label>
              <Textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Provide corrected answer"
                className="bg-slate-800/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvalidateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedDecision) {
                  invalidateMutation.mutate({
                    decisionId: selectedDecision.id,
                    reason: invalidateReason,
                    newAnswer: newAnswer || undefined,
                  });
                }
              }}
              disabled={!invalidateReason || invalidateMutation.isPending}
            >
              {invalidateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Invalidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
