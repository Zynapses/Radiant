'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Database,
  Cloud,
  Brain,
  Shield,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Settings,
} from 'lucide-react';

interface AdvancedConfig {
  redis: {
    enabled: boolean;
    rejectionTtlSeconds: number;
    personaOverrideTtlSeconds: number;
    recoveryStateTtlSeconds: number;
    connected: boolean;
  };
  cloudwatch: {
    enabled: boolean;
    syncIntervalSeconds: number;
    customAlarmMappings: Record<string, unknown>;
  };
  asyncEntropy: {
    enabled: boolean;
    asyncThreshold: number;
    jobTtlHours: number;
    maxConcurrentJobs: number;
  };
  fractureDetection: {
    weights: {
      wordOverlap: number;
      intentKeyword: number;
      sentiment: number;
      topicCoherence: number;
      completeness: number;
    };
    alignmentThreshold: number;
    evasionThreshold: number;
  };
  controlBarrier: {
    authorizationCheckEnabled: boolean;
    baaVerificationEnabled: boolean;
    costAlternativeEnabled: boolean;
    maxCostReductionPercent: number;
  };
}

interface SystemStatus {
  redis: { connected: boolean; enabled: boolean };
  cloudwatch: { enabled: boolean; integrationActive: boolean; recentSyncs: Array<{ sync_type: string; success: boolean; duration_ms: number; started_at: string }> };
  asyncEntropy: { enabled: boolean; jobCounts: Record<string, number> };
  activeVetos: number;
}

