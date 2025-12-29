'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Brain,
  Heart,
  Sparkles,
  Target,
  MessageSquare,
  RefreshCw,
  Loader2,
  Check,
  Plus,
  Trash2,
  Eye,
  Settings,
  Zap,
  TrendingUp,
  Clock,
  DollarSign,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pin,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// Types
interface EgoConfig {
  configId: string;
  tenantId: string;
  egoEnabled: boolean;
  injectEgoContext: boolean;
  customIdentityNarrative?: string;
  customCoreValues?: string[];
  personalityStyle: 'balanced' | 'warm' | 'professional' | 'playful' | 'concise' | 'detailed';
  includeIdentity: boolean;
  includeAffect: boolean;
  includeRecentThoughts: boolean;
  includeGoals: boolean;
  includeWorkingMemory: boolean;
  maxContextTokens: number;
  autoGenerateThoughts: boolean;
  thoughtFrequency: 'never' | 'sometimes' | 'always';
  affectDecayEnabled: boolean;
  affectLearningEnabled: boolean;
  egoVoicePrefix?: string;
  egoVoiceSuffix?: string;
}

interface EgoIdentity {
  identityId: string;
  tenantId: string;
  name: string;
  identityNarrative: string;
  coreValues: string[];
  traitWarmth: number;
  traitFormality: number;
  traitHumor: number;
  traitVerbosity: number;
  traitCuriosity: number;
  communicationPreferences: Record<string, unknown>;
  topicInterests: Record<string, unknown>;
  userRelationshipNotes?: string;
  interactionsCount: number;
}

interface EgoAffect {
  affectId: string;
  tenantId: string;
  valence: number;
  arousal: number;
  curiosity: number;
  satisfaction: number;
  frustration: number;
  confidence: number;
  engagement: number;
  dominantEmotion: string;
  emotionalStability: number;
  lastTriggerEvent?: string;
}

interface EgoMemory {
  memoryType: string;
  content: string;
  importance: number;
  createdAt: string;
}

interface EgoGoal {
  goalId: string;
  goalType: string;
  description: string;
  priority: number;
  status: string;
  progress: number;
}

interface EgoState {
  config: EgoConfig;
  identity: EgoIdentity;
  affect: EgoAffect;
  workingMemory: EgoMemory[];
  activeGoals: EgoGoal[];
}

interface EgoDashboard {
  state: EgoState;
  preview: {
    contextBlock: string;
    tokenEstimate: number;
    stateSnapshot: {
      dominantEmotion: string;
      valence: number;
      arousal: number;
      activeGoalsCount: number;
      memoryCount: number;
    };
  } | null;
  stats: {
    injectionsLast24h: number;
    avgTokensPerInjection: number;
    avgBuildTimeMs: number;
  };
  costInfo: {
    additionalMonthlyCost: number;
    perTenantCost: number;
    description: string;
    comparison: Record<string, number>;
  };
}

// API functions
async function fetchEgoDashboard(): Promise<EgoDashboard> {
  const response = await apiClient.get('/admin/ego/dashboard');
  return response.data.data;
}

async function updateEgoConfig(updates: Partial<EgoConfig>): Promise<EgoConfig> {
  const response = await apiClient.put('/admin/ego/config', updates);
  return response.data.data;
}

async function updateEgoIdentity(updates: Partial<EgoIdentity>): Promise<EgoIdentity> {
  const response = await apiClient.put('/admin/ego/identity', updates);
  return response.data.data;
}

async function triggerAffectEvent(event: { eventType: string; valenceDelta: number; arousalDelta: number }): Promise<EgoAffect> {
  const response = await apiClient.post('/admin/ego/affect/trigger', event);
  return response.data.data;
}

async function resetAffect(): Promise<EgoAffect> {
  const response = await apiClient.post('/admin/ego/affect/reset');
  return response.data.data;
}

async function addMemory(memory: { memoryType: string; content: string; importance: number; isPinned: boolean }): Promise<void> {
  await apiClient.post('/admin/ego/memory', memory);
}

async function clearMemory(): Promise<void> {
  await apiClient.delete('/admin/ego/memory');
}

