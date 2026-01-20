'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings, Users, MessageSquare, Cpu, Zap, Save, RefreshCw, CheckCircle, AlertTriangle, Brain, Sparkles,
  Mic, Code, FileUp, ImageIcon, Globe, Check
} from 'lucide-react';

interface ThinkTankConfig {
  maxUsersPerTenant: number;
  maxConversationsPerUser: number;
  maxTokensPerConversation: number;
  enabledModels: string[];
  rateLimits: { requestsPerMinute: number; tokensPerMinute: number };
  features: { collaboration: boolean; voiceInput: boolean; codeExecution: boolean; fileUploads: boolean; imageGeneration: boolean };
}

interface ThinkTankStatus {
  installed: boolean;
  version: string | null;
  dataRetained: boolean;
  health: { status: string; latencyMs: number; activeUsers: number; activeConversations: number; errorRate: number } | null;
}

const PERSONALITY_MODES = [
  { id: 'auto', name: 'Auto', icon: '✨', description: 'Adapts based on context' },
  { id: 'professional', name: 'Professional', icon: '💼', description: 'Clean, concise responses' },
  { id: 'subtle', name: 'Subtle', icon: '🌿', description: 'Light personality touches' },
  { id: 'expressive', name: 'Expressive', icon: '🎯', description: 'Engaging personality' },
  { id: 'playful', name: 'Playful', icon: '🎮', description: 'Fun, witty interactions' },
];

