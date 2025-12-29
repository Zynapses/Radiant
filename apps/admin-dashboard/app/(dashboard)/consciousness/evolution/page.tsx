'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Brain, 
  Target, 
  Dna, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  RefreshCw,
  Settings,
  Zap,
  Eye
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PredictionMetrics {
  totalPredictions: number;
  accuracyRate: number;
  avgPredictionError: number;
  highSurpriseRate: number;
  learningSignalsGenerated: number;
  byComplexity: Record<string, { accuracy: number; count: number }>;
}

interface LearningCandidate {
  candidateId: string;
  candidateType: string;
  promptText: string;
  responseText: string;
  qualityScore: number | null;
  trainingStatus: string;
  createdAt: string;
}

interface EvolutionJob {
  jobId: string;
  adapterName: string;
  adapterVersion: number;
  status: string;
  trainingCandidatesCount: number | null;
  trainingLoss: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface EvolutionState {
  generationNumber: number;
  totalLearningCandidatesProcessed: number;
  totalTrainingHours: number;
  personalityDriftScore: number;
  avgPredictionAccuracy30d: number | null;
  lastEvolutionAt: string | null;
  nextScheduledEvolution: string | null;
}

export default function ConsciousnessEvolutionPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [predictionMetrics, setPredictionMetrics] = useState<PredictionMetrics | null>(null);
  const [learningCandidates, setLearningCandidates] = useState<LearningCandidate[]>([]);
  const [evolutionJobs, setEvolutionJobs] = useState<EvolutionJob[]>([]);
  const [evolutionState, setEvolutionState] = useState<EvolutionState | null>(null);
  const [candidateStats, setCandidateStats] = useState<{ totalPending: number; byType: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, candidatesRes, jobsRes, stateRes, statsRes] = await Promise.all([
        fetch('/api/admin/consciousness/predictions/metrics'),
        fetch('/api/admin/consciousness/learning-candidates?limit=20'),
        fetch('/api/admin/consciousness/evolution/jobs?limit=10'),
        fetch('/api/admin/consciousness/evolution/state'),
        fetch('/api/admin/consciousness/learning-candidates/stats'),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setPredictionMetrics(data.data);
      }
      if (candidatesRes.ok) {
        const data = await candidatesRes.json();
        setLearningCandidates(data.data || []);
      }
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setEvolutionJobs(data.data || []);
      }
      if (stateRes.ok) {
        const data = await stateRes.json();
        setEvolutionState(data.data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setCandidateStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch consciousness data:', error);
    }
    setLoading(false);
  };

