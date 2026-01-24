'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Rocket,
  Shield,
  Brain,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Eye,
  Lock,
  Unlock,
  BarChart3,
  Clock,
  Target,
  Sparkles,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';

interface GenesisConfig {
  enabled: boolean;
  autonomyLevel: number;
  safetyThreshold: number;
  learningRate: number;
  explorationEnabled: boolean;
  selfImprovementEnabled: boolean;
  humanOversightRequired: boolean;
  maxActionsPerMinute: number;
}

interface GenesisMetrics {
  totalDecisions: number;
  autonomousActions: number;
  humanInterventions: number;
  safetyViolations: number;
  learningCycles: number;
  avgConfidence: number;
  uptime: string;
}

const defaultConfig: GenesisConfig = {
  enabled: true,
  autonomyLevel: 65,
  safetyThreshold: 85,
  learningRate: 0.7,
  explorationEnabled: true,
  selfImprovementEnabled: false,
  humanOversightRequired: true,
  maxActionsPerMinute: 100,
};

const defaultMetrics: GenesisMetrics = {
  totalDecisions: 0,
  autonomousActions: 0,
  humanInterventions: 0,
  safetyViolations: 0,
  learningCycles: 0,
  avgConfidence: 0,
  uptime: '0%',
};

export default function CatoGenesisPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<GenesisConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch genesis configuration
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['cato', 'genesis', 'config'],
    queryFn: () => apiClient.get<GenesisConfig>('/api/admin/cato/genesis/config'),
  });

  // Fetch genesis metrics
  const { data: metrics = defaultMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['cato', 'genesis', 'metrics'],
    queryFn: () => apiClient.get<GenesisMetrics>('/api/admin/cato/genesis/metrics'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: GenesisConfig) => apiClient.put<GenesisConfig>('/api/admin/cato/genesis/config', newConfig),
    onSuccess: () => {
      toast({ title: 'Configuration saved', description: 'Genesis configuration updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['cato', 'genesis', 'config'] });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Sync config from server
  useEffect(() => {
    if (configData) {
      setConfig(configData);
    }
  }, [configData]);

  const updateConfig = (key: keyof GenesisConfig, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateConfigMutation.mutate(config);
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            Cato Genesis
          </h1>
          <p className="text-muted-foreground">
            Autonomous AI genesis and self-improvement configuration
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-sm">
            {config.enabled ? 'Active' : 'Inactive'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetchMetrics()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasChanges && (
            <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
              {updateConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Brain className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.totalDecisions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Decisions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.autonomousActions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Autonomous Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Eye className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.humanInterventions}</p>
                <p className="text-sm text-muted-foreground">Human Interventions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.safetyViolations}</p>
                <p className="text-sm text-muted-foreground">Safety Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="autonomy">Autonomy Controls</TabsTrigger>
          <TabsTrigger value="safety">Safety Guardrails</TabsTrigger>
          <TabsTrigger value="learning">Learning & Evolution</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Genesis Status
                </CardTitle>
                <CardDescription>Enable or disable autonomous genesis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Genesis Engine</Label>
                    <p className="text-sm text-muted-foreground">Enable autonomous decision-making</p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(v) => updateConfig('enabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Exploration Mode</Label>
                    <p className="text-sm text-muted-foreground">Allow exploration of new strategies</p>
                  </div>
                  <Switch
                    checked={config.explorationEnabled}
                    onCheckedChange={(v) => updateConfig('explorationEnabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Human Oversight Required</Label>
                    <p className="text-sm text-muted-foreground">Require approval for critical actions</p>
                  </div>
                  <Switch
                    checked={config.humanOversightRequired}
                    onCheckedChange={(v) => updateConfig('humanOversightRequired', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
                <CardDescription>Current genesis performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Confidence</span>
                    <span className="font-medium">{Math.round(metrics.avgConfidence * 100)}%</span>
                  </div>
                  <Progress value={metrics.avgConfidence * 100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Autonomy Rate</span>
                    <span className="font-medium">
                      {Math.round((metrics.autonomousActions / metrics.totalDecisions) * 100)}%
                    </span>
                  </div>
                  <Progress value={(metrics.autonomousActions / metrics.totalDecisions) * 100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>System Uptime</span>
                    <span className="font-medium">{metrics.uptime}</span>
                  </div>
                  <Progress value={99.97} />
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Learning cycles: {metrics.learningCycles.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="autonomy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Autonomy Level Controls
              </CardTitle>
              <CardDescription>Configure the level of autonomous decision-making</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Autonomy Level</Label>
                  <span className="text-sm font-medium">{config.autonomyLevel}%</span>
                </div>
                <Slider
                  value={[config.autonomyLevel]}
                  onValueChange={([v]) => updateConfig('autonomyLevel', v)}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Supervised</span>
                  <span>Balanced</span>
                  <span>Autonomous</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Max Actions per Minute</Label>
                  <span className="text-sm font-medium">{config.maxActionsPerMinute}</span>
                </div>
                <Slider
                  value={[config.maxActionsPerMinute]}
                  onValueChange={([v]) => updateConfig('maxActionsPerMinute', v)}
                  max={500}
                  step={10}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center p-4 rounded-lg bg-muted">
                  <Lock className="h-6 w-6 mx-auto mb-2 text-red-500" />
                  <p className="text-sm font-medium">Restricted</p>
                  <p className="text-xs text-muted-foreground">0-30% autonomy</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted">
                  <Eye className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-sm font-medium">Monitored</p>
                  <p className="text-xs text-muted-foreground">31-70% autonomy</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted">
                  <Unlock className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Autonomous</p>
                  <p className="text-xs text-muted-foreground">71-100% autonomy</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Guardrails
              </CardTitle>
              <CardDescription>Configure safety thresholds and restrictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Safety Threshold</Label>
                  <span className="text-sm font-medium">{config.safetyThreshold}%</span>
                </div>
                <Slider
                  value={[config.safetyThreshold]}
                  onValueChange={([v]) => updateConfig('safetyThreshold', v)}
                  min={50}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Actions below this confidence threshold will require human approval
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Allowed Actions</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Read operations</li>
                    <li>• Analysis tasks</li>
                    <li>• Recommendations</li>
                    <li>• Non-destructive updates</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Restricted Actions</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Delete operations</li>
                    <li>• External API calls</li>
                    <li>• User data modifications</li>
                    <li>• System configuration changes</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Learning & Self-Improvement
              </CardTitle>
              <CardDescription>Configure learning and evolution parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Self-Improvement</Label>
                  <p className="text-sm text-muted-foreground">Allow system to optimize its own behavior</p>
                </div>
                <Switch
                  checked={config.selfImprovementEnabled}
                  onCheckedChange={(v) => updateConfig('selfImprovementEnabled', v)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Learning Rate</Label>
                  <span className="text-sm font-medium">{(config.learningRate * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.learningRate * 100]}
                  onValueChange={([v]) => updateConfig('learningRate', v / 100)}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Conservative</span>
                  <span>Balanced</span>
                  <span>Aggressive</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <h4 className="font-medium mb-2">Learning Statistics</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{metrics.learningCycles}</p>
                    <p className="text-xs text-muted-foreground">Learning Cycles</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">+12%</p>
                    <p className="text-xs text-muted-foreground">Efficiency Gain</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">-8%</p>
                    <p className="text-xs text-muted-foreground">Error Rate</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
