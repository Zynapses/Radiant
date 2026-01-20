'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LayoutGrid, 
  Columns, 
  Rows, 
  Square, 
  GitCompare, 
  GitMerge,
  Activity,
  Settings,
  Save,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ConcurrentExecutionConfig {
  enabled: boolean;
  maxPanes: number;
  maxConcurrentTasks: number;
  maxQueueDepth: number;
  defaultLayout: string;
  defaultSyncMode: string;
  enableComparison: boolean;
  enableMerge: boolean;
  websocketConfig: {
    maxConcurrentStreams: number;
    heartbeatInterval: number;
  };
}

interface ConcurrentMetrics {
  totalTasks: number;
  concurrentPeakTasks: number;
  averageConcurrency: number;
  tasksByType: Record<string, number>;
  averageLatencyMs: number;
  totalCostUsd: number;
  comparisonsMade: number;
  mergesPerformed: number;
}

const layoutOptions = [
  { value: 'single', label: 'Single', icon: Square },
  { value: 'horizontal-2', label: 'Horizontal Split', icon: Columns },
  { value: 'vertical-2', label: 'Vertical Split', icon: Rows },
  { value: 'grid-4', label: '2x2 Grid', icon: LayoutGrid },
  { value: 'focus-left', label: 'Focus Left', icon: Columns },
  { value: 'focus-right', label: 'Focus Right', icon: Columns },
];

const syncModes = [
  { value: 'independent', label: 'Independent', description: 'Each pane operates separately' },
  { value: 'mirror-input', label: 'Mirror Input', description: 'Same prompt to all panes' },
  { value: 'compare-output', label: 'Compare Output', description: 'Auto-compare when done' },
];

export default function ConcurrentExecutionPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConcurrentExecutionConfig>({
    enabled: true,
    maxPanes: 4,
    maxConcurrentTasks: 4,
    maxQueueDepth: 20,
    defaultLayout: 'horizontal-2',
    defaultSyncMode: 'independent',
    enableComparison: true,
    enableMerge: true,
    websocketConfig: {
      maxConcurrentStreams: 4,
      heartbeatInterval: 30000,
    },
  });
  const [metrics, setMetrics] = useState<ConcurrentMetrics | null>(null);

  useEffect(() => {
    loadConfig();
    loadMetrics();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/thinktank/concurrent/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/thinktank/concurrent/metrics?period=day');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/thinktank/concurrent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        toast({
          title: 'Configuration saved',
          description: 'Concurrent execution settings have been updated.',
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold tracking-tight">Concurrent Task Execution</h1>
          <p className="text-muted-foreground">
            Configure split-pane UI and multi-task execution settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? 'default' : 'secondary'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge variant="outline">Moat #17</Badge>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Activity className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Enable or disable concurrent execution and set basic limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Concurrent Execution</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to run multiple AI tasks simultaneously
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Maximum Panes</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Maximum split panes allowed: {config.maxPanes}
                  </p>
                  <Slider
                    value={[config.maxPanes]}
                    onValueChange={([value]) => setConfig({ ...config, maxPanes: value })}
                    min={1}
                    max={8}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Maximum Concurrent Tasks</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Simultaneous tasks: {config.maxConcurrentTasks}
                  </p>
                  <Slider
                    value={[config.maxConcurrentTasks]}
                    onValueChange={([value]) => setConfig({ ...config, maxConcurrentTasks: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Queue Depth</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Maximum queued tasks: {config.maxQueueDepth}
                  </p>
                  <Slider
                    value={[config.maxQueueDepth]}
                    onValueChange={([value]) => setConfig({ ...config, maxQueueDepth: value })}
                    min={1}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>WebSocket Streams</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Max concurrent streams: {config.websocketConfig.maxConcurrentStreams}
                  </p>
                  <Slider
                    value={[config.websocketConfig.maxConcurrentStreams]}
                    onValueChange={([value]) => setConfig({ 
                      ...config, 
                      websocketConfig: { ...config.websocketConfig, maxConcurrentStreams: value }
                    })}
                    min={1}
                    max={8}
                    step={1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" />
                Layout & Sync Settings
              </CardTitle>
              <CardDescription>
                Configure default pane layouts and synchronization behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Default Layout</Label>
                <div className="grid grid-cols-6 gap-2">
                  {layoutOptions.map((layout) => {
                    const Icon = layout.icon;
                    return (
                      <button
                        key={layout.value}
                        onClick={() => setConfig({ ...config, defaultLayout: layout.value })}
                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                          config.defaultLayout === layout.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs">{layout.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Sync Mode</Label>
                <Select
                  value={config.defaultSyncMode}
                  onValueChange={(value) => setConfig({ ...config, defaultSyncMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {syncModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        <div>
                          <div className="font-medium">{mode.label}</div>
                          <div className="text-xs text-muted-foreground">{mode.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Comparison & Merge
              </CardTitle>
              <CardDescription>
                Enable task comparison and merging capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <GitCompare className="h-4 w-4" />
                    Enable Task Comparison
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to compare outputs from multiple tasks
                  </p>
                </div>
                <Switch
                  checked={config.enableComparison}
                  onCheckedChange={(enableComparison) => setConfig({ ...config, enableComparison })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4" />
                    Enable Task Merging
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to merge best parts from multiple outputs
                  </p>
                </div>
                <Switch
                  checked={config.enableMerge}
                  onCheckedChange={(enableMerge) => setConfig({ ...config, enableMerge })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {metrics && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalTasks}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Peak Concurrent
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.concurrentPeakTasks}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg Latency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.averageLatencyMs}ms</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Comparisons
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.comparisonsMade}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tasks by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 gap-4">
                    {Object.entries(metrics.tasksByType).map(([type, count]) => (
                      <div key={type} className="text-center p-4 border rounded-lg">
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-sm text-muted-foreground capitalize">{type}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
