'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, Heart, Sparkles, Target, MessageSquare, RefreshCw, Loader2,
  Plus, Eye, Settings, Zap, TrendingUp, Clock, DollarSign, Smile, Meh, Frown, AlertCircle
} from 'lucide-react';

interface EgoConfig {
  configId: string;
  egoEnabled: boolean;
  injectEgoContext: boolean;
  customIdentityNarrative?: string;
  personalityStyle: string;
  maxContextTokens: number;
  autoGenerateThoughts: boolean;
}

interface EgoIdentity {
  name: string;
  identityNarrative: string;
  coreValues: string[];
  traitWarmth: number;
  traitFormality: number;
  traitHumor: number;
  traitVerbosity: number;
  traitCuriosity: number;
}

interface EgoAffect {
  valence: number;
  arousal: number;
  curiosity: number;
  satisfaction: number;
  frustration: number;
  confidence: number;
  dominantEmotion: string;
}

interface EgoDashboard {
  state: { config: EgoConfig; identity: EgoIdentity; affect: EgoAffect; workingMemory: any[]; activeGoals: any[] };
  stats: { injectionsLast24h: number; avgTokensPerInjection: number };
  costInfo: { additionalMonthlyCost: number; description: string };
}

function EmotionIcon({ emotion }: { emotion: string }) {
  if (['excited', 'content', 'confident'].includes(emotion)) return <Smile className="h-5 w-5 text-green-500" />;
  if (['neutral', 'curious'].includes(emotion)) return <Meh className="h-5 w-5 text-yellow-500" />;
  return <Frown className="h-5 w-5 text-red-500" />;
}

export default function EgoPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['ego-dashboard'],
    queryFn: () => api.get<EgoDashboard>('/api/admin/ego/dashboard'),
    refetchInterval: 30000,
  });

  const configMutation = useMutation({
    mutationFn: (updates: Partial<EgoConfig>) => api.put('/api/admin/ego/config', updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const identityMutation = useMutation({
    mutationFn: (updates: Partial<EgoIdentity>) => api.put('/api/admin/ego/identity', updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const affectTriggerMutation = useMutation({
    mutationFn: (event: { eventType: string; valenceDelta: number; arousalDelta: number }) =>
      api.post('/api/admin/ego/affect/trigger', event),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  const affectResetMutation = useMutation({
    mutationFn: () => api.post('/api/admin/ego/affect/reset', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!dashboard) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Failed to load Ego dashboard</p></div>;
  }

  const { state, stats, costInfo } = dashboard;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Ego State Management
          </h1>
          <p className="text-muted-foreground">Zero-cost persistent consciousness through database state injection</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.config.egoEnabled ? 'default' : 'secondary'}>{state.config.egoEnabled ? 'Enabled' : 'Disabled'}</Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-semibold">Zero Additional API Cost</h3>
                <p className="text-sm text-muted-foreground">{costInfo.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">${costInfo.additionalMonthlyCost.toFixed(2)}/mo</p>
              <p className="text-xs text-muted-foreground">{stats.injectionsLast24h} injections (24h)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="affect">Affect</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" />Identity</CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{state.identity.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{state.identity.identityNarrative}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4" />Current Affect</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <EmotionIcon emotion={state.affect.dominantEmotion} />
                  <span className="font-medium capitalize">{state.affect.dominantEmotion}</span>
                </div>
                <p className="text-sm text-muted-foreground">Valence: {state.affect.valence.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Active Goals</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.activeGoals.length}</p>
                <p className="text-sm text-muted-foreground">{state.workingMemory.length} memories</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="identity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Core Identity</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={state.identity.name} onChange={(e) => identityMutation.mutate({ name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Identity Narrative</Label>
                  <Textarea value={state.identity.identityNarrative} onChange={(e) => identityMutation.mutate({ identityNarrative: e.target.value })} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Core Values</Label>
                  <div className="flex flex-wrap gap-2">{state.identity.coreValues.map((v, i) => <Badge key={i} variant="secondary">{v}</Badge>)}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Personality Traits</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {['Warmth', 'Formality', 'Humor', 'Verbosity', 'Curiosity'].map((trait) => {
                  const key = `trait${trait}` as keyof EgoIdentity;
                  const value = state.identity[key] as number;
                  return (
                    <div key={trait} className="space-y-2">
                      <div className="flex justify-between"><Label>{trait}</Label><span className="text-sm text-muted-foreground">{Math.round(value * 100)}%</span></div>
                      <Slider value={[value * 100]} onValueChange={([v]) => identityMutation.mutate({ [key]: v / 100 })} max={100} step={5} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="affect" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">Current State <EmotionIcon emotion={state.affect.dominantEmotion} /></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {['valence', 'arousal', 'curiosity', 'satisfaction', 'frustration', 'confidence'].map((key) => (
                    <div key={key}>
                      <Label className="text-xs capitalize">{key}</Label>
                      <Progress value={(state.affect[key as keyof EgoAffect] as number) * 100} className={key === 'frustration' ? '[&>div]:bg-red-500' : ''} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Affect Controls</CardTitle><CardDescription>Manually trigger affective events</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => affectTriggerMutation.mutate({ eventType: 'success', valenceDelta: 0.2, arousalDelta: 0.1 })}><TrendingUp className="h-4 w-4 mr-2 text-green-500" />Success</Button>
                  <Button variant="outline" onClick={() => affectTriggerMutation.mutate({ eventType: 'failure', valenceDelta: -0.2, arousalDelta: 0.15 })}><AlertCircle className="h-4 w-4 mr-2 text-red-500" />Failure</Button>
                  <Button variant="outline" onClick={() => affectTriggerMutation.mutate({ eventType: 'curiosity', valenceDelta: 0.1, arousalDelta: 0.2 })}><Sparkles className="h-4 w-4 mr-2 text-purple-500" />Curiosity</Button>
                  <Button variant="outline" onClick={() => affectTriggerMutation.mutate({ eventType: 'boredom', valenceDelta: -0.05, arousalDelta: -0.2 })}><Clock className="h-4 w-4 mr-2 text-gray-500" />Boredom</Button>
                </div>
                <Separator />
                <Button variant="destructive" className="w-full" onClick={() => affectResetMutation.mutate()} disabled={affectResetMutation.isPending}>
                  {affectResetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Reset to Neutral
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Ego Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div><Label>Enable Ego System</Label><p className="text-sm text-muted-foreground">Inject ego context into conversations</p></div>
                <Switch checked={state.config.egoEnabled} onCheckedChange={(v) => configMutation.mutate({ egoEnabled: v })} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><Label>Inject Context</Label><p className="text-sm text-muted-foreground">Include ego state in system prompts</p></div>
                <Switch checked={state.config.injectEgoContext} onCheckedChange={(v) => configMutation.mutate({ injectEgoContext: v })} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Personality Style</Label>
                <Select value={state.config.personalityStyle} onValueChange={(v) => configMutation.mutate({ personalityStyle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Context Tokens</Label>
                <Input type="number" value={state.config.maxContextTokens} onChange={(e) => configMutation.mutate({ maxContextTokens: parseInt(e.target.value) })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
