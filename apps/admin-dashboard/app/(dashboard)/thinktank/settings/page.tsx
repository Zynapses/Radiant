'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Users,
  MessageSquare,
  Cpu,
  Shield,
  Zap,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Brain,
  Sparkles,
  Mic,
  Code,
  FileUp,
  ImageIcon,
  Globe,
  Check,
} from 'lucide-react';
import { useTranslation, SUPPORTED_LANGUAGES, type LanguageCode } from '@/hooks/useTranslation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

interface ThinkTankConfig {
  maxUsersPerTenant: number;
  maxConversationsPerUser: number;
  maxTokensPerConversation: number;
  enabledModels: string[];
  enabledDomainModes: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  features: {
    collaboration: boolean;
    voiceInput: boolean;
    codeExecution: boolean;
    fileUploads: boolean;
    imageGeneration: boolean;
  };
}

interface ThinkTankStatus {
  installed: boolean;
  version: string | null;
  lastActiveAt: string | null;
  installDate: string | null;
  uninstallDate: string | null;
  dataRetained: boolean;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
    latencyMs: number;
    lastCheck: string;
    activeUsers: number;
    activeConversations: number;
    errorRate: number;
  } | null;
}

function ThinkTankSettingsContent() {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery<ThinkTankStatus>({
    queryKey: ['thinktank', 'status'],
    queryFn: () => fetch('/api/admin/thinktank/status').then(r => r.json()),
  });

  const { data: config, isLoading: configLoading } = useQuery<ThinkTankConfig>({
    queryKey: ['thinktank', 'config'],
    queryFn: () => fetch('/api/admin/thinktank/config').then(r => r.json()),
    enabled: status?.installed === true,
  });

  const [localConfig, setLocalConfig] = useState<ThinkTankConfig | null>(null);

  // Initialize local config when data loads
  if (config && !localConfig) {
    setLocalConfig(config);
  }

  const updateConfigMutation = useMutation({
    mutationFn: (updates: Partial<ThinkTankConfig>) =>
      fetch('/api/admin/thinktank/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank', 'config'] });
      setHasChanges(false);
    },
  });

  const isViewOnly = !status?.installed && status?.dataRetained;
  const isLoading = statusLoading || configLoading;

  const updateLocalConfig = (updates: Partial<ThinkTankConfig>) => {
    if (localConfig) {
      setLocalConfig({ ...localConfig, ...updates });
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    if (localConfig) {
      updateConfigMutation.mutate(localConfig);
    }
  };

  if (!status?.installed && !status?.dataRetained) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Brain className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Think Tank Not Installed</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Think Tank is not currently installed on this RADIANT instance. 
          Install Think Tank to enable AI-powered conversations and collaboration.
        </p>
        <Button size="lg">
          <Sparkles className="h-4 w-4 mr-2" />
          Install Think Tank
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Only Banner */}
      {isViewOnly && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">View Only Mode</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Think Tank was uninstalled. Settings are read-only but data is preserved. 
                Reinstall to resume editing.
              </p>
            </div>
            <Button variant="outline" className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reinstall Think Tank
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Think Tank Settings
          </h1>
          <p className="text-muted-foreground">
            Configure Think Tank parameters and features
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status?.health && (
            <Badge variant={status.health.status === 'healthy' ? 'default' : 'destructive'}>
              {status.health.status === 'healthy' ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 mr-1" />
              )}
              {status.health.status}
            </Badge>
          )}
          <Badge variant="secondary">v{status?.version}</Badge>
          {hasChanges && !isViewOnly && (
            <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Active Users</span>
            </div>
            <p className="text-2xl font-bold">{status?.health?.activeUsers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Active Conversations</span>
            </div>
            <p className="text-2xl font-bold">{status?.health?.activeConversations || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-sm">Latency</span>
            </div>
            <p className="text-2xl font-bold">{status?.health?.latencyMs || 0}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Error Rate</span>
            </div>
            <p className="text-2xl font-bold">{((status?.health?.errorRate || 0) * 100).toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="limits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="personality">Personality</TabsTrigger>
          <TabsTrigger value="language">Language</TabsTrigger>
        </TabsList>

        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits</CardTitle>
              <CardDescription>Configure maximum usage limits for Think Tank</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxUsers">Max Users per Tenant</Label>
                  <Input
                    id="maxUsers"
                    type="number"
                    value={localConfig?.maxUsersPerTenant || 0}
                    onChange={(e) => updateLocalConfig({ maxUsersPerTenant: parseInt(e.target.value) })}
                    disabled={isViewOnly}
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of users allowed per tenant</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxConversations">Max Conversations per User</Label>
                  <Input
                    id="maxConversations"
                    type="number"
                    value={localConfig?.maxConversationsPerUser || 0}
                    onChange={(e) => updateLocalConfig({ maxConversationsPerUser: parseInt(e.target.value) })}
                    disabled={isViewOnly}
                  />
                  <p className="text-xs text-muted-foreground">Maximum conversations a user can create</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens per Conversation</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    value={localConfig?.maxTokensPerConversation || 0}
                    onChange={(e) => updateLocalConfig({ maxTokensPerConversation: parseInt(e.target.value) })}
                    disabled={isViewOnly}
                  />
                  <p className="text-xs text-muted-foreground">Maximum context window for conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>Enable or disable Think Tank features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Real-time Collaboration</Label>
                      <p className="text-sm text-muted-foreground">Allow users to collaborate on conversations</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig?.features.collaboration || false}
                    onCheckedChange={(checked) => updateLocalConfig({
                      features: { ...localConfig!.features, collaboration: checked }
                    })}
                    disabled={isViewOnly}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mic className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Voice Input</Label>
                      <p className="text-sm text-muted-foreground">Enable voice-to-text input</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig?.features.voiceInput || false}
                    onCheckedChange={(checked) => updateLocalConfig({
                      features: { ...localConfig!.features, voiceInput: checked }
                    })}
                    disabled={isViewOnly}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Code className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Code Execution</Label>
                      <p className="text-sm text-muted-foreground">Allow AI to execute code in sandboxed environment</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig?.features.codeExecution || false}
                    onCheckedChange={(checked) => updateLocalConfig({
                      features: { ...localConfig!.features, codeExecution: checked }
                    })}
                    disabled={isViewOnly}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileUp className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>File Uploads</Label>
                      <p className="text-sm text-muted-foreground">Allow users to upload files for AI analysis</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig?.features.fileUploads || false}
                    onCheckedChange={(checked) => updateLocalConfig({
                      features: { ...localConfig!.features, fileUploads: checked }
                    })}
                    disabled={isViewOnly}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Image Generation</Label>
                      <p className="text-sm text-muted-foreground">Enable AI image generation capabilities</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig?.features.imageGeneration || false}
                    onCheckedChange={(checked) => updateLocalConfig({
                      features: { ...localConfig!.features, imageGeneration: checked }
                    })}
                    disabled={isViewOnly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>Configure API rate limits for Think Tank</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="requestsPerMinute">Requests per Minute</Label>
                  <Input
                    id="requestsPerMinute"
                    type="number"
                    value={localConfig?.rateLimits.requestsPerMinute || 0}
                    onChange={(e) => updateLocalConfig({
                      rateLimits: { ...localConfig!.rateLimits, requestsPerMinute: parseInt(e.target.value) }
                    })}
                    disabled={isViewOnly}
                  />
                  <p className="text-xs text-muted-foreground">Maximum API requests per minute per user</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tokensPerMinute">Tokens per Minute</Label>
                  <Input
                    id="tokensPerMinute"
                    type="number"
                    value={localConfig?.rateLimits.tokensPerMinute || 0}
                    onChange={(e) => updateLocalConfig({
                      rateLimits: { ...localConfig!.rateLimits, tokensPerMinute: parseInt(e.target.value) }
                    })}
                    disabled={isViewOnly}
                  />
                  <p className="text-xs text-muted-foreground">Maximum tokens processed per minute per user</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enabled Models</CardTitle>
              <CardDescription>Select which AI models are available in Think Tank</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {localConfig?.enabledModels.map((model) => (
                  <div key={model} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span>{model}</span>
                    </div>
                    <Badge variant="secondary">Enabled</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personality" className="space-y-4">
          <PersonalitySettings />
        </TabsContent>

        <TabsContent value="language" className="space-y-4">
          <LanguageSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Personality mode definitions
const PERSONALITY_MODES = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Intelligently adapts based on time of day, domain, and session length',
    icon: '✨',
    details: 'Professional in mornings, playful on evenings/weekends, adapts to domain type',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean, concise responses with minimal personality',
    icon: '💼',
    details: 'Best for business, legal, and medical contexts',
  },
  {
    id: 'subtle',
    name: 'Subtle',
    description: 'Light personality touches without being distracting',
    icon: '🌿',
    details: 'Calm and understated feedback',
  },
  {
    id: 'expressive',
    name: 'Expressive',
    description: 'Engaging personality with helpful feedback messages',
    icon: '🎯',
    details: 'Encouraging messages and domain-aware feedback',
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Fun, witty interactions with easter eggs and achievements',
    icon: '🎮',
    details: 'Full personality with achievements, sounds, and surprises',
  },
] as const;

type PersonalityModeId = typeof PERSONALITY_MODES[number]['id'];

function PersonalitySettings() {
  const [selectedMode, setSelectedMode] = useState<PersonalityModeId>('auto');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load user preference
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['delight-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank/delight/preferences');
      if (!res.ok) return { personalityMode: 'auto' };
      return res.json();
    },
  });

  // Update selected mode when preferences load
  useState(() => {
    if (preferences?.personalityMode) {
      setSelectedMode(preferences.personalityMode);
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/thinktank/delight/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalityMode: selectedMode }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save personality preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          AI Personality Mode
        </CardTitle>
        <CardDescription>
          Choose how Think Tank expresses itself during conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Personality Mode</Label>
            <p className="text-sm text-muted-foreground">
              This affects how Think Tank communicates, celebrates achievements, and provides feedback
            </p>
          </div>

          <div className="grid gap-3">
            {PERSONALITY_MODES.map((mode) => (
              <div
                key={mode.id}
                className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedMode === mode.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:border-muted-foreground/50 hover:bg-muted/30'
                }`}
                onClick={() => setSelectedMode(mode.id)}
              >
                <div className="text-2xl">{mode.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{mode.name}</h4>
                    {mode.id === 'auto' && (
                      <Badge variant="secondary" className="text-xs">Recommended</Badge>
                    )}
                    {selectedMode === mode.id && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{mode.details}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedMode === 'auto' ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Auto mode adapts to your context automatically
                </span>
              ) : (
                <span>Manual mode: {PERSONALITY_MODES.find(m => m.id === selectedMode)?.name}</span>
              )}
            </div>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isLoading}
              variant={saved ? 'outline' : 'default'}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : isSaving ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preference
                </>
              )}
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">What does personality affect?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Loading messages</strong> - Domain-specific messages while AI thinks</li>
              <li>• <strong>Achievements</strong> - Unlockable milestones and celebrations</li>
              <li>• <strong>Easter eggs</strong> - Hidden features and surprises</li>
              <li>• <strong>Sounds</strong> - Audio feedback for actions</li>
              <li>• <strong>Wellbeing nudges</strong> - Friendly break reminders</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageSettings() {
  const { language, setLanguage, languages, t } = useTranslation('thinktank.settings');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Language Settings
        </CardTitle>
        <CardDescription>
          Choose your preferred language for Think Tank interface
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language-select">Interface Language</Label>
            <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
              <SelectTrigger id="language-select" className="w-full max-w-sm">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <div className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                      {lang.code !== lang.name && (
                        <span className="text-muted-foreground">({lang.name})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This will change the language for all Think Tank interface elements
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Available Languages</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {languages.map((lang) => (
                <div
                  key={lang.code}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    language === lang.code
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setLanguage(lang.code as LanguageCode)}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lang.nativeName}</p>
                    <p className="text-xs text-muted-foreground truncate">{lang.name}</p>
                  </div>
                  {language === lang.code && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Translation Coverage</h4>
            <p className="text-sm text-muted-foreground mb-3">
              All 16 languages are fully supported with professional translations for:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• User interface elements</li>
              <li>• Error messages and notifications</li>
              <li>• Help documentation</li>
              <li>• System messages</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ThinkTankSettingsPage() {
  return (
    <PageErrorBoundary>
      <ThinkTankSettingsContent />
    </PageErrorBoundary>
  );
}
