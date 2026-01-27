'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Brain,
  TrendingUp,
  Clock,
  Users,
  Layers,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  BarChart3,
  Gauge,
} from 'lucide-react';

interface VOIStatistics {
  totalDecisions: number;
  askDecisions: number;
  skipDecisions: number;
  inferDecisions: number;
  avgVOIScore: number;
  avgActualInfoGain: number;
  priorAccuracy: number;
}

interface AbstentionStatistics {
  totalEvents: number;
  byReason: Record<string, number>;
  byModel: Record<string, number>;
  avgConfidence: number;
  avgSemanticEntropy: number;
}

interface BatchStatistics {
  totalBatches: number;
  avgQuestionsPerBatch: number;
  avgAnswerTime: number;
  completionRate: number;
  byType: Record<string, number>;
}

interface RateLimitStatus {
  globalUsage: { current: number; max: number; percentage: number };
  topUsers: Array<{ userId: string; requests: number }>;
  blockedCount24h: number;
}

interface AbstentionConfig {
  confidenceThreshold: number;
  semanticEntropyThreshold: number;
  selfConsistencySamples: number;
  selfConsistencyThreshold: number;
  enableConfidencePrompting: boolean;
  enableSelfConsistency: boolean;
  enableSemanticEntropy: boolean;
  enableRefusalDetection: boolean;
  enableLinearProbe: boolean;
  onAbstentionAction: string;
}

interface SemanticDeduplicationConfig {
  enableSemanticMatching: boolean;
  semanticSimilarityThreshold: number;
  maxSemanticCandidates: number;
}

interface SemanticDeduplicationStats {
  exactMatches: number;
  fuzzyMatches: number;
  semanticMatches: number;
  questionsWithEmbeddings: number;
  avgSemanticSimilarity: number;
}

