'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Gauge,
  RefreshCw,
  AlertTriangle,
  Shield,
  Rocket,
  Scale,
  Clock,
  CheckCircle,
  XCircle,
  History,
  Settings,
  TrendingUp,
} from 'lucide-react';

type GovernancePreset = 'paranoid' | 'balanced' | 'cowboy';
type CheckpointMode = 'ALWAYS' | 'CONDITIONAL' | 'NEVER' | 'NOTIFY_ONLY';

interface GovernanceConfig {
  activePreset: GovernancePreset;
  customFrictionLevel?: number;
  customAutoApproveThreshold?: number;
  customCheckpoints?: {
    afterObserver?: CheckpointMode;
    afterProposer?: CheckpointMode;
    afterCritics?: CheckpointMode;
    beforeExecution?: CheckpointMode;
    afterExecution?: CheckpointMode;
  };
  dailyBudgetCents: number;
  maxActionCostCents: number;
  complianceFrameworks: string[];
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

interface PresetChange {
  id: string;
  previousPreset: string | null;
  newPreset: string;
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
}

const PRESET_CONFIG = {
  paranoid: {
    icon: Shield,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    displayName: 'Paranoid',
    description: 'Every decision requires human approval. Maximum oversight.',
    frictionLevel: 1.0,
  },
  balanced: {
    icon: Scale,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    displayName: 'Balanced',
    description: 'Auto-approve low-risk actions, checkpoint medium and high risk.',
    frictionLevel: 0.5,
  },
  cowboy: {
    icon: Rocket,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    displayName: 'Cowboy',
    description: 'Full autonomy. Humans notified asynchronously.',
    frictionLevel: 0.1,
  },
};

export default function GovernancePage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [metrics, setMetrics] = useState<GovernanceMetrics | null>(null);
  const [history, setHistory] = useState<PresetChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Custom overrides
  const [customFriction, setCustomFriction] = useState<number>(0.5);
  const [showOverrides, setShowOverrides] = useState(false);
  const [checkpointOverrides, setCheckpointOverrides] = useState<Record<string, CheckpointMode>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, metricsRes, historyRes] = await Promise.all([
        fetch('/api/admin/cato/governance/config'),
        fetch('/api/admin/cato/governance/metrics?days=7'),
        fetch('/api/admin/cato/governance/history?limit=20'),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config);
        if (data.config?.customFrictionLevel) {
          setCustomFriction(data.config.customFrictionLevel);
        } else if (data.effective?.frictionLevel) {
          setCustomFriction(data.effective.frictionLevel);
        }
        if (data.config?.customCheckpoints) {
          setCheckpointOverrides(data.config.customCheckpoints);
        }
      }
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load governance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const setPreset = async (preset: GovernancePreset) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cato/governance/preset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset, reason: `Switched to ${preset} mode` }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      setError('Failed to set preset');
    } finally {
      setSaving(false);
    }
  };

  const saveOverrides = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cato/governance/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frictionLevel: customFriction,
          checkpoints: checkpointOverrides,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      setError('Failed to save overrides');
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

  const activePreset = config?.activePreset || 'balanced';
  const presetInfo = PRESET_CONFIG[activePreset];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Gauge className="h-8 w-8 text-primary" />
            Governance Presets
          </h1>
          <p className="text-muted-foreground">
            Variable Friction Control - The Leash Metaphor
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

      <Tabs defaultValue="presets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="overrides">Custom Overrides</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-4">
          {/* Current Preset Display */}
          <Card className={`border-2 ${presetInfo.borderColor} ${presetInfo.bgColor}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <presetInfo.icon className={`h-6 w-6 ${presetInfo.color}`} />
                Current Preset: {presetInfo.displayName}
              </CardTitle>
              <CardDescription>{presetInfo.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Friction Level</Label>
                  <Progress value={presetInfo.frictionLevel * 100} className="h-3 mt-1" />
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {(presetInfo.frictionLevel * 100).toFixed(0)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Preset Selection Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(PRESET_CONFIG) as GovernancePreset[]).map((preset) => {
              const info = PRESET_CONFIG[preset];
              const isActive = activePreset === preset;
              return (
                <Card
                  key={preset}
                  className={`cursor-pointer transition-all ${
                    isActive
                      ? `ring-2 ring-primary ${info.bgColor}`
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => !isActive && setPreset(preset)}
                >
                  <CardHeader>
                    <info.icon className={`h-10 w-10 ${info.color} mb-2`} />
                    <CardTitle className="flex items-center gap-2">
                      {info.displayName}
                      {isActive && <Badge>Active</Badge>}
                    </CardTitle>
                    <CardDescription>{info.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      Friction: {(info.frictionLevel * 100).toFixed(0)}%
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Custom Overrides
              </CardTitle>
              <CardDescription>
                Fine-tune governance within your selected preset
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Friction Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Custom Friction Level</Label>
                  <span className="text-sm font-medium">
                    {(customFriction * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[customFriction * 100]}
                  onValueChange={([v]) => setCustomFriction(v / 100)}
                  min={0}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  0% = Full autonomy, 100% = Full manual approval
                </p>
              </div>

              {/* Checkpoint Overrides */}
              <div className="space-y-4">
                <Label>Checkpoint Mode Overrides</Label>
                {[
                  { key: 'afterObserver', label: 'CP1: After Observer (Intent Classification)' },
                  { key: 'afterProposer', label: 'CP2: After Proposer (Plan Generation)' },
                  { key: 'afterCritics', label: 'CP3: After Critics (Risk Review)' },
                  { key: 'beforeExecution', label: 'CP4: Before Execution (Final Approval)' },
                  { key: 'afterExecution', label: 'CP5: After Execution (Post-Review)' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <Select
                      value={checkpointOverrides[key] || 'inherit'}
                      onValueChange={(v) =>
                        setCheckpointOverrides((prev) => {
                          const next = { ...prev };
                          if (v === 'inherit') {
                            delete next[key];
                          } else {
                            next[key] = v as CheckpointMode;
                          }
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Use Preset</SelectItem>
                        <SelectItem value="ALWAYS">Always</SelectItem>
                        <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                        <SelectItem value="NEVER">Never</SelectItem>
                        <SelectItem value="NOTIFY_ONLY">Notify Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <Button onClick={saveOverrides} disabled={saving}>
                {saving ? 'Saving...' : 'Save Overrides'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metrics && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Checkpoints
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalCheckpoints}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Auto-Approved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.autoApproved}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.totalCheckpoints > 0
                        ? `${((metrics.autoApproved / metrics.totalCheckpoints) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      User Approved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.userApproved}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Rejected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{metrics.rejected}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Checkpoint Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(metrics.byCheckpointType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Avg Decision Time: {metrics.avgDecisionTimeMs.toFixed(0)}ms
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Preset Change History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {history.map((change) => (
                    <div
                      key={change.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {change.previousPreset && (
                            <>
                              <Badge variant="outline">{change.previousPreset}</Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge>{change.newPreset}</Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          {change.changedBy || 'System'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(change.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No preset changes recorded yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
