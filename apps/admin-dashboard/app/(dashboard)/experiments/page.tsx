'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Play,
  Pause,
  BarChart2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Beaker,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: ExperimentVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  sampleSize?: number;
}

interface ExperimentResult {
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  uplift: number;
  controlMean: number;
  treatmentMean: number;
  recommendation: string;
}

interface ExperimentStats {
  totalExperiments: number;
  runningExperiments: number;
  completedExperiments: number;
  averageUplift: number;
}

export default function ExperimentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: experiments, isLoading } = useQuery<{ data: Experiment[] }>({
    queryKey: ['experiments', search, statusFilter],
    queryFn: () =>
      fetch(
        `/api/admin/experiments?search=${search}&status=${statusFilter === 'all' ? '' : statusFilter}`
      ).then((r) => r.json()),
  });

  const { data: stats } = useQuery<ExperimentStats>({
    queryKey: ['experiment-stats'],
    queryFn: () => fetch('/api/admin/experiments/stats').then((r) => r.json()),
  });

  const { data: results } = useQuery<{ results: Record<string, ExperimentResult> }>({
    queryKey: ['experiment-results', selectedExperiment],
    queryFn: () =>
      fetch(`/api/experiments/${selectedExperiment}/results`).then((r) => r.json()),
    enabled: !!selectedExperiment,
  });

  const toggleExperimentMutation = useMutation({
    mutationFn: (params: { id: string; status: string }) =>
      fetch(`/api/admin/experiments/${params.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: params.status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });

  const getStatusBadge = (status: Experiment['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'running':
        return <Badge className="bg-green-500">Running</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500">Paused</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">
            Experiment framework with statistical analysis
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Experiments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalExperiments || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.runningExperiments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedExperiments || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Uplift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats?.averageUplift ? (
                <>
                  {stats.averageUplift > 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  {Math.abs(stats.averageUplift).toFixed(1)}%
                </>
              ) : (
                '—'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Experiments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search experiments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Experiment</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sample Size</TableHead>
                <TableHead>Started</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                (experiments?.data || []).map((experiment) => {
                  const totalSampleSize = experiment.variants.reduce(
                    (sum, v) => sum + (v.sampleSize || 0),
                    0
                  );

                  return (
                    <TableRow key={experiment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Beaker className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{experiment.name}</div>
                            <div className="text-xs text-muted-foreground max-w-[300px] truncate">
                              {experiment.hypothesis}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {experiment.variants.map((variant) => (
                            <Badge key={variant.id} variant="outline" className="text-xs">
                              {variant.name} ({Math.round(variant.weight * 100)}%)
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(experiment.status)}</TableCell>
                      <TableCell>{totalSampleSize.toLocaleString()}</TableCell>
                      <TableCell>
                        {experiment.startedAt ? (
                          formatDistanceToNow(new Date(experiment.startedAt), {
                            addSuffix: true,
                          })
                        ) : (
                          <span className="text-muted-foreground">Not started</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {experiment.status === 'running' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleExperimentMutation.mutate({
                                  id: experiment.id,
                                  status: 'paused',
                                })
                              }
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : experiment.status === 'draft' ||
                            experiment.status === 'paused' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleExperimentMutation.mutate({
                                  id: experiment.id,
                                  status: 'running',
                                })
                              }
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedExperiment(experiment.id)}
                              >
                                <BarChart2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Results: {experiment.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {results?.results ? (
                                  Object.entries(results.results).map(
                                    ([variantId, result]) => (
                                      <Card key={variantId}>
                                        <CardContent className="pt-4">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="font-medium">
                                              {experiment.variants.find(
                                                (v) => v.id === variantId
                                              )?.name || variantId}
                                            </div>
                                            {result.isSignificant ? (
                                              <Badge className="bg-green-500">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Significant
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                Not Significant
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                              <div className="text-muted-foreground">
                                                Uplift
                                              </div>
                                              <div
                                                className={`font-medium ${
                                                  result.uplift > 0
                                                    ? 'text-green-600'
                                                    : 'text-red-600'
                                                }`}
                                              >
                                                {result.uplift > 0 ? '+' : ''}
                                                {result.uplift.toFixed(2)}%
                                              </div>
                                            </div>
                                            <div>
                                              <div className="text-muted-foreground">
                                                p-value
                                              </div>
                                              <div className="font-medium">
                                                {result.pValue.toFixed(4)}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="text-muted-foreground">
                                                Confidence
                                              </div>
                                              <div className="font-medium">
                                                {(result.confidenceLevel * 100).toFixed(1)}%
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-3 text-sm text-muted-foreground">
                                            {result.recommendation}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )
                                  )
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    No results available yet. Need more data.
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
