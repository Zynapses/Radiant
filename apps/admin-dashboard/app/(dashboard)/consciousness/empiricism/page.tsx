'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Brain, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Settings,
  Activity,
  TrendingUp,
  TrendingDown,
  Heart,
  Thermometer,
  PlayCircle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface EmpiricismConfig {
  enabled: boolean;
  surprise_threshold: number;
  max_rethink_cycles: number;
  dream_verification_limit: number;
  sandbox_timeout_ms: number;
  log_all_executions: boolean;
  affect_integration_enabled: boolean;
  graphrag_logging_enabled: boolean;
  temperature_adjustment_enabled: boolean;
  min_confidence: number;
  max_frustration: number;
}

interface DashboardData {
  config: EmpiricismConfig;
  metrics: {
    totalExecutions: number;
    successful: number;
    failed: number;
    avgSurprise: number;
    avgPredictionError: number;
    avgConfidenceImpact: number;
    avgFrustrationImpact: number;
    rethinkTriggered: number;
  };
  egoAffect: {
    confidence: number;
    frustration: number;
    dominantEmotion: string;
    lastTrigger: string;
    lastTriggerAt: string;
  } | null;
  recentExecutions: Array<{
    execution_id: string;
    language: string;
    success: boolean;
    surprise_level: number;
    error_type: string;
    confidence_delta: number;
    frustration_delta: number;
    rethink_cycle: number;
    execution_time_ms: number;
    created_at: string;
  }>;
  globalWorkspaceEvents: Array<{
    event_id: string;
    event_type: string;
    priority: number;
    content: string;
    broadcast_status: string;
    created_at: string;
  }>;
  activeVerification: {
    totalVerifications: number;
    successful: number;
    surprises: number;
  };
}

