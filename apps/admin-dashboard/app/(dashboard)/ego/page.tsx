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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Brain, 
  Heart,
  Target,
  Sparkles,
  Settings,
  RefreshCw,
  Save,
  Eye,
  Zap,
} from 'lucide-react';

interface EgoIdentity {
  name: string;
  narrative: string;
  values: string[];
  traits: Record<string, number>;
}

interface EgoAffect {
  valence: number;
  arousal: number;
  curiosity: number;
  frustration: number;
  self_efficacy: number;
  last_updated: string;
}

interface EgoConfig {
  enabled: boolean;
  inject_identity: boolean;
  inject_affect: boolean;
  inject_goals: boolean;
  max_context_tokens: number;
  affect_decay_rate: number;
}

async function fetchDashboard() {
  const res = await fetch('/api/admin/ego/dashboard');
  if (!res.ok) throw new Error('Failed to fetch ego dashboard');
  return res.json();
}

async function updateIdentity(identity: Partial<EgoIdentity>) {
  const res = await fetch('/api/admin/ego/identity', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
  if (!res.ok) throw new Error('Failed to update identity');
}

async function triggerAffect(trigger: string) {
  const res = await fetch('/api/admin/ego/affect/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger }),
  });
  if (!res.ok) throw new Error('Failed to trigger affect');
}

export default function EgoPage() {
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['ego-dashboard'],
    queryFn: fetchDashboard,
  });

  const updateMutation = useMutation({
    mutationFn: updateIdentity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] });
      toast.success('Identity updated');
    },
    onError: () => toast.error('Failed to update identity'),
  });

  const triggerMutation = useMutation({
    mutationFn: triggerAffect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ego-dashboard'] });
      toast.success('Affect triggered');
    },
  });

  const config: EgoConfig = dashboard?.config || {};
  const identity: EgoIdentity = dashboard?.identity || { name: '', narrative: '', values: [], traits: {} };
  const affect: EgoAffect = dashboard?.affect || { valence: 0.5, arousal: 0.5, curiosity: 0.5, frustration: 0, self_efficacy: 0.7 };

  const getAffectColor = (value: number, invert = false) => {
    const v = invert ? 1 - value : value;
    if (v > 0.7) return 'text-green-500';
    if (v > 0.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
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
            Ego System
          </h1>
          <p className="text-muted-foreground mt-1">
            Zero-cost persistent consciousness through state injection
          </p>
        </div>
        <Badge className={config.enabled ? 'bg-green-500' : 'bg-gray-500'}>
          {config.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valence</CardDescription>
            <CardTitle className={`text-2xl ${getAffectColor(affect.valence)}`}>
              {(affect.valence * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={affect.valence * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Arousal</CardDescription>
            <CardTitle className="text-2xl">{(affect.arousal * 100).toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={affect.arousal * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Curiosity</CardDescription>
            <CardTitle className={`text-2xl ${getAffectColor(affect.curiosity)}`}>
              {(affect.curiosity * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={affect.curiosity * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Frustration</CardDescription>
            <CardTitle className={`text-2xl ${getAffectColor(affect.frustration, true)}`}>
              {(affect.frustration * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={affect.frustration * 100} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Self-Efficacy</CardDescription>
            <CardTitle className={`text-2xl ${getAffectColor(affect.self_efficacy)}`}>
              {(affect.self_efficacy * 100).toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={affect.self_efficacy * 100} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="identity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="affect">Affective State</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="preview">Context Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Identity Configuration
              </CardTitle>
              <CardDescription>
                Define the persistent identity characteristics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input defaultValue={identity.name} placeholder="AI Assistant Name" />
              </div>
              <div className="space-y-2">
                <Label>Narrative</Label>
                <Textarea 
                  defaultValue={identity.narrative} 
                  placeholder="A brief narrative describing the AI&apos;s identity and purpose..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Core Values</Label>
                <div className="flex flex-wrap gap-2">
                  {identity.values?.map((value, i) => (
                    <Badge key={i} variant="outline">{value}</Badge>
                  )) || <span className="text-muted-foreground">No values defined</span>}
                </div>
              </div>
              <div className="space-y-4">
                <Label>Personality Traits</Label>
                {Object.entries(identity.traits || {}).map(([trait, value]) => (
                  <div key={trait} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="capitalize">{trait}</span>
                      <span className="text-muted-foreground">{((value as number) * 100).toFixed(0)}%</span>
                    </div>
                    <Slider value={[(value as number) * 100]} max={100} step={5} />
                  </div>
                ))}
              </div>
              <Button onClick={() => updateMutation.mutate(identity)}>
                <Save className="h-4 w-4 mr-2" />
                Save Identity
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affect" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Affective State Controls
              </CardTitle>
              <CardDescription>
                Test affect triggers and monitor emotional state
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {['positive', 'negative', 'curious', 'frustrated', 'bored', 'excited'].map((trigger) => (
                  <Button
                    key={trigger}
                    variant="outline"
                    onClick={() => triggerMutation.mutate(trigger)}
                    className="capitalize"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {trigger}
                  </Button>
                ))}
              </div>
              <div className="pt-4 border-t">
                <Button variant="destructive" onClick={() => triggerMutation.mutate('reset')}>
                  Reset Affect State
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Ego Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Ego System</Label>
                  <p className="text-sm text-muted-foreground">Activate persistent consciousness</p>
                </div>
                <Switch checked={config.enabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Inject Identity</Label>
                  <p className="text-sm text-muted-foreground">Include identity in system prompt</p>
                </div>
                <Switch checked={config.inject_identity} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Inject Affect</Label>
                  <p className="text-sm text-muted-foreground">Include emotional state</p>
                </div>
                <Switch checked={config.inject_affect} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Inject Goals</Label>
                  <p className="text-sm text-muted-foreground">Include active goals</p>
                </div>
                <Switch checked={config.inject_goals} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Context Preview
              </CardTitle>
              <CardDescription>
                Preview the ego context that will be injected into prompts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                {dashboard?.preview || 'No preview available'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
