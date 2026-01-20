'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Bot,
  Zap,
  AppWindow,
  Eye,
  CheckCircle,
  AlertTriangle,
  Activity,
  TrendingUp,
  Clock,
  DollarSign,
  RefreshCw,
  Settings,
  Play,
  Pause,
  XCircle,
} from 'lucide-react';

interface DashboardData {
  agents: {
    total_agents: number;
    custom_agents: number;
  };
  executions: {
    total_executions: number;
    completed: number;
    running: number;
    failed: number;
    total_cost: number;
  };
  pendingApprovals: number;
  connectedApps: number;
  aiHelperToday: {
    total_calls: number;
    cached_calls: number;
    total_cost_usd: number;
  };
}

interface Agent {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  execution_mode: string;
  safety_profile: string;
  requires_hitl: boolean;
  is_active: boolean;
}

interface Execution {
  id: string;
  agent_id: string;
  goal: string;
  status: string;
  current_phase: string;
  current_iteration: number;
  budget_allocated: number;
  budget_consumed: number;
  created_at: string;
}

interface Approval {
  id: string;
  queue_name: string;
  request_type: string;
  request_summary: string;
  priority: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export default function SovereignMeshPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, agentsRes, execRes, approvalsRes] = await Promise.all([
        fetch('/api/admin/sovereign-mesh/dashboard'),
        fetch('/api/admin/sovereign-mesh/agents'),
        fetch('/api/admin/sovereign-mesh/executions?limit=10'),
        fetch('/api/admin/sovereign-mesh/approvals?status=pending&limit=10'),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
      if (execRes.ok) {
        const data = await execRes.json();
        setExecutions(data.executions || []);
      }
      if (approvalsRes.ok) {
        const data = await approvalsRes.json();
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      research: 'bg-blue-100 text-blue-800',
      coding: 'bg-purple-100 text-purple-800',
      data: 'bg-green-100 text-green-800',
      outreach: 'bg-orange-100 text-orange-800',
      creative: 'bg-pink-100 text-pink-800',
      operations: 'bg-cyan-100 text-cyan-800',
      custom: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.custom;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800',
    };
    return colors[priority] || colors.normal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sovereign Mesh</h1>
          <p className="text-muted-foreground">
            Every Node Thinks. Every Connection Learns. Every Workflow Assembles Itself.
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.agents?.total_agents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.agents?.custom_agents || 0} custom agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.executions?.total_executions || 0}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">{dashboard?.executions?.completed || 0} completed</span>
              <span className="text-blue-600">{dashboard?.executions?.running || 0} running</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requires human review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Helper Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(dashboard?.aiHelperToday?.total_cost_usd || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.aiHelperToday?.total_calls || 0} calls today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Executions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
                <CardDescription>Latest agent activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {executions.slice(0, 5).map((exec) => (
                    <div key={exec.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(exec.status)}
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{exec.goal}</p>
                          <p className="text-xs text-muted-foreground">
                            Phase: {exec.current_phase} • Iteration {exec.current_iteration}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${exec.budget_consumed?.toFixed(2) || '0.00'}</p>
                        <p className="text-xs text-muted-foreground">
                          of ${exec.budget_allocated?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {executions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent executions</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pending Approvals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Approvals</CardTitle>
                <CardDescription>Requests awaiting human review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvals.slice(0, 5).map((approval) => (
                    <div key={approval.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{approval.request_summary}</p>
                          <p className="text-xs text-muted-foreground">{approval.queue_name}</p>
                        </div>
                      </div>
                      <Badge className={getPriorityColor(approval.priority)}>{approval.priority}</Badge>
                    </div>
                  ))}
                  {approvals.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No pending approvals</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Agent Registry</CardTitle>
                <CardDescription>Autonomous agents with OODA-loop execution</CardDescription>
              </div>
              <Button size="sm">
                <Bot className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{agent.display_name}</p>
                          <Badge className={getCategoryColor(agent.category)}>{agent.category}</Badge>
                          {agent.requires_hitl && (
                            <Badge variant="outline" className="text-xs">HITL</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{agent.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{agent.safety_profile}</Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Executions</CardTitle>
              <CardDescription>Track and manage running agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {executions.map((exec) => (
                  <div key={exec.id} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(exec.status)}
                        <div>
                          <p className="font-medium">{exec.goal}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(exec.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{exec.status}</Badge>
                        {exec.status === 'running' && (
                          <Button variant="ghost" size="sm">
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {exec.status === 'paused' && (
                          <Button variant="ghost" size="sm">
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>Phase: <strong>{exec.current_phase}</strong></span>
                      <span>Iteration: <strong>{exec.current_iteration}</strong></span>
                      <span>Budget: <strong>${exec.budget_consumed?.toFixed(2)} / ${exec.budget_allocated?.toFixed(2)}</strong></span>
                    </div>
                    <Progress 
                      value={(exec.budget_consumed / exec.budget_allocated) * 100} 
                      className="mt-2 h-2" 
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HITL Approval Queue</CardTitle>
              <CardDescription>Human-in-the-loop approval requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <div key={approval.id} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="font-medium">{approval.request_summary}</p>
                          <p className="text-sm text-muted-foreground">
                            {approval.queue_name} • {approval.request_type}
                          </p>
                        </div>
                      </div>
                      <Badge className={getPriorityColor(approval.priority)}>{approval.priority}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(approval.expires_at).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        <Button variant="default" size="sm">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm">
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {approvals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No pending approval requests</p>
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
