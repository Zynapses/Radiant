'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  FlaskConical, 
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Save,
  Eye,
  Lightbulb,
} from 'lucide-react';

interface EmpiricismConfig {
  enabled: boolean;
  prediction_threshold: number;
  surprise_threshold: number;
  learning_candidate_threshold: number;
  auto_create_learning_candidates: boolean;
  max_predictions_per_conversation: number;
}

interface PredictionStats {
  total_predictions: number;
  accurate_predictions: number;
  accuracy_rate: number;
  high_surprise_count: number;
  learning_candidates_created: number;
}

interface RecentPrediction {
  id: string;
  conversation_id: string;
  predicted_outcome: string;
  actual_outcome: string;
  surprise_level: number;
  created_at: string;
}

async function fetchDashboard() {
  const res = await fetch('/api/admin/empiricism/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function updateConfig(config: Partial<EmpiricismConfig>) {
  const res = await fetch('/api/admin/empiricism/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update config');
}

export default function EmpiricismPage() {
  const queryClient = useQueryClient();
  const [editedConfig, setEditedConfig] = useState<Partial<EmpiricismConfig>>({});

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['empiricism-dashboard'],
    queryFn: fetchDashboard,
  });

  const updateMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empiricism-dashboard'] });
      toast.success('Configuration saved');
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  const config: EmpiricismConfig = dashboard?.config || {};
  const stats: PredictionStats = dashboard?.stats || {};
  const recentPredictions: RecentPrediction[] = dashboard?.recent_predictions || [];

  const getValue = <K extends keyof EmpiricismConfig>(key: K): EmpiricismConfig[K] => {
    return (editedConfig[key] ?? config[key]) as EmpiricismConfig[K];
  };

  const setValue = <K extends keyof EmpiricismConfig>(key: K, value: EmpiricismConfig[K]) => {
    setEditedConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate({ ...config, ...editedConfig });
  };

  const getSurpriseColor = (level: number) => {
    if (level > 0.7) return 'text-red-500';
    if (level > 0.4) return 'text-orange-500';
    return 'text-green-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="h-8 w-8" />
            Empiricism Loop
          </h1>
          <p className="text-muted-foreground mt-1">
            Reality-testing circuit with Active Inference and predictive coding
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Predictions</CardDescription>
            <CardTitle className="text-3xl">{stats.total_predictions?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Accuracy Rate</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {((stats.accuracy_rate || 0) * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(stats.accuracy_rate || 0) * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Surprise Events</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{stats.high_surprise_count || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Learning Candidates</CardDescription>
            <CardTitle className="text-3xl text-blue-500">{stats.learning_candidates_created || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions">Recent Predictions</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Active Inference Pipeline
                </CardTitle>
                <CardDescription>
                  How the empiricism loop processes interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: 1, name: 'Generate Prediction', desc: 'Predict outcome before responding' },
                    { step: 2, name: 'Deliver Response', desc: 'Send response to user' },
                    { step: 3, name: 'Observe Outcome', desc: 'Measure actual user reaction' },
                    { step: 4, name: 'Calculate Surprise', desc: 'Compare prediction vs reality' },
                    { step: 5, name: 'Create Learning Signal', desc: 'High surprise → learning candidate' },
                  ].map(({ step, name, desc }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {step}
                      </div>
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-sm text-muted-foreground">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Prediction Outcomes
                </CardTitle>
                <CardDescription>
                  Types of outcomes the system predicts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { outcome: 'satisfied', desc: 'User is satisfied with response', color: 'bg-green-500' },
                    { outcome: 'confused', desc: 'User needs clarification', color: 'bg-yellow-500' },
                    { outcome: 'follow_up', desc: 'User asks follow-up question', color: 'bg-blue-500' },
                    { outcome: 'correction', desc: 'User corrects the AI', color: 'bg-orange-500' },
                    { outcome: 'abandonment', desc: 'User leaves conversation', color: 'bg-red-500' },
                    { outcome: 'neutral', desc: 'No strong signal', color: 'bg-gray-500' },
                  ].map(({ outcome, desc, color }) => (
                    <div key={outcome} className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${color}`} />
                      <span className="font-medium capitalize">{outcome}</span>
                      <span className="text-sm text-muted-foreground">- {desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Predictions</CardTitle>
              <CardDescription>Latest prediction/observation pairs</CardDescription>
            </CardHeader>
            <CardContent>
              {recentPredictions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No predictions recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conversation</TableHead>
                      <TableHead>Predicted</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Surprise</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPredictions.map((pred) => (
                      <TableRow key={pred.id}>
                        <TableCell className="font-mono text-sm">
                          {pred.conversation_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{pred.predicted_outcome}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{pred.actual_outcome}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={getSurpriseColor(pred.surprise_level)}>
                            {(pred.surprise_level * 100).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {pred.predicted_outcome === pred.actual_outcome ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(pred.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Empiricism Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Empiricism Loop</Label>
                  <p className="text-sm text-muted-foreground">Activate predictive coding</p>
                </div>
                <Switch
                  checked={getValue('enabled')}
                  onCheckedChange={(v) => setValue('enabled', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Create Learning Candidates</Label>
                  <p className="text-sm text-muted-foreground">Automatically flag high-surprise events</p>
                </div>
                <Switch
                  checked={getValue('auto_create_learning_candidates')}
                  onCheckedChange={(v) => setValue('auto_create_learning_candidates', v)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Surprise Threshold</Label>
                  <span className="text-sm font-mono">{((getValue('surprise_threshold') || 0.5) * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[(getValue('surprise_threshold') || 0.5) * 100]}
                  onValueChange={([v]) => setValue('surprise_threshold', v / 100)}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Events with surprise above this threshold trigger learning
                </p>
              </div>

              <div className="space-y-2">
                <Label>Max Predictions per Conversation</Label>
                <Input
                  type="number"
                  value={getValue('max_predictions_per_conversation') || 10}
                  onChange={(e) => setValue('max_predictions_per_conversation', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
