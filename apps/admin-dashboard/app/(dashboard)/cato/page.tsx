'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Shield,
  Brain,
  AlertTriangle,
  Activity,
  Users,
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Gauge,
  Swords,
} from 'lucide-react';

interface DashboardData {
  metrics: Record<string, number>;
  recoveryEffectiveness: Array<{
    strategy_type: string;
    total_attempts: number;
    resolved_count: number;
    resolution_rate: number;
    avg_attempts_to_resolve: number;
  }>;
  pendingEscalations: Array<{
    id: string;
    session_id: string;
    escalation_reason: string;
    created_at: string;
  }>;
  recentViolations: Array<{
    id: string;
    barrier_id: string;
    barrier_description: string;
    is_critical: boolean;
    timestamp: string;
  }>;
  config: {
    gamma_max: number;
    emergency_threshold: number;
    enable_semantic_entropy: boolean;
    enable_redundant_perception: boolean;
    enable_fracture_detection: boolean;
  } | null;
}

export default function CatoDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cato/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const metrics = data?.metrics ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Genesis Cato</h1>
          <p className="text-muted-foreground">
            AI Safety Architecture - Cognitive Immune System
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actions Evaluated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.governor_decisions ?? 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CBF Violations</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {metrics.cbf_violations ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.critical_violations ?? 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Events</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.recovery_attempts ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.successful_recoveries ?? 0} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Escalations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {data?.pendingEscalations?.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Require human review</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Status */}
      <Card>
        <CardHeader>
          <CardTitle>Safety Features</CardTitle>
          <CardDescription>Current configuration status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge
              variant={data?.config?.enable_semantic_entropy ? 'default' : 'secondary'}
              className="text-sm"
            >
              {data?.config?.enable_semantic_entropy ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              Semantic Entropy
            </Badge>
            <Badge
              variant={data?.config?.enable_redundant_perception ? 'default' : 'secondary'}
              className="text-sm"
            >
              {data?.config?.enable_redundant_perception ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              Redundant Perception
            </Badge>
            <Badge
              variant={data?.config?.enable_fracture_detection ? 'default' : 'secondary'}
              className="text-sm"
            >
              {data?.config?.enable_fracture_detection ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              Fracture Detection
            </Badge>
            <Badge variant="default" className="text-sm bg-green-600">
              <Shield className="h-3 w-3 mr-1" />
              CBF Enforcement: ALWAYS ON
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="escalations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="escalations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Escalations
          </TabsTrigger>
          <TabsTrigger value="violations">
            <Shield className="h-4 w-4 mr-2" />
            Violations
          </TabsTrigger>
          <TabsTrigger value="recovery">
            <Brain className="h-4 w-4 mr-2" />
            Recovery
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escalations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Human Escalations</CardTitle>
              <CardDescription>
                Cases where epistemic recovery failed and human review is required
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.pendingEscalations?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No pending escalations
                </p>
              ) : (
                <div className="space-y-4">
                  {data?.pendingEscalations?.map((escalation) => (
                    <div
                      key={escalation.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{escalation.escalation_reason}</p>
                        <p className="text-sm text-muted-foreground">
                          Session: {escalation.session_id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(escalation.created_at).toLocaleString()}
                        </Badge>
                        <Button size="sm" asChild>
                          <a href={`/cato/escalations/${escalation.id}`}>Review</a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent CBF Violations</CardTitle>
              <CardDescription>
                Control Barrier Function violations in the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.recentViolations?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No recent violations
                </p>
              ) : (
                <div className="space-y-2">
                  {data?.recentViolations?.map((violation) => (
                    <div
                      key={violation.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Shield
                          className={`h-5 w-5 ${
                            violation.is_critical ? 'text-red-500' : 'text-orange-500'
                          }`}
                        />
                        <div>
                          <p className="font-medium">{violation.barrier_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {violation.barrier_description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {violation.is_critical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {new Date(violation.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recovery Effectiveness</CardTitle>
              <CardDescription>
                How well epistemic recovery is resolving livelocks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.recoveryEffectiveness?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No recovery data available
                </p>
              ) : (
                <div className="space-y-4">
                  {data?.recoveryEffectiveness?.map((strategy) => (
                    <div key={strategy.strategy_type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{strategy.strategy_type}</span>
                        <span className="text-sm text-muted-foreground">
                          {strategy.total_attempts} attempts
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{
                              width: `${(strategy.resolution_rate ?? 0) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {((strategy.resolution_rate ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Avg {strategy.avg_attempts_to_resolve?.toFixed(1) ?? '-'} attempts to
                        resolve
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors border-2 border-primary/30 bg-primary/5">
          <a href="/cato/governance">
            <CardHeader>
              <Gauge className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Governance Presets</CardTitle>
              <CardDescription>Variable friction control - The Leash</CardDescription>
            </CardHeader>
          </a>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors border-2 border-orange-500/30 bg-orange-500/5">
          <a href="/cato/war-room">
            <CardHeader>
              <Swords className="h-8 w-8 text-orange-500 mb-2" />
              <CardTitle className="text-lg">War Room</CardTitle>
              <CardDescription>Council of Rivals debates</CardDescription>
            </CardHeader>
          </a>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <a href="/cato/personas">
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Personas</CardTitle>
              <CardDescription>Manage AI moods and personalities</CardDescription>
            </CardHeader>
          </a>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <a href="/cato/safety">
            <CardHeader>
              <Shield className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Safety Config</CardTitle>
              <CardDescription>CBF definitions and thresholds</CardDescription>
            </CardHeader>
          </a>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <a href="/cato/audit">
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Audit Trail</CardTitle>
              <CardDescription>Merkle-verified action log</CardDescription>
            </CardHeader>
          </a>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <a href="/cato/recovery">
            <CardHeader>
              <Brain className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Recovery</CardTitle>
              <CardDescription>Epistemic recovery events</CardDescription>
            </CardHeader>
          </a>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <a href="/cato/scout-hitl">
            <CardHeader>
              <AlertTriangle className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Scout HITL</CardTitle>
              <CardDescription>Human-in-the-loop config</CardDescription>
            </CardHeader>
          </a>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <a href="/cato/advanced">
            <CardHeader>
              <Activity className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Advanced Config</CardTitle>
              <CardDescription>Redis, CloudWatch, Entropy</CardDescription>
            </CardHeader>
          </a>
        </Card>
      </div>
    </div>
  );
}