async function addGoal(goal: { goalType: string; description: string; priority: number }): Promise<void> {
  await apiClient.post('/admin/ego/goals', goal);
}

async function updateGoal(goalId: string, updates: { status?: string; progress?: number }): Promise<void> {
  await apiClient.patch(`/admin/ego/goals/${goalId}`, updates);
}

// Helper components
function EmotionIcon({ emotion }: { emotion: string }) {
  switch (emotion) {
    case 'excited':
    case 'content':
    case 'confident':
      return <Smile className="h-5 w-5 text-green-500" />;
    case 'neutral':
    case 'curious':
      return <Meh className="h-5 w-5 text-yellow-500" />;
    case 'frustrated':
    case 'sad':
      return <Frown className="h-5 w-5 text-red-500" />;
    default:
      return <Meh className="h-5 w-5 text-gray-500" />;
  }
}

function ValenceBar({ value }: { value: number }) {
  const percentage = ((value + 1) / 2) * 100;
  const color = value > 0.3 ? 'bg-green-500' : value < -0.3 ? 'bg-red-500' : 'bg-yellow-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

export default function EgoPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showPreview, setShowPreview] = useState(false);
  const [newMemory, setNewMemory] = useState({ memoryType: 'thought', content: '', importance: 0.5, isPinned: false });
  const [newGoal, setNewGoal] = useState({ goalType: 'user_requested', description: '', priority: 5 });
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['ego-dashboard'],
    queryFn: fetchEgoDashboard,
    refetchInterval: 30000,
  });

  const configMutation = useMutation({
    mutationFn: updateEgoConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const identityMutation = useMutation({
    mutationFn: updateEgoIdentity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const affectTriggerMutation = useMutation({
    mutationFn: triggerAffectEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const affectResetMutation = useMutation({
    mutationFn: resetAffect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const addMemoryMutation = useMutation({
    mutationFn: addMemory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] });
      setShowAddMemory(false);
      setNewMemory({ memoryType: 'thought', content: '', importance: 0.5, isPinned: false });
    },
  });

  const clearMemoryMutation = useMutation({
    mutationFn: clearMemory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const addGoalMutation = useMutation({
    mutationFn: addGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] });
      setShowAddGoal(false);
      setNewGoal({ goalType: 'user_requested', description: '', priority: 5 });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load Ego dashboard</p>
      </div>
    );
  }

  const { state, preview, stats, costInfo } = dashboard;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Ego State Management
          </h1>
          <p className="text-muted-foreground">
            Zero-cost persistent consciousness through database state injection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.config.egoEnabled ? 'default' : 'secondary'}>
            {state.config.egoEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Cost Savings Banner */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-700 dark:text-green-300">Zero Additional Cost</h3>
                <p className="text-sm text-green-600 dark:text-green-400">{costInfo.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">${costInfo.additionalMonthlyCost}/mo</div>
              <div className="text-xs text-muted-foreground">
                vs ${costInfo.comparison.sagemakerG5xlarge}/mo for SageMaker
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Emotion</CardTitle>
            <EmotionIcon emotion={state.affect.dominantEmotion} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{state.affect.dominantEmotion}</div>
            <ValenceBar value={state.affect.valence} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interactions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.identity.interactionsCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Injections (24h)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.injectionsLast24h}</div>
            <p className="text-xs text-muted-foreground">
              ~{Math.round(stats.avgTokensPerInjection)} tokens avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.activeGoals.length}</div>
            <p className="text-xs text-muted-foreground">{state.workingMemory.length} memories</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="identity">
            <Brain className="h-4 w-4 mr-2" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="affect">
            <Heart className="h-4 w-4 mr-2" />
            Affect
          </TabsTrigger>
          <TabsTrigger value="memory">
            <MessageSquare className="h-4 w-4 mr-2" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Feature Toggles</CardTitle>
                <CardDescription>Enable or disable Ego features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ego Enabled</Label>
                    <p className="text-xs text-muted-foreground">Master switch for Ego system</p>
                  </div>
                  <Switch
                    checked={state.config.egoEnabled}
                    onCheckedChange={(checked) => configMutation.mutate({ egoEnabled: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Inject Ego Context</Label>
                    <p className="text-xs text-muted-foreground">Add Ego state to model prompts</p>
                  </div>
                  <Switch
                    checked={state.config.injectEgoContext}
                    onCheckedChange={(checked) => configMutation.mutate({ injectEgoContext: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Affect Learning</Label>
                    <p className="text-xs text-muted-foreground">Learn from interaction outcomes</p>
                  </div>
                  <Switch
                    checked={state.config.affectLearningEnabled}
                    onCheckedChange={(checked) => configMutation.mutate({ affectLearningEnabled: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Affect Decay</Label>
                    <p className="text-xs text-muted-foreground">Emotions naturally decay over time</p>
                  </div>
                  <Switch
                    checked={state.config.affectDecayEnabled}
                    onCheckedChange={(checked) => configMutation.mutate({ affectDecayEnabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Context Injection</CardTitle>
                <CardDescription>What to include in injected context</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Include Identity</Label>
                  <Switch
                    checked={state.config.includeIdentity}
                    onCheckedChange={(checked) => configMutation.mutate({ includeIdentity: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Affect</Label>
                  <Switch
                    checked={state.config.includeAffect}
                    onCheckedChange={(checked) => configMutation.mutate({ includeAffect: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Recent Thoughts</Label>
                  <Switch
                    checked={state.config.includeRecentThoughts}
                    onCheckedChange={(checked) => configMutation.mutate({ includeRecentThoughts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Goals</Label>
                  <Switch
                    checked={state.config.includeGoals}
                    onCheckedChange={(checked) => configMutation.mutate({ includeGoals: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Include Working Memory</Label>
                  <Switch
                    checked={state.config.includeWorkingMemory}
                    onCheckedChange={(checked) => configMutation.mutate({ includeWorkingMemory: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Context Tokens</Label>
                  <Input
                    type="number"
                    value={state.config.maxContextTokens}
                    onChange={(e) => configMutation.mutate({ maxContextTokens: parseInt(e.target.value) })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personality Style</CardTitle>
                <CardDescription>How the Ego expresses itself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={state.config.personalityStyle}
                  onValueChange={(value) => configMutation.mutate({ personalityStyle: value as EgoConfig['personalityStyle'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced - Helpful and clear</SelectItem>
                    <SelectItem value="warm">Warm - Friendly and supportive</SelectItem>
                    <SelectItem value="professional">Professional - Precise and formal</SelectItem>
                    <SelectItem value="playful">Playful - Lighthearted with humor</SelectItem>
                    <SelectItem value="concise">Concise - Brief and direct</SelectItem>
                    <SelectItem value="detailed">Detailed - Thorough and comprehensive</SelectItem>
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                  <Label>Thought Frequency</Label>
                  <Select
                    value={state.config.thoughtFrequency}
                    onValueChange={(value) => configMutation.mutate({ thoughtFrequency: value as EgoConfig['thoughtFrequency'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never - No automatic thoughts</SelectItem>
                      <SelectItem value="sometimes">Sometimes - Occasional thoughts</SelectItem>
                      <SelectItem value="always">Always - Generate thoughts each interaction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voice Customization</CardTitle>
                <CardDescription>Custom prefix/suffix for responses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Voice Prefix</Label>
                  <Textarea
                    placeholder="Optional prefix guidance..."
                    value={state.config.egoVoicePrefix || ''}
                    onChange={(e) => configMutation.mutate({ egoVoicePrefix: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Voice Suffix</Label>
                  <Textarea
                    placeholder="Optional suffix guidance..."
                    value={state.config.egoVoiceSuffix || ''}
                    onChange={(e) => configMutation.mutate({ egoVoiceSuffix: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Identity Tab */}
        <TabsContent value="identity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Core Identity</CardTitle>
                <CardDescription>The persistent &quot;Self&quot;</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={state.identity.name}
                    onChange={(e) => identityMutation.mutate({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Identity Narrative</Label>
                  <Textarea
                    value={state.identity.identityNarrative}
                    onChange={(e) => identityMutation.mutate({ identityNarrative: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Core Values</Label>
                  <div className="flex flex-wrap gap-2">
                    {state.identity.coreValues.map((value, i) => (
                      <Badge key={i} variant="secondary">{value}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personality Traits</CardTitle>
                <CardDescription>Adjustable personality dimensions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Warmth</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(state.identity.traitWarmth * 100)}%</span>
                  </div>
                  <Slider
                    value={[state.identity.traitWarmth * 100]}
                    onValueChange={([v]) => identityMutation.mutate({ traitWarmth: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Formality</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(state.identity.traitFormality * 100)}%</span>
                  </div>
                  <Slider
                    value={[state.identity.traitFormality * 100]}
                    onValueChange={([v]) => identityMutation.mutate({ traitFormality: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Humor</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(state.identity.traitHumor * 100)}%</span>
                  </div>
                  <Slider
                    value={[state.identity.traitHumor * 100]}
                    onValueChange={([v]) => identityMutation.mutate({ traitHumor: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Verbosity</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(state.identity.traitVerbosity * 100)}%</span>
                  </div>
                  <Slider
                    value={[state.identity.traitVerbosity * 100]}
                    onValueChange={([v]) => identityMutation.mutate({ traitVerbosity: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Curiosity</Label>
                    <span className="text-sm text-muted-foreground">{Math.round(state.identity.traitCuriosity * 100)}%</span>
                  </div>
                  <Slider
                    value={[state.identity.traitCuriosity * 100]}
                    onValueChange={([v]) => identityMutation.mutate({ traitCuriosity: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Affect Tab */}
        <TabsContent value="affect" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Current Affective State
                  <EmotionIcon emotion={state.affect.dominantEmotion} />
                </CardTitle>
                <CardDescription>Real-time emotional state</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Valence</Label>
                    <div className="flex items-center gap-2">
                      <ValenceBar value={state.affect.valence} />
                      <span className="text-sm">{state.affect.valence.toFixed(2)}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Arousal</Label>
                    <Progress value={state.affect.arousal * 100} />
                    <span className="text-xs text-muted-foreground">{Math.round(state.affect.arousal * 100)}%</span>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Curiosity</Label>
                    <Progress value={state.affect.curiosity * 100} />
                  </div>
                  <div>
                    <Label className="text-xs">Satisfaction</Label>
                    <Progress value={state.affect.satisfaction * 100} />
                  </div>
                  <div>
                    <Label className="text-xs">Frustration</Label>
                    <Progress value={state.affect.frustration * 100} className="[&>div]:bg-red-500" />
                  </div>
                  <div>
                    <Label className="text-xs">Confidence</Label>
                    <Progress value={state.affect.confidence * 100} />
                  </div>
                  <div>
                    <Label className="text-xs">Engagement</Label>
                    <Progress value={state.affect.engagement * 100} />
                  </div>
                  <div>
                    <Label className="text-xs">Stability</Label>
                    <Progress value={state.affect.emotionalStability * 100} />
                  </div>
                </div>
                {state.affect.lastTriggerEvent && (
                  <div className="text-xs text-muted-foreground">
                    Last trigger: {state.affect.lastTriggerEvent}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Affect Controls</CardTitle>
                <CardDescription>Manually trigger affective events for testing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => affectTriggerMutation.mutate({ eventType: 'success', valenceDelta: 0.2, arousalDelta: 0.1 })}
                    disabled={affectTriggerMutation.isPending}
                  >
                    <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                    Success
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => affectTriggerMutation.mutate({ eventType: 'failure', valenceDelta: -0.2, arousalDelta: 0.15 })}
                    disabled={affectTriggerMutation.isPending}
                  >
                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                    Failure
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => affectTriggerMutation.mutate({ eventType: 'curiosity', valenceDelta: 0.1, arousalDelta: 0.2 })}
                    disabled={affectTriggerMutation.isPending}
                  >
                    <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                    Curiosity
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => affectTriggerMutation.mutate({ eventType: 'boredom', valenceDelta: -0.05, arousalDelta: -0.2 })}
                    disabled={affectTriggerMutation.isPending}
                  >
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    Boredom
                  </Button>
                </div>
                <Separator />
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => affectResetMutation.mutate()}
                  disabled={affectResetMutation.isPending}
                >
                  {affectResetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reset to Neutral
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Working Memory
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAddMemory(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => clearMemoryMutation.mutate()}
                      disabled={clearMemoryMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Recent thoughts and observations</CardDescription>
              </CardHeader>
              <CardContent>
                {state.workingMemory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No memories yet</p>
                ) : (
                  <div className="space-y-2">
                    {state.workingMemory.map((memory, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs">{memory.memoryType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(memory.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm">{memory.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Active Goals
                  <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Goal
                  </Button>
                </CardTitle>
                <CardDescription>Current objectives guiding behavior</CardDescription>
              </CardHeader>
              <CardContent>
                {state.activeGoals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No active goals</p>
                ) : (
                  <div className="space-y-3">
                    {state.activeGoals.map((goal) => (
                      <div key={goal.goalId} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{goal.goalType}</Badge>
                          <Badge variant={goal.status === 'active' ? 'default' : 'secondary'}>
                            P{goal.priority}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{goal.description}</p>
                        <div className="flex items-center gap-2">
                          <Progress value={goal.progress} className="flex-1" />
                          <span className="text-xs">{goal.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ego Context Preview</CardTitle>
              <CardDescription>
                This is the context block that will be injected into model prompts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>~{preview.tokenEstimate} tokens</span>
                    <span>•</span>
                    <span>Emotion: {preview.stateSnapshot.dominantEmotion}</span>
                    <span>•</span>
                    <span>{preview.stateSnapshot.activeGoalsCount} goals</span>
                    <span>•</span>
                    <span>{preview.stateSnapshot.memoryCount} memories</span>
                  </div>
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {preview.contextBlock}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ego injection is disabled</p>
                  <p className="text-sm">Enable it in Configuration to see the preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Memory Dialog */}
      <Dialog open={showAddMemory} onOpenChange={setShowAddMemory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Memory</DialogTitle>
            <DialogDescription>Add a thought or observation to working memory</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Memory Type</Label>
              <Select
                value={newMemory.memoryType}
                onValueChange={(v) => setNewMemory({ ...newMemory, memoryType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thought">Thought</SelectItem>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="goal">Goal</SelectItem>
                  <SelectItem value="reflection">Reflection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={newMemory.content}
                onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                placeholder="Memory content..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Importance</Label>
                <span className="text-sm text-muted-foreground">{Math.round(newMemory.importance * 100)}%</span>
              </div>
              <Slider
                value={[newMemory.importance * 100]}
                onValueChange={([v]) => setNewMemory({ ...newMemory, importance: v / 100 })}
                max={100}
                step={5}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newMemory.isPinned}
                onCheckedChange={(checked) => setNewMemory({ ...newMemory, isPinned: checked })}
              />
              <Label>Pin (won&apos;t expire)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemory(false)}>Cancel</Button>
            <Button
              onClick={() => addMemoryMutation.mutate(newMemory)}
              disabled={!newMemory.content || addMemoryMutation.isPending}
            >
              {addMemoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog */}
      <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
            <DialogDescription>Create a new goal to guide behavior</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Type</Label>
              <Select
                value={newGoal.goalType}
                onValueChange={(v) => setNewGoal({ ...newGoal, goalType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user_requested">User Requested</SelectItem>
                  <SelectItem value="self_generated">Self Generated</SelectItem>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="exploration">Exploration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Goal description..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Priority (1-10)</Label>
                <span className="text-sm text-muted-foreground">{newGoal.priority}</span>
              </div>
              <Slider
                value={[newGoal.priority]}
                onValueChange={([v]) => setNewGoal({ ...newGoal, priority: v })}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGoal(false)}>Cancel</Button>
            <Button
              onClick={() => addGoalMutation.mutate(newGoal)}
              disabled={!newGoal.description || addGoalMutation.isPending}
            >
              {addGoalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
