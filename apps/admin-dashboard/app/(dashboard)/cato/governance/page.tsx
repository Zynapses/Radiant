'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Scale,
  Rocket,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  History,
  Settings,
  Gauge,
} from 'lucide-react';

type GovernancePreset = 'paranoid' | 'balanced' | 'cowboy';
type CheckpointMode = 'ALWAYS' | 'CONDITIONAL' | 'NEVER' | 'NOTIFY_ONLY';

interface GovernanceConfig {
  activePreset: GovernancePreset;
  customFrictionLevel?: number;
  customAutoApproveThreshold?: number;
  dailyBudgetCents: number;
  maxActionCostCents: number;
  complianceFrameworks: string[];
  checkpoints: {
    afterObserver: CheckpointMode;
    afterProposer: CheckpointMode;
    afterCritics: CheckpointMode;
    beforeExecution: CheckpointMode;
    afterExecution: CheckpointMode;
  };
}

interface GovernanceMetrics {
  totalCheckpoints: number;
  autoApproved: number;
  userApproved: number;
  rejected: number;
  modified: number;
  timeouts: number;
  avgDecisionTimeMs: number;
  byCheckpointType: Record<string, number>;
}

interface PresetChangeHistory {
  id: string;
  previousPreset: string | null;
  newPreset: string;
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
}

const PRESET_CONFIG: Record<GovernancePreset, {
  icon: React.ReactNode;
  displayName: string;
  description: string;
  frictionLevel: number;
  color: string;
}> = {
  paranoid: {
    icon: <Shield className="h-6 w-6" />,
    displayName: 'Paranoid',
    description: 'Every decision requires human approval. Maximum oversight.',
    frictionLevel: 1.0,
    color: 'text-red-500',
  },
  balanced: {
    icon: <Scale className="h-6 w-6" />,
    displayName: 'Balanced',
    description: 'Auto-approve low-risk actions, checkpoint for medium and high risk.',
    frictionLevel: 0.5,
    color: 'text-yellow-500',
  },
  cowboy: {
    icon: <Rocket className="h-6 w-6" />,
    displayName: 'Cowboy',
    description: 'Full autonomy. Humans notified asynchronously.',
    frictionLevel: 0.1,
    color: 'text-green-500',
  },
};

const CHECKPOINT_LABELS: Record<string, string> = {
  afterObserver: 'After Observer (Intent Classification)',
  afterProposer: 'After Proposer (Plan Generation)',
  afterCritics: 'After Critics (Risk Review)',
  beforeExecution: 'Before Execution',
  afterExecution: 'After Execution (Review)',
};

