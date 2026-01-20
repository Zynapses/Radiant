'use client';

import { useState, useEffect } from 'react';
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
import {
  Brain,
  TrendingUp,
  Clock,
  Layers,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  Gauge,
  Users,
} from 'lucide-react';

interface VOIStatistics {
  totalDecisions: number;
  askDecisions: number;
  skipDecisions: number;
  inferDecisions: number;
  avgVOIScore: number;
  priorAccuracy: number;
}

interface AbstentionStatistics {
  totalEvents: number;
  byReason: Record<string, number>;
  avgConfidence: number;
}

interface BatchStatistics {
  totalBatches: number;
  avgQuestionsPerBatch: number;
  avgAnswerTime: number;
  completionRate: number;
}

export default function HITLOrchestrationPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [voiStats, setVOIStats] = useState<VOIStatistics | null>(null);
  const [abstentionStats, setAbstentionStats] = useState<AbstentionStatistics | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Mock data for demonstration
      setVOIStats({
        totalDecisions: 1247,
        askDecisions: 312,
        skipDecisions: 623,
        inferDecisions: 312,
        avgVOIScore: 0.42,
        priorAccuracy: 0.73,
      });

      setAbstentionStats({
        totalEvents: 89,
        byReason: {
          low_confidence: 34,
          high_semantic_entropy: 23,
          self_consistency_fail: 18,
          missing_information: 14,
        },
        avgConfidence: 0.62,
      });

      setBatchStats({
        totalBatches: 456,
        avgQuestionsPerBatch: 3.2,
        avgAnswerTime: 127,
        completionRate: 0.94,
      });
    } catch (error) {
      console.error('Failed to fetch HITL data:', error);
    } finally {
      setLoading(false);
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
          <TabsTrigger value="abstention">Abstention</TabsTrigger>
          <TabsTrigger value="batching">Batching</TabsTrigger>
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

            {/* Batching Stats */}
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
                    <span>Total Batches</span>
                    <span className="font-medium">{batchStats?.totalBatches || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg Questions/Batch</span>
                    <span className="font-medium">{batchStats?.avgQuestionsPerBatch.toFixed(1) || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg Answer Time</span>
                    <span className="font-medium">{batchStats?.avgAnswerTime || 0}s</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Two Question Rule */}
            <Card>
              <CardHeader>
                <CardTitle>Two-Question Rule</CardTitle>
                <CardDescription>
                  Maximum clarifying questions per workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Rule Active</p>
                    <p className="text-sm text-muted-foreground">
                      Max 2 questions, then proceed with assumptions
                    </p>
                  </div>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Total Decisions</span>
                  </div>
                  <div className="text-3xl font-bold">{voiStats?.totalDecisions || 0}</div>
                  <p className="text-sm text-muted-foreground">
                    In last 30 days
                  </p>
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
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">Detection Methods</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Calibrated confidence prompting</li>
                      <li>• Self-consistency sampling (N responses)</li>
                      <li>• Semantic entropy analysis</li>
                      <li>• Refusal pattern detection</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">Statistics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Events</span>
                        <span className="font-medium">{abstentionStats?.totalEvents || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg Confidence</span>
                        <span className="font-medium">{((abstentionStats?.avgConfidence || 0) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Future: Linear Probes for Self-Hosted Models</span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Hidden layer analysis will be available in future self-hosted model inference wrappers.
                  </p>
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
                Three-layer batching to reduce interruptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <h4 className="font-medium">Time Window</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Collect questions within 30-60 seconds
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-5 w-5 text-purple-500" />
                    <h4 className="font-medium">Correlation</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Group by workflow, entity, task type
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-green-500" />
                    <h4 className="font-medium">Semantic</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cluster semantically similar questions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