export default function HITLOrchestrationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [voiStats, setVOIStats] = useState<VOIStatistics | null>(null);
  const [abstentionStats, setAbstentionStats] = useState<AbstentionStatistics | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStatistics | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [abstentionConfig, setAbstentionConfig] = useState<AbstentionConfig>({
    confidenceThreshold: 0.7,
    semanticEntropyThreshold: 0.8,
    selfConsistencySamples: 5,
    selfConsistencyThreshold: 0.7,
    enableConfidencePrompting: true,
    enableSelfConsistency: true,
    enableSemanticEntropy: true,
    enableRefusalDetection: true,
    enableLinearProbe: false,
    onAbstentionAction: 'escalate',
  });
  const [deduplicationConfig, setDeduplicationConfig] = useState<SemanticDeduplicationConfig>({
    enableSemanticMatching: false,
    semanticSimilarityThreshold: 0.85,
    maxSemanticCandidates: 20,
  });
  const [deduplicationStats, setDeduplicationStats] = useState<SemanticDeduplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch all HITL orchestration data from API
      const [voiRes, abstentionRes, batchRes, rateLimitRes] = await Promise.all([
        fetch('/api/admin/hitl-orchestration/voi/stats'),
        fetch('/api/admin/hitl-orchestration/abstention/stats'),
        fetch('/api/admin/hitl-orchestration/batching/stats'),
        fetch('/api/admin/hitl-orchestration/rate-limits/status'),
      ]);

      if (voiRes.ok) {
        const data = await voiRes.json();
        setVOIStats(data);
      }

      if (abstentionRes.ok) {
        const data = await abstentionRes.json();
        setAbstentionStats(data);
      }

      if (batchRes.ok) {
        const data = await batchRes.json();
        setBatchStats(data);
      }

      if (rateLimitRes.ok) {
        const data = await rateLimitRes.json();
        setRateLimitStatus(data);
      }

      // Fetch semantic deduplication config and stats
      try {
        const [configRes, statsRes] = await Promise.all([
          fetch('/api/admin/hitl-orchestration/semantic-deduplication/config'),
          fetch('/api/admin/hitl-orchestration/semantic-deduplication/stats'),
        ]);
        if (configRes.ok) {
          const config = await configRes.json();
          setDeduplicationConfig(config);
        }
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setDeduplicationStats(stats);
        }
      } catch (e) {
        // API not available - stats will remain null
        console.warn('Failed to fetch deduplication data:', e);
      }
    } catch (error) {
      console.error('Failed to fetch HITL data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveDeduplicationConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/hitl-orchestration/semantic-deduplication/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deduplicationConfig),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (error) {
      console.error('Failed to save deduplication config:', error);
    } finally {
      setSaving(false);
    }
  }

  async function triggerBackfill() {
    try {
      const res = await fetch('/api/admin/hitl-orchestration/semantic-deduplication/backfill', {
        method: 'POST',
      });
      if (res.ok) {
        toast({
          title: 'Backfill Started',
          description: 'Embedding backfill process has been initiated.',
        });
      } else {
        toast({
          title: 'Backfill Failed',
          description: 'Failed to start embedding backfill.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to trigger backfill:', error);
      toast({
        title: 'Backfill Failed',
        description: 'An error occurred while starting backfill.',
        variant: 'destructive',
      });
    }
  }

  const questionReductionRate = voiStats
    ? ((voiStats.skipDecisions + voiStats.inferDecisions) / voiStats.totalDecisions * 100).toFixed(0)
    : 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HITL Orchestration</h1>
          <p className="text-muted-foreground">
            Advanced Human-in-the-Loop with SAGE-Agent Bayesian VOI
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Question Reduction</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{questionReductionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Fewer unnecessary questions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Prior Accuracy</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {voiStats ? (voiStats.priorAccuracy * 100).toFixed(0) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Predictions matching actual answers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Abstention Events</CardTitle>
            <Shield className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{abstentionStats?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              AI correctly declined to answer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Batch Completion</CardTitle>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {batchStats ? (batchStats.completionRate * 100).toFixed(0) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Batched questions answered
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="voi">Value of Information</TabsTrigger>
          <TabsTrigger value="abstention">Abstention Detection</TabsTrigger>
          <TabsTrigger value="batching">Question Batching</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="deduplication">Deduplication</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* VOI Decision Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>VOI Decision Breakdown</CardTitle>
                <CardDescription>
                  How the system decides whether to ask questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Asked (High VOI)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{voiStats?.askDecisions || 0}</span>
                      <Badge variant="outline">
                        {voiStats ? ((voiStats.askDecisions / voiStats.totalDecisions) * 100).toFixed(0) : 0}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-gray-400" />
                      <span>Skipped (Low VOI)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{voiStats?.skipDecisions || 0}</span>
                      <Badge variant="outline">
                        {voiStats ? ((voiStats.skipDecisions / voiStats.totalDecisions) * 100).toFixed(0) : 0}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-blue-500" />
                      <span>Inferred (High Confidence)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{voiStats?.inferDecisions || 0}</span>
                      <Badge variant="outline">
                        {voiStats ? ((voiStats.inferDecisions / voiStats.totalDecisions) * 100).toFixed(0) : 0}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Abstention Reasons */}
            <Card>
              <CardHeader>
                <CardTitle>Abstention Reasons</CardTitle>
                <CardDescription>
                  Why AI models declined to answer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {abstentionStats && Object.entries(abstentionStats.byReason).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between">
                      <span className="capitalize">{reason.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={(count / abstentionStats.totalEvents) * 100} className="w-20" />
                        <span className="font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Batch Types */}
            <Card>
              <CardHeader>
                <CardTitle>Question Batching</CardTitle>
                <CardDescription>
                  How questions are grouped to reduce interruptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span>Time Window (30s)</span>
                    </div>
                    <span className="font-medium">{batchStats?.byType.time_window || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-500" />
                      <span>Correlation-based</span>
                    </div>
                    <span className="font-medium">{batchStats?.byType.correlation || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-green-500" />
                      <span>Semantic Similarity</span>
                    </div>
                    <span className="font-medium">{batchStats?.byType.semantic || 0}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Avg questions per batch</span>
                      <span className="font-medium">{batchStats?.avgQuestionsPerBatch.toFixed(1) || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate Limit Status */}
            <Card>
              <CardHeader>
                <CardTitle>Rate Limit Status</CardTitle>
                <CardDescription>
                  Current question rate across the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Global Usage</span>
                      <span className="text-sm font-medium">
                        {rateLimitStatus?.globalUsage.current}/{rateLimitStatus?.globalUsage.max} RPM
                      </span>
                    </div>
                    <Progress value={rateLimitStatus?.globalUsage.percentage || 0} />
                  </div>
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground">Top Users (current window)</span>
                    <div className="mt-2 space-y-2">
                      {rateLimitStatus?.topUsers.map((user, i) => (
                        <div key={user.userId} className="flex items-center justify-between text-sm">
                          <span>#{i + 1} {user.userId}</span>
                          <Badge variant="outline">{user.requests} req</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  {rateLimitStatus?.blockedCount24h && rateLimitStatus.blockedCount24h > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-600">
                        {rateLimitStatus.blockedCount24h} requests blocked in 24h
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="voi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SAGE-Agent Bayesian Value of Information</CardTitle>
              <CardDescription>
                The system calculates whether asking a question is worth the user&apos;s time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Average VOI Score</span>
                  </div>
                  <div className="text-3xl font-bold">{voiStats?.avgVOIScore.toFixed(2) || 0}</div>
                  <p className="text-sm text-muted-foreground">
                    Threshold: 0.30 (ask if above)
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Avg Information Gain</span>
                  </div>
                  <div className="text-3xl font-bold">{voiStats?.avgActualInfoGain.toFixed(2) || 0}</div>
                  <p className="text-sm text-muted-foreground">
                    When questions are asked
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Prior Accuracy</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {voiStats ? (voiStats.priorAccuracy * 100).toFixed(0) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Predictions matching reality
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="font-medium mb-4">Two-Question Rule</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  The system enforces a maximum of 2 clarifying questions per workflow. 
                  After reaching this limit, it proceeds with explicitly stated assumptions.
                </p>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Two-question rule is active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abstention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Abstention Detection</CardTitle>
              <CardDescription>
                Detect when AI models should decline to answer due to uncertainty
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-4">Detection Methods</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">Confidence Prompting</p>
                        <p className="text-sm text-muted-foreground">
                          Ask model to rate confidence 0-100
                        </p>
                      </div>
                      <Badge variant={abstentionConfig.enableConfidencePrompting ? 'default' : 'secondary'}>
                        {abstentionConfig.enableConfidencePrompting ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">Self-Consistency</p>
                        <p className="text-sm text-muted-foreground">
                          Sample N responses, measure agreement
                        </p>
                      </div>
                      <Badge variant={abstentionConfig.enableSelfConsistency ? 'default' : 'secondary'}>
                        {abstentionConfig.enableSelfConsistency ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">Semantic Entropy</p>
                        <p className="text-sm text-muted-foreground">
                          Cluster outputs, high entropy = uncertain
                        </p>
                      </div>
                      <Badge variant={abstentionConfig.enableSemanticEntropy ? 'default' : 'secondary'}>
                        {abstentionConfig.enableSemanticEntropy ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">Refusal Detection</p>
                        <p className="text-sm text-muted-foreground">
                          Detect hedging language patterns
                        </p>
                      </div>
                      <Badge variant={abstentionConfig.enableRefusalDetection ? 'default' : 'secondary'}>
                        {abstentionConfig.enableRefusalDetection ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 border-amber-200">
                      <div>
                        <p className="font-medium">Linear Probes (Self-Hosted)</p>
                        <p className="text-sm text-muted-foreground">
                          Hidden layer analysis (requires model wrapper)
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-amber-100">
                        Future
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Abstention by Model</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abstentionStats && Object.entries(abstentionStats.byModel).map(([model, count]) => (
                        <TableRow key={model}>
                          <TableCell className="font-medium">{model}</TableCell>
                          <TableCell className="text-right">{count}</TableCell>
                          <TableCell className="text-right">
                            {((count / abstentionStats.totalEvents) * 100).toFixed(0)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batching" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Batching</CardTitle>
              <CardDescription>
                Reduce interruptions by grouping related questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Total Batches</span>
                  <div className="text-3xl font-bold">{batchStats?.totalBatches || 0}</div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Avg Questions/Batch</span>
                  <div className="text-3xl font-bold">{batchStats?.avgQuestionsPerBatch.toFixed(1) || 0}</div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Avg Answer Time</span>
                  <div className="text-3xl font-bold">{batchStats?.avgAnswerTime || 0}s</div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="font-medium mb-4">Batching Strategies</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Time Window</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        Collect questions within 30 seconds
                      </p>
                      <div className="text-2xl font-bold">{batchStats?.byType.time_window || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Correlation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        Group by workflow, entity, task
                      </p>
                      <div className="text-2xl font-bold">{batchStats?.byType.correlation || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Semantic</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        Cluster similar questions
                      </p>
                      <div className="text-2xl font-bold">{batchStats?.byType.semantic || 0}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting Configuration</CardTitle>
              <CardDescription>
                Prevent question storms with multi-level rate limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Requests/Minute</TableHead>
                    <TableHead>Max Concurrent</TableHead>
                    <TableHead>Burst Allowance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Global</TableCell>
                    <TableCell>50</TableCell>
                    <TableCell>20</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Per User</TableCell>
                    <TableCell>10</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Per Workflow</TableCell>
                    <TableCell>5</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Abstention Detection Settings</CardTitle>
              <CardDescription>
                Configure thresholds and detection methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <Label>Confidence Threshold</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[abstentionConfig.confidenceThreshold * 100]}
                        onValueChange={(v) => setAbstentionConfig(c => ({ ...c, confidenceThreshold: v[0] / 100 }))}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-medium">
                        {(abstentionConfig.confidenceThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Below this threshold, escalate to human
                    </p>
                  </div>

                  <div>
                    <Label>Semantic Entropy Threshold</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[abstentionConfig.semanticEntropyThreshold * 100]}
                        onValueChange={(v) => setAbstentionConfig(c => ({ ...c, semanticEntropyThreshold: v[0] / 100 }))}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-medium">
                        {(abstentionConfig.semanticEntropyThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Above this threshold, responses are too varied
                    </p>
                  </div>

                  <div>
                    <Label>Self-Consistency Samples</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Input
                        type="number"
                        value={abstentionConfig.selfConsistencySamples}
                        onChange={(e) => setAbstentionConfig(c => ({ ...c, selfConsistencySamples: parseInt(e.target.value) || 5 }))}
                        min={2}
                        max={10}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">samples</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Confidence Prompting</Label>
                      <p className="text-sm text-muted-foreground">
                        Ask model to rate confidence
                      </p>
                    </div>
                    <Switch
                      checked={abstentionConfig.enableConfidencePrompting}
                      onCheckedChange={(v) => setAbstentionConfig(c => ({ ...c, enableConfidencePrompting: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Self-Consistency Check</Label>
                      <p className="text-sm text-muted-foreground">
                        Sample multiple responses
                      </p>
                    </div>
                    <Switch
                      checked={abstentionConfig.enableSelfConsistency}
                      onCheckedChange={(v) => setAbstentionConfig(c => ({ ...c, enableSelfConsistency: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Semantic Entropy</Label>
                      <p className="text-sm text-muted-foreground">
                        Analyze output variation
                      </p>
                    </div>
                    <Switch
                      checked={abstentionConfig.enableSemanticEntropy}
                      onCheckedChange={(v) => setAbstentionConfig(c => ({ ...c, enableSemanticEntropy: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Refusal Detection</Label>
                      <p className="text-sm text-muted-foreground">
                        Detect hedging language
                      </p>
                    </div>
                    <Switch
                      checked={abstentionConfig.enableRefusalDetection}
                      onCheckedChange={(v) => setAbstentionConfig(c => ({ ...c, enableRefusalDetection: v }))}
                    />
                  </div>

                  <div>
                    <Label>On Abstention Action</Label>
                    <Select
                      value={abstentionConfig.onAbstentionAction}
                      onValueChange={(v) => setAbstentionConfig(c => ({ ...c, onAbstentionAction: v }))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="escalate">Escalate to Human</SelectItem>
                        <SelectItem value="ask_user">Ask User Directly</SelectItem>
                        <SelectItem value="use_default">Use Default Value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button>
                  <Settings className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deduplication" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Semantic Deduplication</CardTitle>
                <CardDescription>
                  Use AI embeddings to find semantically similar questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Semantic Matching</Label>
                    <p className="text-sm text-muted-foreground">
                      Use pgvector embeddings for similarity search
                    </p>
                  </div>
                  <Switch 
                    checked={deduplicationConfig.enableSemanticMatching}
                    onCheckedChange={(v) => setDeduplicationConfig(c => ({ ...c, enableSemanticMatching: v }))}
                  />
                </div>

                <div>
                  <Label>Similarity Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Minimum cosine similarity to consider a match (0.0-1.0)
                  </p>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[deduplicationConfig.semanticSimilarityThreshold * 100]}
                      onValueChange={([v]) => setDeduplicationConfig(c => ({ ...c, semanticSimilarityThreshold: v / 100 }))}
                      min={50}
                      max={99}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-12 text-right font-medium">
                      {(deduplicationConfig.semanticSimilarityThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div>
                  <Label>Max Candidates</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Maximum number of similar questions to check
                  </p>
                  <Input 
                    type="number" 
                    value={deduplicationConfig.maxSemanticCandidates}
                    onChange={(e) => setDeduplicationConfig(c => ({ ...c, maxSemanticCandidates: parseInt(e.target.value) || 20 }))}
                    min={5} 
                    max={100} 
                    className="w-24" 
                  />
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" className="mr-2" onClick={triggerBackfill}>
                    Backfill Embeddings
                  </Button>
                  <Button onClick={saveDeduplicationConfig} disabled={saving}>
                    <Settings className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match Statistics (24h)</CardTitle>
                <CardDescription>
                  How questions are being deduplicated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Exact Matches</span>
                    </div>
                    <Badge variant="outline">{deduplicationStats?.exactMatches.toLocaleString() || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-500" />
                      <span>Fuzzy Matches</span>
                    </div>
                    <Badge variant="outline">{deduplicationStats?.fuzzyMatches.toLocaleString() || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span>Semantic Matches</span>
                    </div>
                    <Badge variant="outline">{deduplicationStats?.semanticMatches.toLocaleString() || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-gray-500" />
                      <span>Questions with Embeddings</span>
                    </div>
                    <Badge variant="outline">{deduplicationStats?.questionsWithEmbeddings.toLocaleString() || 0}</Badge>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Avg Semantic Similarity</span>
                    <span className="font-bold text-purple-600">
                      {deduplicationStats ? (deduplicationStats.avgSemanticSimilarity * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <Progress value={deduplicationStats ? deduplicationStats.avgSemanticSimilarity * 100 : 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