export default function GovernancePresetsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [metrics, setMetrics] = useState<GovernanceMetrics | null>(null);
  const [history, setHistory] = useState<PresetChangeHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [localPreset, setLocalPreset] = useState<GovernancePreset>('balanced');
  const [localFriction, setLocalFriction] = useState(0.5);
  const [customCheckpoints, setCustomCheckpoints] = useState<Record<string, CheckpointMode>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, metricsRes, historyRes] = await Promise.all([
        fetch('/api/admin/cato/governance/config'),
        fetch('/api/admin/cato/governance/metrics'),
        fetch('/api/admin/cato/governance/history'),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
        setLocalPreset(configData.activePreset);
        setLocalFriction(configData.customFrictionLevel ?? PRESET_CONFIG[configData.activePreset as GovernancePreset]?.frictionLevel ?? 0.5);
        setCustomCheckpoints(configData.checkpoints || {});
      }

      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }

      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load governance config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePresetChange = async (preset: GovernancePreset) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/cato/governance/preset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });

      if (!response.ok) throw new Error('Failed to update preset');

      setLocalPreset(preset);
      setLocalFriction(PRESET_CONFIG[preset].frictionLevel);
      setSuccess(`Switched to ${PRESET_CONFIG[preset].displayName} mode`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleFrictionChange = async (value: number[]) => {
    setLocalFriction(value[0]);
  };

  const handleFrictionCommit = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/cato/governance/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frictionLevel: localFriction }),
      });
      setSuccess('Friction level updated');
      fetchData();
    } catch (err) {
      setError('Failed to update friction level');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckpointChange = async (checkpoint: string, mode: CheckpointMode) => {
    setSaving(true);
    try {
      await fetch('/api/admin/cato/governance/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoints: { [checkpoint]: mode } }),
      });
      setCustomCheckpoints(prev => ({ ...prev, [checkpoint]: mode }));
      setSuccess(`Checkpoint ${checkpoint} updated to ${mode}`);
    } catch (err) {
      setError('Failed to update checkpoint');
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Governance Presets</h1>
          <p className="text-muted-foreground">
            Variable friction control - The Leash Metaphor
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Preset Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Select Governance Preset
          </CardTitle>
          <CardDescription>
            Choose how much human oversight is required for AI actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(PRESET_CONFIG) as GovernancePreset[]).map((preset) => {
              const { icon, displayName, description, color } = PRESET_CONFIG[preset];
              const isActive = localPreset === preset;

              return (
                <Card
                  key={preset}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isActive ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handlePresetChange(preset)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={color}>{icon}</div>
                      {isActive && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{displayName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Friction Slider */}
      <Card>
        <CardHeader>
          <CardTitle>Fine-Tune Friction Level</CardTitle>
          <CardDescription>
            Adjust the friction level within your selected preset
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-green-500" />
                Full Autonomy
              </span>
              <span className="flex items-center gap-2">
                Full Manual
                <Shield className="h-4 w-4 text-red-500" />
              </span>
            </div>

            <Slider
              value={[localFriction]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={handleFrictionChange}
              onValueCommit={handleFrictionCommit}
              disabled={saving}
            />

            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {(localFriction * 100).toFixed(0)}%
              </span>
              <span className="text-sm text-muted-foreground">
                {localFriction < 0.3 && 'Most actions auto-approved'}
                {localFriction >= 0.3 && localFriction < 0.7 && 'Balanced human oversight'}
                {localFriction >= 0.7 && 'Heavy human oversight required'}
              </span>
            </div>
          </div>

          {/* Visual representation */}
          <div className="relative h-8 rounded-full overflow-hidden bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all"
              style={{ left: `${localFriction * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checkpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checkpoints">
            <Settings className="h-4 w-4 mr-2" />
            Checkpoint Config
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Gauge className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Change History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkpoints">
          <Card>
            <CardHeader>
              <CardTitle>Checkpoint Configuration</CardTitle>
              <CardDescription>
                Override individual checkpoint behaviors (null = use preset default)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(CHECKPOINT_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        {key === 'afterObserver' && 'CP1: After intent classification'}
                        {key === 'afterProposer' && 'CP2: After plan generation'}
                        {key === 'afterCritics' && 'CP3: After risk/security review'}
                        {key === 'beforeExecution' && 'CP4: Final approval before action'}
                        {key === 'afterExecution' && 'CP5: Post-execution review'}
                      </p>
                    </div>
                    <Select
                      value={customCheckpoints[key] || 'default'}
                      onValueChange={(v) => handleCheckpointChange(key, v as CheckpointMode)}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALWAYS">Always</SelectItem>
                        <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                        <SelectItem value="NEVER">Never</SelectItem>
                        <SelectItem value="NOTIFY_ONLY">Notify Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Checkpoint Metrics (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{metrics.totalCheckpoints}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{metrics.autoApproved}</p>
                    <p className="text-sm text-muted-foreground">Auto-Approved</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{metrics.userApproved}</p>
                    <p className="text-sm text-muted-foreground">User-Approved</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{metrics.rejected}</p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{metrics.modified}</p>
                    <p className="text-sm text-muted-foreground">Modified</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{metrics.timeouts}</p>
                    <p className="text-sm text-muted-foreground">Timeouts</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No metrics available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Preset Change History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No changes recorded</p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {entry.previousPreset ? (
                              <>
                                {PRESET_CONFIG[entry.previousPreset as GovernancePreset]?.displayName || entry.previousPreset}
                                {' → '}
                                {PRESET_CONFIG[entry.newPreset as GovernancePreset]?.displayName || entry.newPreset}
                              </>
                            ) : (
                              `Set to ${PRESET_CONFIG[entry.newPreset as GovernancePreset]?.displayName || entry.newPreset}`
                            )}
                          </p>
                          {entry.changeReason && (
                            <p className="text-sm text-muted-foreground">{entry.changeReason}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(entry.createdAt).toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