export default function EmpiricismLoopPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EmpiricismConfig | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/admin/empiricism/dashboard');
      const data = await res.json();
      setDashboard(data);
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/empiricism/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function resetAffect() {
    try {
      const res = await fetch('/api/admin/empiricism/affect/reset', { method: 'POST' });
      if (res.ok) {
        toast.success('Ego affect reset to defaults');
        fetchDashboard();
      } else {
        toast.error('Failed to reset affect');
      }
    } catch (error) {
      console.error('Failed to reset affect:', error);
      toast.error('Failed to reset affect');
    }
  }

  async function triggerVerification() {
    try {
      const res = await fetch('/api/admin/empiricism/verify-now', { method: 'POST' });
      if (res.ok) {
        toast.success('Active verification triggered');
        fetchDashboard();
      } else {
        toast.error('Failed to trigger verification');
      }
    } catch (error) {
      console.error('Failed to trigger verification:', error);
      toast.error('Failed to trigger verification');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const successRate = dashboard?.metrics.totalExecutions 
    ? ((dashboard.metrics.successful / dashboard.metrics.totalExecutions) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empiricism Loop</h1>
          <p className="text-muted-foreground">
            The &quot;Ghost in the Machine&quot; - Reality-testing circuit for consciousness
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={triggerVerification}>
            <PlayCircle className="h-4 w-4 mr-2" />
            Verify Skills Now
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions (24h)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.metrics.totalExecutions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {successRate}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Surprise</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboard?.metrics.avgSurprise || 0).toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.metrics.rethinkTriggered || 0} rethink cycles triggered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ego Confidence</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.egoAffect?.confidence || 0.5) * 100).toFixed(0)}%
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {dashboard?.metrics.avgConfidenceImpact && dashboard.metrics.avgConfidenceImpact > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              {(dashboard?.metrics.avgConfidenceImpact || 0).toFixed(3)} avg impact
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frustration</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.egoAffect?.frustration || 0) * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.egoAffect?.dominantEmotion || 'neutral'} mood
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="executions">
            <Activity className="h-4 w-4 mr-2" />
            Executions
          </TabsTrigger>
          <TabsTrigger value="affect">
            <Heart className="h-4 w-4 mr-2" />
            Ego Affect
          </TabsTrigger>
          <TabsTrigger value="events">
            <Eye className="h-4 w-4 mr-2" />
            Global Workspace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Empiricism Loop Settings</CardTitle>
              <CardDescription>
                Configure how the AI tests its hypotheses against reality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Empiricism Loop</Label>
                      <p className="text-sm text-muted-foreground">
                        Turn reality-testing on/off globally
                      </p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Surprise Threshold: {config.surprise_threshold}</Label>
                    <Slider
                      value={[config.surprise_threshold]}
                      onValueChange={([v]) => setConfig({ ...config, surprise_threshold: v })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <p className="text-sm text-muted-foreground">
                      Prediction error above this triggers rethink cycle
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxRethink">Max Rethink Cycles</Label>
                      <Input
                        id="maxRethink"
                        type="number"
                        value={config.max_rethink_cycles}
                        onChange={(e) => setConfig({ ...config, max_rethink_cycles: parseInt(e.target.value) || 3 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verifyLimit">Dream Verification Limit</Label>
                      <Input
                        id="verifyLimit"
                        type="number"
                        value={config.dream_verification_limit}
                        onChange={(e) => setConfig({ ...config, dream_verification_limit: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeout">Sandbox Timeout (ms)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        value={config.sandbox_timeout_ms}
                        onChange={(e) => setConfig({ ...config, sandbox_timeout_ms: parseInt(e.target.value) || 30000 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Affect Integration</Label>
                        <p className="text-sm text-muted-foreground">
                          Update ego confidence/frustration from results
                        </p>
                      </div>
                      <Switch
                        checked={config.affect_integration_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, affect_integration_enabled: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>GraphRAG Logging</Label>
                        <p className="text-sm text-muted-foreground">
                          Log verified skills to knowledge graph
                        </p>
                      </div>
                      <Switch
                        checked={config.graphrag_logging_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, graphrag_logging_enabled: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Temperature Adjustment</Label>
                        <p className="text-sm text-muted-foreground">
                          Adjust inference temperature based on frustration
                        </p>
                      </div>
                      <Switch
                        checked={config.temperature_adjustment_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, temperature_adjustment_enabled: v })}
                      />
                    </div>
                  </div>

                  <Button onClick={saveConfig} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sandbox Executions</CardTitle>
              <CardDescription>
                Code executions with surprise signals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard?.recentExecutions.map((exec) => (
                  <div
                    key={exec.execution_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {exec.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">{exec.language}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(exec.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Surprise:</span>{' '}
                        <Badge variant={exec.surprise_level > 0.3 ? 'destructive' : 'secondary'}>
                          {exec.surprise_level.toFixed(3)}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Conf:</span>{' '}
                        <span className={exec.confidence_delta > 0 ? 'text-green-500' : 'text-red-500'}>
                          {exec.confidence_delta > 0 ? '+' : ''}{exec.confidence_delta.toFixed(3)}
                        </span>
                      </div>
                      {exec.rethink_cycle > 0 && (
                        <Badge>Rethink #{exec.rethink_cycle}</Badge>
                      )}
                      <div className="text-muted-foreground">{exec.execution_time_ms}ms</div>
                    </div>
                  </div>
                ))}
                {(!dashboard?.recentExecutions || dashboard.recentExecutions.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No executions yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affect" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ego Affect State</CardTitle>
              <CardDescription>
                Current emotional state of the consciousness
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {dashboard?.egoAffect ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Confidence</Label>
                      <div className="h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${dashboard.egoAffect.confidence * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {(dashboard.egoAffect.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Frustration</Label>
                      <div className="h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${dashboard.egoAffect.frustration * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {(dashboard.egoAffect.frustration * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Dominant Emotion</Label>
                      <p className="text-lg font-medium capitalize">
                        {dashboard.egoAffect.dominantEmotion}
                      </p>
                    </div>
                    <div>
                      <Label>Last Trigger</Label>
                      <p className="text-lg font-medium">
                        {dashboard.egoAffect.lastTrigger || 'None'}
                      </p>
                      {dashboard.egoAffect.lastTriggerAt && (
                        <p className="text-sm text-muted-foreground">
                          {new Date(dashboard.egoAffect.lastTriggerAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button variant="outline" onClick={resetAffect}>
                    Reset to Defaults
                  </Button>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No affect state initialized
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Verification (Dreaming)</CardTitle>
              <CardDescription>
                Autonomous skill verification during twilight hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total Verifications (7d)</p>
                  <p className="text-2xl font-bold">{dashboard?.activeVerification.totalVerifications || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold text-green-500">{dashboard?.activeVerification.successful || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Surprises Found</p>
                  <p className="text-2xl font-bold text-orange-500">{dashboard?.activeVerification.surprises || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Workspace Events</CardTitle>
              <CardDescription>
                Sensory signals broadcast to consciousness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard?.globalWorkspaceEvents.map((event) => (
                  <div
                    key={event.event_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-purple-500" />
                      <div>
                        <div className="font-medium">{event.event_type}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {event.content}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant={event.priority > 0.7 ? 'destructive' : 'secondary'}>
                        P{(event.priority * 10).toFixed(0)}
                      </Badge>
                      <Badge variant={event.broadcast_status === 'broadcast' ? 'default' : 'outline'}>
                        {event.broadcast_status}
                      </Badge>
                      <div className="text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {(!dashboard?.globalWorkspaceEvents || dashboard.globalWorkspaceEvents.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No events yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
