'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FlaskConical,
  Play,
  Pause,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  BarChart3,
  Plus,
  Download,
  Clock,
} from 'lucide-react';

interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: ExperimentVariant[];
  targetAudience: {
    percentage: number;
    filters?: Record<string, unknown>;
  };
  metrics: string[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  results?: ExperimentResults;
}

interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
  sampleSize?: number;
}

interface ExperimentResults {
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  controlMean: number;
  treatmentMean: number;
  uplift: number;
  recommendation: string;
}

const statusColors = {
  draft: 'bg-gray-500',
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
};

const statusIcons = {
  draft: Clock,
  running: Play,
  paused: Pause,
  completed: CheckCircle,
};

export function ExperimentDashboard() {
  const queryClient = useQueryClient();
  const [product, setProduct] = useState<string>('combined');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

  const { data: experiments, isLoading } = useQuery<Experiment[]>({
    queryKey: ['experiments', product, statusFilter],
    queryFn: () => 
      fetch(`/api/experiments?product=${product}&status=${statusFilter}`)
        .then((r) => r.json()),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/experiments/${id}/pause`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experiments'] }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/experiments/${id}/complete`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experiments'] }),
  });

  const runningExperiments = experiments?.filter((e) => e.status === 'running') || [];
  const completedExperiments = experiments?.filter((e) => e.status === 'completed') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">A/B Testing</h2>
          <p className="text-muted-foreground">Run experiments with statistical analysis</p>
        </div>
        <div className="flex gap-2">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="combined">Combined</SelectItem>
              <SelectItem value="radiant">Radiant</SelectItem>
              <SelectItem value="thinktank">Think Tank</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Experiment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Running Experiments</CardDescription>
            <CardTitle className="text-3xl text-green-500">{runningExperiments.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Play className="h-4 w-4" />
              <span>Active tests</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-blue-500">{completedExperiments.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span>Finished tests</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Significant Results</CardDescription>
            <CardTitle className="text-3xl">
              {completedExperiments.filter((e) => e.results?.isSignificant).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>p &lt; 0.05</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Participants</CardDescription>
            <CardTitle className="text-3xl">
              {experiments?.reduce((sum, e) => 
                sum + (e.variants.reduce((vSum, v) => vSum + (v.sampleSize || 0), 0)), 0
              ) || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Users in tests</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running Experiments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Running Experiments
          </CardTitle>
          <CardDescription>Active experiments collecting data</CardDescription>
        </CardHeader>
        <CardContent>
          {runningExperiments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-2" />
              <p>No running experiments</p>
              <Button className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Experiment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {runningExperiments.map((experiment) => (
                <ExperimentCard
                  key={experiment.id}
                  experiment={experiment}
                  onPause={() => pauseMutation.mutate(experiment.id)}
                  onComplete={() => completeMutation.mutate(experiment.id)}
                  onSelect={() => setSelectedExperiment(experiment)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Experiments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Completed Experiments
          </CardTitle>
          <CardDescription>Experiments with final results</CardDescription>
        </CardHeader>
        <CardContent>
          {completedExperiments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>No completed experiments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedExperiments.map((experiment) => (
                <ExperimentCard
                  key={experiment.id}
                  experiment={experiment}
                  onSelect={() => setSelectedExperiment(experiment)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experiment Detail Dialog */}
      <Dialog open={!!selectedExperiment} onOpenChange={() => setSelectedExperiment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedExperiment?.name}</DialogTitle>
            <DialogDescription>{selectedExperiment?.hypothesis}</DialogDescription>
          </DialogHeader>
          {selectedExperiment && (
            <ExperimentDetail experiment={selectedExperiment} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExperimentCard({
  experiment,
  onPause,
  onComplete,
  onSelect,
}: {
  experiment: Experiment;
  onPause?: () => void;
  onComplete?: () => void;
  onSelect: () => void;
}) {
  const StatusIcon = statusIcons[experiment.status];
  const totalSamples = experiment.variants.reduce((sum, v) => sum + (v.sampleSize || 0), 0);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{experiment.name}</h3>
            <Badge className={statusColors[experiment.status]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {experiment.status}
            </Badge>
            {experiment.results?.isSignificant && (
              <Badge variant="outline" className="text-green-500 border-green-500">
                Significant
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{experiment.description}</p>
          
          {/* Variants */}
          <div className="mt-3 space-y-2">
            {experiment.variants.map((variant) => (
              <div key={variant.id} className="flex items-center gap-4">
                <span className="text-sm font-medium w-24">{variant.name}</span>
                <Progress value={variant.weight * 100} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground w-20">
                  {variant.sampleSize || 0} users
                </span>
              </div>
            ))}
          </div>

          {/* Results Preview */}
          {experiment.results && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                {experiment.results.uplift >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                {experiment.results.uplift.toFixed(1)}% uplift
              </span>
              <span className="text-muted-foreground">
                p = {experiment.results.pValue.toFixed(4)}
              </span>
              <span className="text-muted-foreground">
                {(experiment.results.confidenceLevel * 100).toFixed(0)}% confidence
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {experiment.status === 'running' && onPause && (
            <Button variant="outline" size="sm" onClick={onPause}>
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {experiment.status === 'running' && experiment.results?.isSignificant && onComplete && (
            <Button size="sm" onClick={onComplete}>
              Roll Out Winner
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onSelect}>
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExperimentDetail({ experiment }: { experiment: Experiment }) {
  return (
    <div className="space-y-4">
      {/* Hypothesis */}
      <div>
        <h4 className="font-medium mb-1">Hypothesis</h4>
        <p className="text-sm text-muted-foreground">{experiment.hypothesis}</p>
      </div>

      {/* Variants Table */}
      <div>
        <h4 className="font-medium mb-2">Variants</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Variant</th>
                <th className="text-left p-2">Allocation</th>
                <th className="text-left p-2">Sample Size</th>
                <th className="text-left p-2">Mean</th>
              </tr>
            </thead>
            <tbody>
              {experiment.variants.map((variant, i) => (
                <tr key={variant.id} className="border-t">
                  <td className="p-2 font-medium">{variant.name}</td>
                  <td className="p-2">{(variant.weight * 100).toFixed(0)}%</td>
                  <td className="p-2">{variant.sampleSize || 0}</td>
                  <td className="p-2">
                    {i === 0 
                      ? experiment.results?.controlMean.toFixed(3) 
                      : experiment.results?.treatmentMean.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistical Analysis */}
      {experiment.results && (
        <div>
          <h4 className="font-medium mb-2">Statistical Analysis</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">P-Value</div>
              <div className="text-xl font-semibold">
                {experiment.results.pValue.toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">
                {experiment.results.pValue < 0.05 ? '✓ Statistically significant' : 'Not yet significant'}
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Confidence Level</div>
              <div className="text-xl font-semibold">
                {(experiment.results.confidenceLevel * 100).toFixed(1)}%
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Effect Size (Uplift)</div>
              <div className={`text-xl font-semibold ${experiment.results.uplift >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {experiment.results.uplift >= 0 ? '+' : ''}{experiment.results.uplift.toFixed(2)}%
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Recommendation</div>
              <div className="text-sm font-medium">{experiment.results.recommendation}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Results
        </Button>
        {experiment.status === 'completed' && experiment.results?.isSignificant && (
          <Button>Roll Out Winner</Button>
        )}
      </div>
    </div>
  );
}