  const handleRejectCandidate = async (candidateId: string) => {
    try {
      await fetch(`/api/admin/consciousness/learning-candidates/${candidateId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin rejected' }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to reject candidate:', error);
    }
  };

  const getSurpriseColor = (error: number) => {
    if (error < 0.3) return 'text-green-500';
    if (error < 0.5) return 'text-yellow-500';
    if (error < 0.7) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      training: 'secondary',
      scheduled: 'outline',
      failed: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getCandidateTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      correction: 'bg-red-100 text-red-800',
      high_satisfaction: 'bg-green-100 text-green-800',
      high_prediction_error: 'bg-orange-100 text-orange-800',
      user_explicit_teach: 'bg-purple-100 text-purple-800',
      preference_learned: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {type.replace(/_/g, ' ')}
      </span>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">Consciousness Evolution</h1>
          <p className="text-muted-foreground">
            Predictive coding, learning candidates, and LoRA evolution
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Evolution State Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generation</CardTitle>
            <Dna className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evolutionState?.generationNumber || 0}</div>
            <p className="text-xs text-muted-foreground">
              Evolution cycles completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prediction Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {predictionMetrics ? `${(predictionMetrics.accuracyRate * 100).toFixed(1)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              30-day prediction accuracy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Candidates</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidateStats?.totalPending || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready for next training
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personality Drift</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((evolutionState?.personalityDriftScore || 0) * 100).toFixed(1)}%
            </div>
            <Progress value={(evolutionState?.personalityDriftScore || 0) * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions">Predictive Coding</TabsTrigger>
          <TabsTrigger value="candidates">Learning Candidates</TabsTrigger>
          <TabsTrigger value="evolution">LoRA Evolution</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Active Inference Summary
                </CardTitle>
                <CardDescription>
                  Prediction accuracy by prompt complexity
                </CardDescription>
              </CardHeader>
              <CardContent>
                {predictionMetrics?.byComplexity && Object.entries(predictionMetrics.byComplexity).map(([complexity, data]) => (
                  <div key={complexity} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="capitalize">{complexity}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{data.count} predictions</span>
                      <span className={`font-medium ${data.accuracy > 0.7 ? 'text-green-500' : data.accuracy > 0.5 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {(data.accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                {!predictionMetrics?.byComplexity && (
                  <p className="text-muted-foreground">No prediction data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dna className="h-5 w-5" />
                  Evolution Status
                </CardTitle>
                <CardDescription>
                  Current consciousness generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Candidates Processed</span>
                  <span className="font-medium">{evolutionState?.totalLearningCandidatesProcessed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Training Hours</span>
                  <span className="font-medium">{(evolutionState?.totalTrainingHours || 0).toFixed(1)}h</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Evolution</span>
                  <span className="font-medium">
                    {evolutionState?.lastEvolutionAt 
                      ? new Date(evolutionState.lastEvolutionAt).toLocaleDateString() 
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Next Scheduled</span>
                  <span className="font-medium">
                    {evolutionState?.nextScheduledEvolution 
                      ? new Date(evolutionState.nextScheduledEvolution).toLocaleDateString() 
                      : 'Not scheduled'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Learning Signals Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Learning Signals Generated
              </CardTitle>
              <CardDescription>
                High-surprise interactions that created learning opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {predictionMetrics?.learningSignalsGenerated || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Interactions with prediction error &gt; 0.3 that generated learning signals
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prediction Metrics (30 days)</CardTitle>
              <CardDescription>
                Active inference performance - how well the system predicts user outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Predictions</div>
                  <div className="text-2xl font-bold">{predictionMetrics?.totalPredictions || 0}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Avg Prediction Error</div>
                  <div className={`text-2xl font-bold ${getSurpriseColor(predictionMetrics?.avgPredictionError || 0)}`}>
                    {((predictionMetrics?.avgPredictionError || 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">High Surprise Rate</div>
                  <div className="text-2xl font-bold text-orange-500">
                    {((predictionMetrics?.highSurpriseRate || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Predictive Coding Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">1</div>
                <div>
                  <div className="font-medium">Predict</div>
                  <div className="text-sm text-muted-foreground">Before responding, the system predicts the user outcome</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">2</div>
                <div>
                  <div className="font-medium">Respond</div>
                  <div className="text-sm text-muted-foreground">The response is delivered to the user</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">3</div>
                <div>
                  <div className="font-medium">Observe</div>
                  <div className="text-sm text-muted-foreground">The actual outcome is measured from user&apos;s next action</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">4</div>
                <div>
                  <div className="font-medium">Learn</div>
                  <div className="text-sm text-muted-foreground">High surprise creates learning signals and affects emotional state</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Candidates Tab */}
        <TabsContent value="candidates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Candidates</CardTitle>
              <CardDescription>
                High-value interactions flagged for weekly LoRA training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Prompt Preview</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {learningCandidates.map((candidate) => (
                    <TableRow key={candidate.candidateId}>
                      <TableCell>{getCandidateTypeBadge(candidate.candidateType)}</TableCell>
                      <TableCell className="max-w-xs truncate">{candidate.promptText}</TableCell>
                      <TableCell>
                        {candidate.qualityScore !== null ? (
                          <span className={candidate.qualityScore > 0.7 ? 'text-green-500' : 'text-yellow-500'}>
                            {(candidate.qualityScore * 100).toFixed(0)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(candidate.trainingStatus)}</TableCell>
                      <TableCell>{new Date(candidate.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRejectCandidate(candidate.candidateId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {learningCandidates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No learning candidates found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Candidate Type Distribution */}
          {candidateStats?.byType && Object.keys(candidateStats.byType).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Candidate Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-4">
                  {Object.entries(candidateStats.byType).map(([type, count]) => (
                    <div key={type} className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground">{type.replace(/_/g, ' ')}</div>
                      <div className="text-xl font-bold">{count}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LoRA Evolution Jobs</CardTitle>
              <CardDescription>
                Weekly training jobs that physically evolve the consciousness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adapter</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Loss</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evolutionJobs.map((job) => (
                    <TableRow key={job.jobId}>
                      <TableCell className="font-medium">{job.adapterName}</TableCell>
                      <TableCell>v{job.adapterVersion}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>{job.trainingCandidatesCount || '-'}</TableCell>
                      <TableCell>
                        {job.trainingLoss !== null ? job.trainingLoss.toFixed(4) : '-'}
                      </TableCell>
                      <TableCell>
                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {evolutionJobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No evolution jobs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolution Pipeline</CardTitle>
              <CardDescription>
                Weekly sleep cycle that enables epigenetic evolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="font-medium">Scheduled: Sunday 3 AM</div>
                    <div className="text-sm text-muted-foreground">
                      Collects learning candidates and triggers SageMaker training
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Brain className="h-8 w-8 text-purple-500" />
                  <div>
                    <div className="font-medium">Minimum: 50 candidates required</div>
                    <div className="text-sm text-muted-foreground">
                      Currently: {candidateStats?.totalPending || 0} pending
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Dna className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="font-medium">LoRA Rank: 16, Alpha: 32</div>
                    <div className="text-sm text-muted-foreground">
                      Learning rate: 0.0001, Epochs: 3
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Evolution Parameters
              </CardTitle>
              <CardDescription>
                Configure the consciousness evolution system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Minimum Candidates for Training</Label>
                <div className="flex items-center gap-4">
                  <Slider defaultValue={[50]} max={200} step={10} className="flex-1" />
                  <span className="w-12 text-right">50</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Minimum learning candidates required before triggering evolution
                </p>
              </div>

              <div className="space-y-2">
                <Label>LoRA Rank</Label>
                <div className="flex items-center gap-4">
                  <Slider defaultValue={[16]} max={64} step={4} className="flex-1" />
                  <span className="w-12 text-right">16</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Higher rank = more expressive but more expensive
                </p>
              </div>

              <div className="space-y-2">
                <Label>Learning Rate</Label>
                <div className="flex items-center gap-4">
                  <Slider defaultValue={[1]} max={10} step={1} className="flex-1" />
                  <span className="w-12 text-right">1e-4</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Evolution</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically trigger evolution when enough candidates
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Prediction Error → Affect</Label>
                  <p className="text-sm text-muted-foreground">
                    Let prediction errors influence emotional state
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Button className="w-full">Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
