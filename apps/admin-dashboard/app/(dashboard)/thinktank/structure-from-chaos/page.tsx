'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles,
  FileText,
  Calendar,
  CheckSquare,
  Lightbulb,
  Activity,
  Settings,
  Save,
  RefreshCw,
  Network,
  Clock
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SynthesisConfig {
  enabled: boolean;
  defaultOutputType: string;
  extractEntities: boolean;
  extractRelationships: boolean;
  generateTimeline: boolean;
  generateActionItems: boolean;
  autoAssignTasks: boolean;
  confidenceThreshold: number;
  maxProcessingTimeMs: number;
}

interface SynthesisMetrics {
  totalSyntheses: number;
  byInputType: Record<string, number>;
  byOutputType: Record<string, number>;
  averageProcessingMs: number;
  averageConfidence: number;
  totalActionItemsGenerated: number;
  totalDecisionsExtracted: number;
  totalEntitiesFound: number;
}

const outputTypes = [
  { value: 'meeting_summary', label: 'Meeting Summary', icon: FileText },
  { value: 'action_items', label: 'Action Items', icon: CheckSquare },
  { value: 'decisions', label: 'Decisions', icon: Lightbulb },
  { value: 'project_plan', label: 'Project Plan', icon: Calendar },
  { value: 'knowledge_base', label: 'Knowledge Base', icon: Network },
  { value: 'timeline', label: 'Timeline', icon: Clock },
];

const inputTypes = [
  { value: 'whiteboard', label: 'Whiteboard' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'meeting_notes', label: 'Meeting Notes' },
  { value: 'voice_transcript', label: 'Voice Transcript' },
  { value: 'chat_history', label: 'Chat History' },
  { value: 'document_dump', label: 'Document Dump' },
];

export default function StructureFromChaosPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SynthesisConfig>({
    enabled: true,
    defaultOutputType: 'meeting_summary',
    extractEntities: true,
    extractRelationships: true,
    generateTimeline: true,
    generateActionItems: true,
    autoAssignTasks: false,
    confidenceThreshold: 0.7,
    maxProcessingTimeMs: 30000,
  });
  const [metrics, setMetrics] = useState<SynthesisMetrics | null>(null);

  useEffect(() => {
    loadConfig();
    loadMetrics();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/thinktank/chaos/config');
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
      const response = await fetch('/api/thinktank/chaos/metrics?period=day');
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
      const response = await fetch('/api/thinktank/chaos/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        toast({
          title: 'Configuration saved',
          description: 'Structure from Chaos settings have been updated.',
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
          <h1 className="text-3xl font-bold tracking-tight">Structure from Chaos</h1>
          <p className="text-muted-foreground">
            Transform whiteboards, brainstorms, and notes into structured outputs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? 'default' : 'secondary'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge variant="outline">Moat #20</Badge>
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
                <Sparkles className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Enable synthesis and configure default behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Structure from Chaos</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to synthesize unstructured inputs into structured outputs
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
                />
              </div>

              <div className="space-y-2">
                <Label>Default Output Type</Label>
                <div className="grid grid-cols-6 gap-2">
                  {outputTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setConfig({ ...config, defaultOutputType: type.value })}
                        className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                          config.defaultOutputType === type.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs text-center">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Confidence Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Minimum confidence: {Math.round(config.confidenceThreshold * 100)}%
                  </p>
                  <Slider
                    value={[config.confidenceThreshold * 100]}
                    onValueChange={([value]) => setConfig({ ...config, confidenceThreshold: value / 100 })}
                    min={50}
                    max={95}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Processing Timeout</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Max time: {config.maxProcessingTimeMs / 1000}s
                  </p>
                  <Slider
                    value={[config.maxProcessingTimeMs / 1000]}
                    onValueChange={([value]) => setConfig({ ...config, maxProcessingTimeMs: value * 1000 })}
                    min={10}
                    max={120}
                    step={10}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Extraction Settings
              </CardTitle>
              <CardDescription>
                Configure what information to extract from chaotic inputs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Extract Entities
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Identify people, organizations, dates, and concepts
                  </p>
                </div>
                <Switch
                  checked={config.extractEntities}
                  onCheckedChange={(extractEntities) => setConfig({ ...config, extractEntities })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Extract Relationships
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Identify connections between entities
                  </p>
                </div>
                <Switch
                  checked={config.extractRelationships}
                  onCheckedChange={(extractRelationships) => setConfig({ ...config, extractRelationships })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Generate Timeline
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Create chronological view of events
                  </p>
                </div>
                <Switch
                  checked={config.generateTimeline}
                  onCheckedChange={(generateTimeline) => setConfig({ ...config, generateTimeline })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Generate Action Items
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Extract tasks and to-dos from content
                  </p>
                </div>
                <Switch
                  checked={config.generateActionItems}
                  onCheckedChange={(generateActionItems) => setConfig({ ...config, generateActionItems })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Auto-Assign Tasks
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign tasks based on mentions
                  </p>
                </div>
                <Switch
                  checked={config.autoAssignTasks}
                  onCheckedChange={(autoAssignTasks) => setConfig({ ...config, autoAssignTasks })}
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
                      Total Syntheses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalSyntheses}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Action Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalActionItemsGenerated}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Decisions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalDecisionsExtracted}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Entities Found
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalEntitiesFound}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>By Input Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(metrics.byInputType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center p-2 border rounded">
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Output Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(metrics.byOutputType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center p-2 border rounded">
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-2xl font-bold">{metrics.averageProcessingMs}ms</div>
                      <div className="text-sm text-muted-foreground">Avg Processing Time</div>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-2xl font-bold">{Math.round(metrics.averageConfidence * 100)}%</div>
                      <div className="text-sm text-muted-foreground">Avg Confidence</div>
                    </div>
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
