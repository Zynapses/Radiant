'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Plus,
  Play,
  Settings2,
  Workflow,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggerType: 'manual' | 'scheduled' | 'event' | 'webhook';
  triggerConfig: Record<string, unknown>;
  steps: WorkflowStep[];
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'ai_call' | 'condition' | 'transform' | 'http' | 'notification';
  config: Record<string, unknown>;
  order: number;
}

interface WorkflowStats {
  totalWorkflows: number;
  activeWorkflows: number;
  executionsToday: number;
  successRate: number;
}

export default function WorkflowsPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: workflows, isLoading } = useQuery<{ data: WorkflowDefinition[] }>({
    queryKey: ['orchestration-workflows', search],
    queryFn: () =>
      fetch(`/api/admin/orchestration/workflows?search=${search}`).then((r) => r.json()),
  });

  const { data: stats } = useQuery<WorkflowStats>({
    queryKey: ['orchestration-stats'],
    queryFn: () => fetch('/api/admin/orchestration/stats').then((r) => r.json()),
  });

  const toggleWorkflowMutation = useMutation({
    mutationFn: (params: { id: string; isActive: boolean }) =>
      fetch(`/api/admin/orchestration/workflows/${params.id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: params.isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration-workflows'] });
    },
  });

  const getTriggerBadge = (type: WorkflowDefinition['triggerType']) => {
    switch (type) {
      case 'manual':
        return <Badge variant="outline">Manual</Badge>;
      case 'scheduled':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'event':
        return <Badge variant="default">Event</Badge>;
      case 'webhook':
        return <Badge className="bg-purple-500">Webhook</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Workflow Registry</h1>
          <p className="text-muted-foreground">
            Database-driven orchestration workflows
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalWorkflows || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.activeWorkflows || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Executions Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.executionsToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.successRate || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                (workflows?.data || []).map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{workflow.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {workflow.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTriggerBadge(workflow.triggerType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{workflow.steps.length} steps</Badge>
                    </TableCell>
                    <TableCell>{workflow.executionCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {workflow.lastExecutedAt ? (
                        formatDistanceToNow(new Date(workflow.lastExecutedAt), {
                          addSuffix: true,
                        })
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={workflow.isActive}
                        onCheckedChange={(checked) =>
                          toggleWorkflowMutation.mutate({
                            id: workflow.id,
                            isActive: checked,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