export default function ThinkTankSettingsPage() {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedMode, setSelectedMode] = useState('auto');

  const { data: status, isLoading: statusLoading } = useQuery<ThinkTankStatus>({
    queryKey: ['thinktank-status'],
    queryFn: () => api.get<ThinkTankStatus>('/api/admin/thinktank/status'),
  });

  const { data: config, isLoading: configLoading } = useQuery<ThinkTankConfig>({
    queryKey: ['thinktank-config'],
    queryFn: () => api.get<ThinkTankConfig>('/api/admin/thinktank/config'),
    enabled: status?.installed === true,
  });

  const [localConfig, setLocalConfig] = useState<ThinkTankConfig | null>(null);
  if (config && !localConfig) setLocalConfig(config);

  const updateConfigMutation = useMutation({
    mutationFn: (updates: Partial<ThinkTankConfig>) => api.patch('/api/admin/thinktank/config', updates),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['thinktank-config'] }); setHasChanges(false); },
  });

  const isViewOnly = !status?.installed && status?.dataRetained;
  const updateLocalConfig = (updates: Partial<ThinkTankConfig>) => { if (localConfig) { setLocalConfig({ ...localConfig, ...updates }); setHasChanges(true); } };

  if (!status?.installed && !status?.dataRetained) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="rounded-full bg-muted p-6 mb-4"><Brain className="h-12 w-12 text-muted-foreground" /></div>
        <h2 className="text-2xl font-bold mb-2">Think Tank Not Installed</h2>
        <p className="text-muted-foreground max-w-md mb-6">Think Tank is not currently installed. Install to enable AI conversations.</p>
        <Button size="lg"><Sparkles className="h-4 w-4 mr-2" />Install Think Tank</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" />Think Tank Settings</h1>
          <p className="text-muted-foreground">Configure Think Tank parameters and features</p>
        </div>
        <div className="flex items-center gap-3">
          {status?.health && (
            <Badge variant={status.health.status === 'healthy' ? 'default' : 'destructive'}>
              {status.health.status === 'healthy' ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
              {status.health.status}
            </Badge>
          )}
          <Badge variant="secondary">v{status?.version}</Badge>
          {hasChanges && !isViewOnly && (
            <Button onClick={() => localConfig && updateConfigMutation.mutate(localConfig)} disabled={updateConfigMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />{updateConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="h-4 w-4" /><span className="text-sm">Active Users</span></div><p className="text-2xl font-bold">{status?.health?.activeUsers || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-muted-foreground mb-1"><MessageSquare className="h-4 w-4" /><span className="text-sm">Active Conversations</span></div><p className="text-2xl font-bold">{status?.health?.activeConversations || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Zap className="h-4 w-4" /><span className="text-sm">Latency</span></div><p className="text-2xl font-bold">{status?.health?.latencyMs || 0}ms</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-muted-foreground mb-1"><AlertTriangle className="h-4 w-4" /><span className="text-sm">Error Rate</span></div><p className="text-2xl font-bold">{((status?.health?.errorRate || 0) * 100).toFixed(2)}%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="limits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="personality">Personality</TabsTrigger>
        </TabsList>

        <TabsContent value="limits">
          <Card>
            <CardHeader><CardTitle>Usage Limits</CardTitle><CardDescription>Configure maximum usage limits</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Max Users per Tenant</Label>
                <Input type="number" value={localConfig?.maxUsersPerTenant || 0} onChange={(e) => updateLocalConfig({ maxUsersPerTenant: parseInt(e.target.value) })} disabled={isViewOnly} />
              </div>
              <div className="space-y-2">
                <Label>Max Conversations per User</Label>
                <Input type="number" value={localConfig?.maxConversationsPerUser || 0} onChange={(e) => updateLocalConfig({ maxConversationsPerUser: parseInt(e.target.value) })} disabled={isViewOnly} />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens per Conversation</Label>
                <Input type="number" value={localConfig?.maxTokensPerConversation || 0} onChange={(e) => updateLocalConfig({ maxTokensPerConversation: parseInt(e.target.value) })} disabled={isViewOnly} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader><CardTitle>Feature Toggles</CardTitle><CardDescription>Enable or disable features</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: 'collaboration', label: 'Real-time Collaboration', icon: Users, desc: 'Allow users to collaborate' },
                { key: 'voiceInput', label: 'Voice Input', icon: Mic, desc: 'Enable voice-to-text' },
                { key: 'codeExecution', label: 'Code Execution', icon: Code, desc: 'Execute code in sandbox' },
                { key: 'fileUploads', label: 'File Uploads', icon: FileUp, desc: 'Upload files for analysis' },
                { key: 'imageGeneration', label: 'Image Generation', icon: ImageIcon, desc: 'AI image generation' },
              ].map(({ key, label, icon: Icon, desc }) => (
                <div key={key}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div><Label>{label}</Label><p className="text-sm text-muted-foreground">{desc}</p></div>
                    </div>
                    <Switch
                      checked={localConfig?.features[key as keyof typeof localConfig.features] || false}
                      onCheckedChange={(checked) => updateLocalConfig({ features: { ...localConfig!.features, [key]: checked } })}
                      disabled={isViewOnly}
                    />
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits">
          <Card>
            <CardHeader><CardTitle>Rate Limiting</CardTitle><CardDescription>Configure API rate limits</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Requests per Minute</Label>
                <Input type="number" value={localConfig?.rateLimits.requestsPerMinute || 0} onChange={(e) => updateLocalConfig({ rateLimits: { ...localConfig!.rateLimits, requestsPerMinute: parseInt(e.target.value) } })} disabled={isViewOnly} />
              </div>
              <div className="space-y-2">
                <Label>Tokens per Minute</Label>
                <Input type="number" value={localConfig?.rateLimits.tokensPerMinute || 0} onChange={(e) => updateLocalConfig({ rateLimits: { ...localConfig!.rateLimits, tokensPerMinute: parseInt(e.target.value) } })} disabled={isViewOnly} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personality">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-yellow-500" />AI Personality Mode</CardTitle><CardDescription>Choose how Think Tank expresses itself</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {PERSONALITY_MODES.map((mode) => (
                  <div key={mode.id} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${selectedMode === mode.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/50'}`} onClick={() => setSelectedMode(mode.id)}>
                    <div className="text-2xl">{mode.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{mode.name}</h4>
                        {mode.id === 'auto' && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                        {selectedMode === mode.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
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
