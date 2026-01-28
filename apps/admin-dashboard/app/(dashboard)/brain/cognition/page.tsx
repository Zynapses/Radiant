'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, Zap, Database, Target, GitBranch, 
  TrendingUp, AlertTriangle, CheckCircle, Clock,
  RefreshCw, Play, Settings
} from 'lucide-react';

interface CacheMetrics {
  hitRate: number;
  totalRequests: number;
  estimatedCostSaved: number;
  totalEntries: number;
}

interface DistillationJob {
  id: string;
  status: string;
  examplesCollected: number;
  startedAt: string;
}

interface Goal {
  id: string;
  description: string;
  priority: number;
  progress: number;
  status: string;
  type: string;
}

interface TraceStats {
  total: number;
  pending: number;
  validated: number;
  rejected: number;
  avgQualityScore: number;
  totalCostUsd: number;
}

export default function CognitionPage() {
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null);
  const [distillationJobs, setDistillationJobs] = useState<DistillationJob[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [traceStats, setTraceStats] = useState<TraceStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  async function fetchData() {
    setLoading(true);
    try {
      const [cacheRes, jobsRes, goalsRes, tracesRes] = await Promise.all([
        fetch('/api/cognition/cache/stats').catch(() => null),
        fetch('/api/cognition/distillation/jobs').catch(() => null),
        fetch('/api/cognition/curiosity/goals').catch(() => null),
        fetch('/api/cognition/teacher/stats').catch(() => null),
      ]);
      
      if (cacheRes?.ok) setCacheMetrics(await cacheRes.json());
      if (jobsRes?.ok) setDistillationJobs(await jobsRes.json());
      if (goalsRes?.ok) setActiveGoals(await goalsRes.json());
      if (tracesRes?.ok) setTraceStats(await tracesRes.json());
    } catch (error) {
      console.error('Failed to fetch cognition data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" /> Advanced Cognition
          </h1>
          <p className="text-muted-foreground">v6.1.0 Cognitive Enhancement Services</p>
        </div>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheMetrics ? `${(cacheMetrics.hitRate * 100).toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {cacheMetrics?.totalEntries?.toLocaleString() || 0} cached entries
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${cacheMetrics?.estimatedCostSaved?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">From semantic caching</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Training Traces</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{traceStats?.validated || 0}</div>
            <p className="text-xs text-muted-foreground">
              {traceStats?.pending || 0} pending validation
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGoals.length}</div>
            <p className="text-xs text-muted-foreground">Curiosity-driven exploration</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="distillation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="distillation">
            <Zap className="h-4 w-4 mr-2" />Distillation
          </TabsTrigger>
          <TabsTrigger value="cache">
            <Database className="h-4 w-4 mr-2" />Cache
          </TabsTrigger>
          <TabsTrigger value="metacognition">
            <Brain className="h-4 w-4 mr-2" />Metacognition
          </TabsTrigger>
          <TabsTrigger value="curiosity">
            <Target className="h-4 w-4 mr-2" />Curiosity
          </TabsTrigger>
          <TabsTrigger value="counterfactual">
            <GitBranch className="h-4 w-4 mr-2" />Counterfactual
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="distillation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Teacher-Student Distillation</CardTitle>
                <CardDescription>
                  Generate reasoning traces from powerful models to train efficient student models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Traces</p>
                      <p className="text-2xl font-bold">{traceStats?.total || 0}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Avg Quality</p>
                      <p className="text-2xl font-bold">
                        {traceStats?.avgQualityScore?.toFixed(2) || '--'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Trace Status</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-yellow-50">
                        <Clock className="h-3 w-3 mr-1" />
                        {traceStats?.pending || 0} Pending
                      </Badge>
                      <Badge variant="outline" className="bg-green-50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {traceStats?.validated || 0} Validated
                      </Badge>
                      <Badge variant="outline" className="bg-red-50">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {traceStats?.rejected || 0} Rejected
                      </Badge>
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Generate New Traces
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Training Jobs</CardTitle>
                <CardDescription>Active and recent distillation training jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {distillationJobs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No distillation jobs yet
                    </p>
                  ) : (
                    distillationJobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">Job {job.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {job.examplesCollected} examples
                          </p>
                        </div>
                        <Badge variant={
                          job.status === 'completed' ? 'default' :
                          job.status === 'training' ? 'secondary' :
                          job.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {job.status === 'training' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
                          {job.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {job.status === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {job.status}
                        </Badge>
                      </div>
                    ))
                  )}
                  
                  <Button variant="outline" className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Start Training Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="cache">
          <Card>
            <CardHeader>
              <CardTitle>Semantic Cache Performance</CardTitle>
              <CardDescription>
                Vector similarity caching reduces inference costs by serving cached responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Hit Rate</span>
                    <span className="font-medium">
                      {cacheMetrics ? `${(cacheMetrics.hitRate * 100).toFixed(1)}%` : '--'}
                    </span>
                  </div>
                  <Progress value={cacheMetrics ? cacheMetrics.hitRate * 100 : 0} />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold">
                      {cacheMetrics?.totalRequests?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Cached Entries</p>
                    <p className="text-2xl font-bold">
                      {cacheMetrics?.totalEntries?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Cost Saved</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${cacheMetrics?.estimatedCostSaved?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure TTL
                  </Button>
                  <Button variant="destructive" className="flex-1">
                    Invalidate Cache
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="metacognition">
          <Card>
            <CardHeader>
              <CardTitle>Metacognition Analytics</CardTitle>
              <CardDescription>
                Self-assessment, confidence monitoring, and escalation decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">0.7</p>
                    <p className="text-sm text-muted-foreground">Confidence Threshold</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">3</p>
                    <p className="text-sm text-muted-foreground">Max Self-Correction</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <p className="text-2xl font-bold">2.5</p>
                    <p className="text-sm text-muted-foreground">Entropy Threshold</p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Escalation Targets</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Code Tasks</span>
                      <span>claude-sonnet-4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reasoning Tasks</span>
                      <span>claude-opus-4-5-extended</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Research Tasks</span>
                      <span>gemini-2-5-pro</span>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Thresholds
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="curiosity">
          <Card>
            <CardHeader>
              <CardTitle>Curiosity-Driven Goals</CardTitle>
              <CardDescription>
                Autonomous exploration based on detected knowledge gaps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeGoals.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No active curiosity goals
                  </p>
                ) : (
                  activeGoals.map(goal => (
                    <div key={goal.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{goal.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Priority: {goal.priority}/10 • Type: {goal.type}
                          </p>
                        </div>
                        <Badge variant={
                          goal.status === 'active' ? 'default' :
                          goal.status === 'completed' ? 'secondary' : 'outline'
                        }>
                          {goal.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={goal.progress * 100} className="flex-1" />
                        <span className="text-sm font-medium">
                          {(goal.progress * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
                
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Target className="h-4 w-4 mr-2" />
                    Identify Gaps
                  </Button>
                  <Button className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Run Exploration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="counterfactual">
          <Card>
            <CardHeader>
              <CardTitle>Counterfactual Analysis</CardTitle>
              <CardDescription>
                Track alternative model paths to improve routing decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Sampling Strategies</p>
                    <ul className="mt-2 text-sm space-y-1">
                      <li className="flex justify-between">
                        <span>Regeneration</span>
                        <span className="font-medium">100%</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Low Confidence</span>
                        <span className="font-medium">50%</span>
                      </li>
                      <li className="flex justify-between">
                        <span>High Cost</span>
                        <span className="font-medium">25%</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Random</span>
                        <span className="font-medium">1%</span>
                      </li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Daily Limit</p>
                    <p className="text-3xl font-bold mt-2">1,000</p>
                    <p className="text-xs text-muted-foreground">simulations per day</p>
                  </div>
                </div>
                
                <Button className="w-full">
                  <GitBranch className="h-4 w-4 mr-2" />
                  View Simulation Results
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
