'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Brain, 
  Zap,
  Settings,
  TrendingUp,
  RefreshCw,
  Save,
  BookOpen,
  Target,
  Clock,
  Shield,
} from 'lucide-react';

interface EnhancedLearningConfig {
  enabled: boolean;
  learning_rate: number;
  batch_size: number;
  max_examples_per_session: number;
  feedback_weight: number;
  exploration_rate: number;
  memory_consolidation_interval_hours: number;
  min_confidence_threshold: number;
  enable_meta_learning: boolean;
  enable_curriculum_learning: boolean;
  enable_active_learning: boolean;
  safety_filter_level: 'strict' | 'moderate' | 'permissive';
  retention_days: number;
}

interface LearningStats {
  total_examples_learned: number;
  examples_today: number;
  avg_confidence_improvement: number;
  meta_learning_cycles: number;
  curriculum_stages_completed: number;
  active_queries_pending: number;
}

async function fetchConfig(): Promise<EnhancedLearningConfig> {
  const res = await fetch('/api/admin/enhanced-learning/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

async function fetchStats(): Promise<LearningStats> {
  const res = await fetch('/api/admin/enhanced-learning/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function updateConfig(config: Partial<EnhancedLearningConfig>): Promise<void> {
  const res = await fetch('/api/admin/enhanced-learning/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update config');
}

export default function EnhancedLearningPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['enhanced-learning-config'],
    queryFn: fetchConfig,
  });

  const { data: stats } = useQuery({
    queryKey: ['enhanced-learning-stats'],
    queryFn: fetchStats,
  });

  const [editedConfig, setEditedConfig] = useState<Partial<EnhancedLearningConfig>>({});

  const updateMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-learning-config'] });
      toast.success('Configuration saved');
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  const handleSave = () => {
    updateMutation.mutate({ ...config, ...editedConfig });
  };

  const getValue = <K extends keyof EnhancedLearningConfig>(key: K): EnhancedLearningConfig[K] => {
    return (editedConfig[key] ?? config?.[key]) as EnhancedLearningConfig[K];
  };

  const setValue = <K extends keyof EnhancedLearningConfig>(key: K, value: EnhancedLearningConfig[K]) => {
    setEditedConfig(prev => ({ ...prev, [key]: value }));
  };

  if (configLoading) {
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Enhanced Learning
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure advanced learning capabilities and meta-learning systems
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Examples Learned</CardDescription>
            <CardTitle className="text-3xl">{stats?.total_examples_learned?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today&apos;s Examples</CardDescription>
            <CardTitle className="text-3xl text-green-500">{stats?.examples_today || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Confidence Improvement</CardDescription>
            <CardTitle className="text-3xl text-blue-500">
              +{((stats?.avg_confidence_improvement || 0) * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Meta-Learning Cycles</CardDescription>
            <CardTitle className="text-3xl">{stats?.meta_learning_cycles || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Core enhanced learning configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Enable Enhanced Learning</Label>
                  <p className="text-sm text-muted-foreground">
                    Activate advanced learning capabilities
                  </p>
                </div>
                <Switch
                  checked={getValue('enabled')}
                  onCheckedChange={(v) => setValue('enabled', v)}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Examples per Session</Label>
                <Input
                  type="number"
                  value={getValue('max_examples_per_session') || 100}
                  onChange={(e) => setValue('max_examples_per_session', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum learning examples to process per user session
                </p>
              </div>

              <div className="space-y-2">
                <Label>Memory Consolidation Interval</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24"
                    value={getValue('memory_consolidation_interval_hours') || 24}
                    onChange={(e) => setValue('memory_consolidation_interval_hours', parseInt(e.target.value))}
                  />
                  <span className="text-muted-foreground">hours</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  How often to consolidate learned patterns into long-term memory
                </p>
              </div>

              <div className="space-y-2">
                <Label>Data Retention</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24"
                    value={getValue('retention_days') || 90}
                    onChange={(e) => setValue('retention_days', parseInt(e.target.value))}
                  />
                  <span className="text-muted-foreground">days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parameters" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Learning Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Learning Rate</Label>
                    <span className="text-sm font-mono">{(getValue('learning_rate') || 0.001).toFixed(4)}</span>
                  </div>
                  <Slider
                    value={[(getValue('learning_rate') || 0.001) * 10000]}
                    onValueChange={([v]) => setValue('learning_rate', v / 10000)}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Feedback Weight</Label>
                    <span className="text-sm font-mono">{(getValue('feedback_weight') || 0.5).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[(getValue('feedback_weight') || 0.5) * 100]}
                    onValueChange={([v]) => setValue('feedback_weight', v / 100)}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Exploration Rate</Label>
                    <span className="text-sm font-mono">{(getValue('exploration_rate') || 0.1).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[(getValue('exploration_rate') || 0.1) * 100]}
                    onValueChange={([v]) => setValue('exploration_rate', v / 100)}
                    max={50}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Thresholds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={getValue('batch_size') || 32}
                    onChange={(e) => setValue('batch_size', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Confidence Threshold</Label>
                    <span className="text-sm font-mono">{((getValue('min_confidence_threshold') || 0.7) * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[(getValue('min_confidence_threshold') || 0.7) * 100]}
                    onValueChange={([v]) => setValue('min_confidence_threshold', v / 100)}
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum confidence required before applying learned patterns
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Advanced Features
              </CardTitle>
              <CardDescription>
                Enable or disable advanced learning capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <Label className="text-base">Meta-Learning</Label>
                    <p className="text-sm text-muted-foreground">
                      Learn how to learn more effectively over time
                    </p>
                  </div>
                </div>
                <Switch
                  checked={getValue('enable_meta_learning')}
                  onCheckedChange={(v) => setValue('enable_meta_learning', v)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <Label className="text-base">Curriculum Learning</Label>
                    <p className="text-sm text-muted-foreground">
                      Progressive difficulty scaling for optimal learning
                    </p>
                  </div>
                </div>
                <Switch
                  checked={getValue('enable_curriculum_learning')}
                  onCheckedChange={(v) => setValue('enable_curriculum_learning', v)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <Label className="text-base">Active Learning</Label>
                    <p className="text-sm text-muted-foreground">
                      Proactively seek informative examples
                    </p>
                  </div>
                </div>
                <Switch
                  checked={getValue('enable_active_learning')}
                  onCheckedChange={(v) => setValue('enable_active_learning', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Controls
              </CardTitle>
              <CardDescription>
                Configure safety filters and guardrails for learning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Safety Filter Level</Label>
                <Select
                  value={getValue('safety_filter_level') || 'moderate'}
                  onValueChange={(v) => setValue('safety_filter_level', v as 'strict' | 'moderate' | 'permissive')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict - Maximum safety filtering</SelectItem>
                    <SelectItem value="moderate">Moderate - Balanced approach</SelectItem>
                    <SelectItem value="permissive">Permissive - Minimal filtering</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Controls how aggressively unsafe learning examples are filtered
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
