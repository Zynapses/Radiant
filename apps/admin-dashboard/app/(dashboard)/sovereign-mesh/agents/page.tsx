'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Bot,
  Plus,
  Search,
  Settings,
  Play,
  Trash2,
  RefreshCw,
  Brain,
  Code,
  Database,
  Mail,
  Pencil,
  Zap,
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  execution_mode: string;
  max_iterations: number;
  default_timeout_minutes: number;
  default_budget_usd: number;
  max_budget_usd: number;
  safety_profile: string;
  requires_hitl: boolean;
  is_active: boolean;
  scope: string;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  research: <Brain className="h-5 w-5" />,
  coding: <Code className="h-5 w-5" />,
  data: <Database className="h-5 w-5" />,
  outreach: <Mail className="h-5 w-5" />,
  creative: <Pencil className="h-5 w-5" />,
  operations: <Zap className="h-5 w-5" />,
  custom: <Bot className="h-5 w-5" />,
};

export default function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    displayName: '',
    description: '',
    category: 'custom',
    executionMode: 'async',
    maxIterations: 50,
    defaultTimeoutMinutes: 30,
    defaultBudgetUsd: 1,
    maxBudgetUsd: 10,
    safetyProfile: 'standard',
    requiresHitl: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsRes, categoriesRes] = await Promise.all([
        fetch(`/api/admin/sovereign-mesh/agents${categoryFilter !== 'all' ? `?category=${categoryFilter}` : ''}`),
        fetch('/api/admin/sovereign-mesh/agents/categories'),
      ]);

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateAgent = async () => {
    try {
      const response = await fetch('/api/admin/sovereign-mesh/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });

      if (response.ok) {
        setIsCreateOpen(false);
        setNewAgent({
          name: '',
          displayName: '',
          description: '',
          category: 'custom',
          executionMode: 'async',
          maxIterations: 50,
          defaultTimeoutMinutes: 30,
          defaultBudgetUsd: 1,
          maxBudgetUsd: 10,
          safetyProfile: 'standard',
          requiresHitl: false,
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to deactivate this agent?')) return;

    try {
      await fetch(`/api/admin/sovereign-mesh/agents/${agentId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleStartExecution = async (agentId: string) => {
    const goal = prompt('Enter the goal for this agent:');
    if (!goal) return;

    try {
      const response = await fetch('/api/admin/sovereign-mesh/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, goal }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Execution Started',
          description: `Agent execution ${data.executionId} has been initiated.`,
        });
      } else {
        toast({
          title: 'Execution Failed',
          description: 'Failed to start agent execution.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to start execution:', error);
      toast({
        title: 'Execution Failed',
        description: 'An error occurred while starting execution.',
        variant: 'destructive',
      });
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold">Agent Registry</h1>
          <p className="text-muted-foreground">
            Manage autonomous agents with OODA-loop execution
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Define a new autonomous agent with custom capabilities
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name (ID)</Label>
                  <Input
                    id="name"
                    placeholder="my-custom-agent"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="My Custom Agent"
                    value={newAgent.displayName}
                    onChange={(e) => setNewAgent({ ...newAgent, displayName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this agent does..."
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={newAgent.category}
                    onValueChange={(value) => setNewAgent({ ...newAgent, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Safety Profile</Label>
                  <Select
                    value={newAgent.safetyProfile}
                    onValueChange={(value) => setNewAgent({ ...newAgent, safetyProfile: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permissive">Permissive</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="strict">Strict</SelectItem>
                      <SelectItem value="paranoid">Paranoid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Iterations</Label>
                  <Input
                    type="number"
                    value={newAgent.maxIterations}
                    onChange={(e) => setNewAgent({ ...newAgent, maxIterations: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (min)</Label>
                  <Input
                    type="number"
                    value={newAgent.defaultTimeoutMinutes}
                    onChange={(e) => setNewAgent({ ...newAgent, defaultTimeoutMinutes: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Budget ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAgent.maxBudgetUsd}
                    onChange={(e) => setNewAgent({ ...newAgent, maxBudgetUsd: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requiresHitl"
                  checked={newAgent.requiresHitl}
                  onCheckedChange={(checked) => setNewAgent({ ...newAgent, requiresHitl: checked })}
                />
                <Label htmlFor="requiresHitl">Requires HITL Approval</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAgent}>Create Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => (
          <Card key={agent.id} className={!agent.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {categoryIcons[agent.category] || <Bot className="h-5 w-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.display_name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getCategoryColor(agent.category)}>{agent.category}</Badge>
                      {agent.requires_hitl && (
                        <Badge variant="outline" className="text-xs">HITL</Badge>
                      )}
                      {agent.scope === 'system' && (
                        <Badge variant="secondary" className="text-xs">Built-in</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">{agent.description}</CardDescription>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-4">
                <div>Max Iterations: {agent.max_iterations}</div>
                <div>Timeout: {agent.default_timeout_minutes}min</div>
                <div>Budget: ${agent.default_budget_usd} - ${agent.max_budget_usd}</div>
                <div>Safety: {agent.safety_profile}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="flex-1" onClick={() => handleStartExecution(agent.id)}>
                  <Play className="h-4 w-4 mr-1" />
                  Run
                </Button>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
                {agent.scope === 'tenant' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => handleDeleteAgent(agent.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No agents found</p>
          <p className="text-sm">Create a new agent to get started</p>
        </div>
      )}
    </div>
  );
}
