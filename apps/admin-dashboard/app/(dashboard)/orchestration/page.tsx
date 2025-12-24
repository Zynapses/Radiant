'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Brain, 
  Workflow, 
  Layers,
  RefreshCw,
  Search,
  Star,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';

interface PatternCategory {
  id: string;
  name: string;
  description: string;
  pattern_count: number;
}

interface WorkflowCategory {
  id: string;
  name: string;
  description: string;
  workflow_count: number;
}

interface Pattern {
  id: string;
  name: string;
  description: string;
  execution_type: string;
  usage_count: number;
  avg_satisfaction: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  execution_count: number;
  avg_quality_score: number;
}

export default function OrchestrationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatternCategory, setSelectedPatternCategory] = useState<string | null>(null);
  const [selectedWorkflowCategory, setSelectedWorkflowCategory] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: patternCategories } = useQuery<PatternCategory[]>({
    queryKey: ['orchestration', 'pattern-categories'],
    queryFn: async () => {
      const res = await apiClient.get<{ categories: PatternCategory[] }>('/orchestration/pattern-categories');
      return res.data.categories;
    },
  });

  const { data: workflowCategories } = useQuery<WorkflowCategory[]>({
    queryKey: ['orchestration', 'workflow-categories'],
    queryFn: async () => {
      const res = await apiClient.get<{ categories: WorkflowCategory[] }>('/orchestration/workflow-categories');
      return res.data.categories;
    },
  });

  const { data: patterns } = useQuery<Pattern[]>({
    queryKey: ['orchestration', 'patterns', selectedPatternCategory],
    queryFn: async () => {
      if (!selectedPatternCategory) return [];
      const res = await apiClient.get<{ patterns: Pattern[] }>(`/orchestration/patterns/${selectedPatternCategory}`);
      return res.data.patterns;
    },
    enabled: !!selectedPatternCategory,
  });

  const { data: workflows } = useQuery<Workflow[]>({
    queryKey: ['orchestration', 'workflows', selectedWorkflowCategory],
    queryFn: async () => {
      if (!selectedWorkflowCategory) return [];
      const res = await apiClient.get<{ workflows: Workflow[] }>(`/orchestration/workflows/${selectedWorkflowCategory}`);
      return res.data.workflows;
    },
    enabled: !!selectedWorkflowCategory,
  });

  const totalPatterns = patternCategories?.reduce((sum, c) => sum + c.pattern_count, 0) ?? 0;
  const totalWorkflows = workflowCategories?.reduce((sum, c) => sum + c.workflow_count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orchestration</h1>
          <p className="text-muted-foreground">
            Neural patterns and production workflows
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['orchestration'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patterns</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatterns}</div>
            <p className="text-xs text-muted-foreground">
              In {patternCategories?.length ?? 0} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWorkflows}</div>
            <p className="text-xs text-muted-foreground">
              In {workflowCategories?.length ?? 0} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neural Selection</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground">AI-powered matching</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="patterns">
        <TabsList>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patternCategories?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedPatternCategory === cat.id ? 'default' : 'ghost'}
                    className="w-full justify-between"
                    onClick={() => setSelectedPatternCategory(cat.id)}
                  >
                    <span>{cat.name}</span>
                    <Badge variant="secondary">{cat.pattern_count}</Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>
                  {patternCategories?.find(c => c.id === selectedPatternCategory)?.name || 'Select a category'}
                </CardTitle>
                <CardDescription>
                  {patternCategories?.find(c => c.id === selectedPatternCategory)?.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedPatternCategory ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pattern</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Satisfaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patterns?.map((pattern) => (
                        <TableRow key={pattern.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pattern.name}</p>
                              <p className="text-xs text-muted-foreground">{pattern.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{pattern.execution_type}</Badge>
                          </TableCell>
                          <TableCell>{pattern.usage_count.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              {(pattern.avg_satisfaction * 100).toFixed(0)}%
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a category to view patterns
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workflowCategories?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedWorkflowCategory === cat.id ? 'default' : 'ghost'}
                    className="w-full justify-between"
                    onClick={() => setSelectedWorkflowCategory(cat.id)}
                  >
                    <span>{cat.name}</span>
                    <Badge variant="secondary">{cat.workflow_count}</Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>
                  {workflowCategories?.find(c => c.id === selectedWorkflowCategory)?.name || 'Select a category'}
                </CardTitle>
                <CardDescription>
                  {workflowCategories?.find(c => c.id === selectedWorkflowCategory)?.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedWorkflowCategory ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Executions</TableHead>
                        <TableHead>Quality Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workflows?.map((workflow) => (
                        <TableRow key={workflow.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{workflow.name}</p>
                              <p className="text-xs text-muted-foreground">{workflow.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>{workflow.execution_count.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              {(workflow.avg_quality_score * 100).toFixed(0)}%
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a category to view workflows
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