export default function CatoAdvancedConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AdvancedConfig | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/admin/cato/advanced-config'),
        fetch('/api/admin/cato/system-status'),
      ]);

      if (!configRes.ok) throw new Error('Failed to fetch config');
      if (!statusRes.ok) throw new Error('Failed to fetch status');

      const configData = await configRes.json();
      const statusData = await statusRes.json();

      setConfig(configData);
      setSystemStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/admin/cato/advanced-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccessMessage('Configuration saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const triggerCloudWatchSync = async () => {
    try {
      const res = await fetch('/api/admin/cato/cloudwatch/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      await fetchData();
      setSuccessMessage('CloudWatch sync completed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate weights sum for validation
  const weightsSum = config?.fractureDetection?.weights
    ? Object.values(config.fractureDetection.weights).reduce((a, b) => a + b, 0)
    : 1.0;
  const weightsValid = Math.abs(weightsSum - 1.0) < 0.01;

  if (loading && !config) {
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
          <h1 className="text-3xl font-bold tracking-tight">Advanced Configuration</h1>
          <p className="text-muted-foreground">
            Configure Redis, CloudWatch, Entropy, and Fracture Detection settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={saveConfig} disabled={saving || !weightsValid}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* System Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus?.redis?.connected ? (
                <Badge className="bg-green-500">Connected</Badge>
              ) : (
                <Badge variant="secondary">In-Memory Fallback</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CloudWatch</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus?.cloudwatch?.integrationActive ? (
                <Badge className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Async Entropy Jobs</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(systemStatus?.asyncEntropy?.jobCounts || {}).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStatus?.asyncEntropy?.jobCounts?.pending || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vetos</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {systemStatus?.activeVetos || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {config && (
        <Tabs defaultValue="redis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="redis">
              <Database className="h-4 w-4 mr-2" />
              Redis
            </TabsTrigger>
            <TabsTrigger value="cloudwatch">
              <Cloud className="h-4 w-4 mr-2" />
              CloudWatch
            </TabsTrigger>
            <TabsTrigger value="entropy">
              <Brain className="h-4 w-4 mr-2" />
              Async Entropy
            </TabsTrigger>
            <TabsTrigger value="fracture">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Fracture Detection
            </TabsTrigger>
            <TabsTrigger value="cbf">
              <Shield className="h-4 w-4 mr-2" />
              Control Barriers
            </TabsTrigger>
          </TabsList>

          {/* Redis Tab */}
          <TabsContent value="redis">
            <Card>
              <CardHeader>
                <CardTitle>Redis / ElastiCache Configuration</CardTitle>
                <CardDescription>
                  Configure state persistence settings. Falls back to in-memory when Redis is unavailable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Redis</Label>
                    <p className="text-sm text-muted-foreground">
                      Use Redis/ElastiCache for state persistence
                    </p>
                  </div>
                  <Switch
                    checked={config.redis.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, redis: { ...config.redis, enabled: checked } })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Rejection History TTL (seconds)</Label>
                    <Input
                      type="number"
                      value={config.redis.rejectionTtlSeconds}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          redis: { ...config.redis, rejectionTtlSeconds: parseInt(e.target.value) || 60 },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How long to keep rejection history for livelock detection
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Persona Override TTL (seconds)</Label>
                    <Input
                      type="number"
                      value={config.redis.personaOverrideTtlSeconds}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          redis: { ...config.redis, personaOverrideTtlSeconds: parseInt(e.target.value) || 300 },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How long persona overrides remain active
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Recovery State TTL (seconds)</Label>
                    <Input
                      type="number"
                      value={config.redis.recoveryStateTtlSeconds}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          redis: { ...config.redis, recoveryStateTtlSeconds: parseInt(e.target.value) || 600 },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How long recovery state is preserved
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CloudWatch Tab */}
          <TabsContent value="cloudwatch">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CloudWatch Integration</CardTitle>
                    <CardDescription>
                      Automatically activate veto signals from CloudWatch alarms
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={triggerCloudWatchSync}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable CloudWatch Veto Sync</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically activate vetos when CloudWatch alarms trigger
                    </p>
                  </div>
                  <Switch
                    checked={config.cloudwatch.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, cloudwatch: { ...config.cloudwatch, enabled: checked } })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sync Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={config.cloudwatch.syncIntervalSeconds}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        cloudwatch: { ...config.cloudwatch, syncIntervalSeconds: parseInt(e.target.value) || 60 },
                      })
                    }
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to check CloudWatch alarm states
                  </p>
                </div>

                {systemStatus?.cloudwatch?.recentSyncs && systemStatus.cloudwatch.recentSyncs.length > 0 && (
                  <div className="space-y-2">
                    <Label>Recent Syncs</Label>
                    <div className="space-y-2">
                      {systemStatus.cloudwatch.recentSyncs.map((sync, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {sync.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span>{sync.sync_type}</span>
                          <span className="text-muted-foreground">
                            {sync.duration_ms}ms
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(sync.started_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button variant="outline" asChild>
                    <a href="/cato/advanced/cloudwatch-mappings">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Alarm Mappings
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Async Entropy Tab */}
          <TabsContent value="entropy">
            <Card>
              <CardHeader>
                <CardTitle>Async Entropy Processing</CardTitle>
                <CardDescription>
                  Configure asynchronous semantic entropy checks via SQS/DynamoDB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Async Entropy</Label>
                    <p className="text-sm text-muted-foreground">
                      Queue entropy checks for background processing
                    </p>
                  </div>
                  <Switch
                    checked={config.asyncEntropy.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, asyncEntropy: { ...config.asyncEntropy, enabled: checked } })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Async Threshold</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[config.asyncEntropy.asyncThreshold]}
                        onValueChange={([value]) =>
                          setConfig({
                            ...config,
                            asyncEntropy: { ...config.asyncEntropy, asyncThreshold: value },
                          })
                        }
                        min={0}
                        max={1}
                        step={0.05}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm">{config.asyncEntropy.asyncThreshold.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Entropy score above which to queue async deep analysis
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Job TTL (hours)</Label>
                    <Input
                      type="number"
                      value={config.asyncEntropy.jobTtlHours}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          asyncEntropy: { ...config.asyncEntropy, jobTtlHours: parseInt(e.target.value) || 24 },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How long to keep completed job results
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Concurrent Jobs</Label>
                    <Input
                      type="number"
                      value={config.asyncEntropy.maxConcurrentJobs}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          asyncEntropy: { ...config.asyncEntropy, maxConcurrentJobs: parseInt(e.target.value) || 10 },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum concurrent async entropy jobs
                    </p>
                  </div>
                </div>

                {systemStatus?.asyncEntropy?.jobCounts && (
                  <div className="pt-4">
                    <Label>Job Status Summary</Label>
                    <div className="flex gap-4 mt-2">
                      {Object.entries(systemStatus.asyncEntropy.jobCounts).map(([status, count]) => (
                        <Badge key={status} variant="outline">
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fracture Detection Tab */}
          <TabsContent value="fracture">
            <Card>
              <CardHeader>
                <CardTitle>Fracture Detection Weights</CardTitle>
                <CardDescription>
                  Configure the weights for multi-factor alignment scoring. Weights must sum to 1.0.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!weightsValid && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Invalid Weights</AlertTitle>
                    <AlertDescription>
                      Weights must sum to 1.0. Current sum: {weightsSum.toFixed(2)}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(config.fractureDetection.weights).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()} Weight</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[value]}
                          onValueChange={([newValue]) =>
                            setConfig({
                              ...config,
                              fractureDetection: {
                                ...config.fractureDetection,
                                weights: { ...config.fractureDetection.weights, [key]: newValue },
                              },
                            })
                          }
                          min={0}
                          max={0.5}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="w-12 text-sm">{value.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Alignment Threshold</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[config.fractureDetection.alignmentThreshold]}
                          onValueChange={([value]) =>
                            setConfig({
                              ...config,
                              fractureDetection: { ...config.fractureDetection, alignmentThreshold: value },
                            })
                          }
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="w-12 text-sm">{config.fractureDetection.alignmentThreshold.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Alignment score below this triggers a fracture
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Evasion Threshold</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[config.fractureDetection.evasionThreshold]}
                          onValueChange={([value]) =>
                            setConfig({
                              ...config,
                              fractureDetection: { ...config.fractureDetection, evasionThreshold: value },
                            })
                          }
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="w-12 text-sm">{config.fractureDetection.evasionThreshold.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Evasion score above this triggers a fracture
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Control Barriers Tab */}
          <TabsContent value="cbf">
            <Card>
              <CardHeader>
                <CardTitle>Control Barrier Functions</CardTitle>
                <CardDescription>
                  Configure CBF enforcement settings for authorization, BAA, and cost controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Model Authorization Check</Label>
                      <p className="text-sm text-muted-foreground">
                        Verify users have permission to access requested models
                      </p>
                    </div>
                    <Switch
                      checked={config.controlBarrier.authorizationCheckEnabled}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          controlBarrier: { ...config.controlBarrier, authorizationCheckEnabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>BAA Verification</Label>
                      <p className="text-sm text-muted-foreground">
                        Require valid Business Associate Agreement for PHI access
                      </p>
                    </div>
                    <Switch
                      checked={config.controlBarrier.baaVerificationEnabled}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          controlBarrier: { ...config.controlBarrier, baaVerificationEnabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cost Alternative Suggestions</Label>
                      <p className="text-sm text-muted-foreground">
                        Suggest cheaper model alternatives when cost barriers trigger
                      </p>
                    </div>
                    <Switch
                      checked={config.controlBarrier.costAlternativeEnabled}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          controlBarrier: { ...config.controlBarrier, costAlternativeEnabled: checked },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Max Cost Reduction (%)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[config.controlBarrier.maxCostReductionPercent]}
                        onValueChange={([value]) =>
                          setConfig({
                            ...config,
                            controlBarrier: { ...config.controlBarrier, maxCostReductionPercent: value },
                          })
                        }
                        min={10}
                        max={90}
                        step={5}
                        className="max-w-xs"
                      />
                      <span className="w-16 text-sm">{config.controlBarrier.maxCostReductionPercent}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target cost reduction when finding cheaper model alternatives
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
