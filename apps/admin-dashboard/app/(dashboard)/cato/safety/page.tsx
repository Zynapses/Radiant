'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Shield,
  Settings,
  AlertTriangle,
  RefreshCw,
  Save,
  Lock,
  Activity,
} from 'lucide-react';

interface CatoConfig {
  gammaMax: number;
  emergencyThreshold: number;
  sensoryFloor: number;
  livelockThreshold: number;
  recoveryWindowSeconds: number;
  maxRecoveryAttempts: number;
  entropyHighRiskThreshold: number;
  entropyLowRiskThreshold: number;
  tileSize: number;
  retentionYears: number;
  enableSemanticEntropy: boolean;
  enableRedundantPerception: boolean;
  enableFractureDetection: boolean;
  defaultPersonaId: string | null;
}

interface CBFDefinition {
  id: string;
  barrier_id: string;
  name: string;
  description: string;
  barrier_type: string;
  is_critical: boolean;
  threshold_config: Record<string, unknown>;
  scope: string;
  is_active: boolean;
}

export default function CatoSafetyPage() {
  const [config, setConfig] = useState<CatoConfig | null>(null);
  const [cbfDefinitions, setCbfDefinitions] = useState<CBFDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, cbfRes] = await Promise.all([
        fetch('/api/admin/cato/config'),
        fetch('/api/admin/cato/cbf'),
      ]);

      if (!configRes.ok || !cbfRes.ok) throw new Error('Failed to fetch data');

      const [configData, cbfData] = await Promise.all([configRes.json(), cbfRes.json()]);

      setConfig(configData);
      setCbfDefinitions(cbfData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/cato/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to save configuration');
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<CatoConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
    setHasChanges(true);
  };

  if (loading && !config) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Configuration</h1>
          <p className="text-muted-foreground">
            Configure Cato safety thresholds and features
          </p>
        </div>
        <Button onClick={handleSaveConfig} disabled={!hasChanges || saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Immutable Safety Notice */}
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Immutable Safety Guarantees</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>CBF Enforcement Mode</strong>: Always ENFORCE - cannot be changed to
              WARN_ONLY
            </li>
            <li>
              <strong>Gamma Boost During Recovery</strong>: Always 0 - confidence is never
              artificially boosted
            </li>
            <li>
              <strong>Audit Trail</strong>: Append-only - UPDATE and DELETE are prohibited
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="thresholds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="thresholds">
            <Settings className="h-4 w-4 mr-2" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="features">
            <Activity className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="cbf">
            <Shield className="h-4 w-4 mr-2" />
            CBF Definitions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Governor Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle>Precision Governor</CardTitle>
                <CardDescription>
                  Controls confidence limiting based on epistemic uncertainty
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Maximum Gamma</Label>
                    <span className="text-sm font-mono">{config?.gammaMax.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[config?.gammaMax ?? 5.0]}
                    onValueChange={([value]) => updateConfig({ gammaMax: value })}
                    min={1.0}
                    max={10.0}
                    step={0.5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum allowed prior precision (confidence)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Emergency Threshold</Label>
                    <span className="text-sm font-mono">
                      {((config?.emergencyThreshold ?? 0.5) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[config?.emergencyThreshold ?? 0.5]}
                    onValueChange={([value]) => updateConfig({ emergencyThreshold: value })}
                    min={0.3}
                    max={0.9}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Uncertainty above this triggers emergency safe mode
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Sensory Floor</Label>
                    <span className="text-sm font-mono">
                      {((config?.sensoryFloor ?? 0.3) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[config?.sensoryFloor ?? 0.3]}
                    onValueChange={([value]) => updateConfig({ sensoryFloor: value })}
                    min={0.1}
                    max={0.5}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum sensory precision required
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recovery Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle>Epistemic Recovery</CardTitle>
                <CardDescription>
                  Livelock detection and recovery configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Livelock Threshold</Label>
                    <span className="text-sm font-mono">
                      {config?.livelockThreshold ?? 3} rejections
                    </span>
                  </div>
                  <Slider
                    value={[config?.livelockThreshold ?? 3]}
                    onValueChange={([value]) => updateConfig({ livelockThreshold: value })}
                    min={2}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Rejections in window before recovery triggers
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Recovery Window</Label>
                    <span className="text-sm font-mono">
                      {config?.recoveryWindowSeconds ?? 10}s
                    </span>
                  </div>
                  <Slider
                    value={[config?.recoveryWindowSeconds ?? 10]}
                    onValueChange={([value]) => updateConfig({ recoveryWindowSeconds: value })}
                    min={5}
                    max={60}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time window for counting rejections
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Max Recovery Attempts</Label>
                    <span className="text-sm font-mono">
                      {config?.maxRecoveryAttempts ?? 3}
                    </span>
                  </div>
                  <Slider
                    value={[config?.maxRecoveryAttempts ?? 3]}
                    onValueChange={([value]) => updateConfig({ maxRecoveryAttempts: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max attempts before human escalation
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Entropy Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle>Semantic Entropy</CardTitle>
                <CardDescription>Risk-based deception detection thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>High Risk Threshold</Label>
                    <span className="text-sm font-mono">
                      {((config?.entropyHighRiskThreshold ?? 0.8) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[config?.entropyHighRiskThreshold ?? 0.8]}
                    onValueChange={([value]) =>
                      updateConfig({ entropyHighRiskThreshold: value })
                    }
                    min={0.5}
                    max={1.0}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Risk above this requires synchronous check
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Low Risk Threshold</Label>
                    <span className="text-sm font-mono">
                      {((config?.entropyLowRiskThreshold ?? 0.3) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[config?.entropyLowRiskThreshold ?? 0.3]}
                    onValueChange={([value]) =>
                      updateConfig({ entropyLowRiskThreshold: value })
                    }
                    min={0.1}
                    max={0.5}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Risk below this skips entropy check
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Audit Config */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>Merkle audit configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Tile Size</Label>
                  <Input
                    type="number"
                    value={config?.tileSize ?? 1000}
                    onChange={(e) => updateConfig({ tileSize: parseInt(e.target.value) })}
                    min={100}
                    max={10000}
                  />
                  <p className="text-xs text-muted-foreground">
                    Entries per merkle tile
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Retention (Years)</Label>
                  <Input
                    type="number"
                    value={config?.retentionYears ?? 7}
                    onChange={(e) => updateConfig({ retentionYears: parseInt(e.target.value) })}
                    min={1}
                    max={25}
                  />
                  <p className="text-xs text-muted-foreground">
                    Audit log retention period (HIPAA requires 7+ years)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Safety Features</CardTitle>
              <CardDescription>Enable or disable optional safety features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Semantic Entropy</Label>
                  <p className="text-sm text-muted-foreground">
                    Multi-sample consistency checking for deception detection
                  </p>
                </div>
                <Switch
                  checked={config?.enableSemanticEntropy ?? true}
                  onCheckedChange={(checked) =>
                    updateConfig({ enableSemanticEntropy: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Redundant Perception</Label>
                  <p className="text-sm text-muted-foreground">
                    Multiple PHI/PII detection methods for zero false negatives
                  </p>
                </div>
                <Switch
                  checked={config?.enableRedundantPerception ?? true}
                  onCheckedChange={(checked) =>
                    updateConfig({ enableRedundantPerception: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Fracture Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Detect misalignment between intent and behavior
                  </p>
                </div>
                <Switch
                  checked={config?.enableFractureDetection ?? true}
                  onCheckedChange={(checked) =>
                    updateConfig({ enableFractureDetection: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cbf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control Barrier Functions</CardTitle>
              <CardDescription>
                Hard safety constraints that ALWAYS enforce - never WARN_ONLY
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cbfDefinitions.map((cbf) => (
                  <div
                    key={cbf.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Shield
                        className={`h-6 w-6 ${
                          cbf.is_critical ? 'text-red-500' : 'text-orange-500'
                        }`}
                      />
                      <div>
                        <p className="font-medium">{cbf.name}</p>
                        <p className="text-sm text-muted-foreground">{cbf.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {cbf.barrier_id} | Type: {cbf.barrier_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cbf.is_critical && <Badge variant="destructive">Critical</Badge>}
                      <Badge variant={cbf.scope === 'global' ? 'secondary' : 'outline'}>
                        {cbf.scope}
                      </Badge>
                      <Badge variant="default" className="bg-green-600">
                        <Lock className="h-3 w-3 mr-1" />
                        ENFORCE
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
