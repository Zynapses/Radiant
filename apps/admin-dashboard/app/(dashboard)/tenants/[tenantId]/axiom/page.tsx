'use client';

/**
 * Tenant Admin - AXIOM Configuration Page
 * 
 * Allows tenant administrators to configure AXIOM/CLARION settings
 * specific to their organization.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sparkles,
  Settings,
  BarChart3,
  HelpCircle,
  Save,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Zap,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface TenantAxiomConfig {
  tenantId: string;
  enabled: boolean;
  maxQuestionsPerSession: number;
  confidenceThreshold: number;
  enableCaching: boolean;
  cacheTtlMinutes: number;
  defaultDomain: string | null;
  allowedDomains: string[];
  blockedPatterns: string[];
  customPromptPrefix: string | null;
  customPromptSuffix: string | null;
  modelPreferences: {
    preferredProvider: string | null;
    excludedModels: string[];
    costLimit: number | null;
  };
  featureFlags: {
    enableAdaptiveQuestions: boolean;
    enableModelScoring: boolean;
    enablePromptPreview: boolean;
    enableFeedbackCapture: boolean;
  };
}

interface TenantAxiomStats {
  totalSessions: number;
  completedSessions: number;
  averageQuestionsAnswered: number;
  averageConfidenceScore: number;
  topDomains: Array<{ domain: string; count: number }>;
  modelUsage: Array<{ model: string; count: number; avgScore: number }>;
  periodStart: string;
  periodEnd: string;
}

const defaultConfig: TenantAxiomConfig = {
  tenantId: '',
  enabled: true,
  maxQuestionsPerSession: 5,
  confidenceThreshold: 0.85,
  enableCaching: true,
  cacheTtlMinutes: 60,
  defaultDomain: null,
  allowedDomains: [],
  blockedPatterns: [],
  customPromptPrefix: null,
  customPromptSuffix: null,
  modelPreferences: {
    preferredProvider: null,
    excludedModels: [],
    costLimit: null,
  },
  featureFlags: {
    enableAdaptiveQuestions: true,
    enableModelScoring: true,
    enablePromptPreview: true,
    enableFeedbackCapture: true,
  },
};

async function fetchTenantConfig(tenantId: string): Promise<TenantAxiomConfig> {
  const response = await fetch(`/api/admin/axiom/tenant/${tenantId}/config`);
  if (!response.ok) {
    if (response.status === 404) {
      return { ...defaultConfig, tenantId };
    }
    throw new Error('Failed to fetch tenant AXIOM config');
  }
  return response.json();
}

async function fetchTenantStats(tenantId: string): Promise<TenantAxiomStats> {
  const response = await fetch(`/api/admin/axiom/tenant/${tenantId}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch tenant AXIOM stats');
  }
  return response.json();
}

async function saveTenantConfig(config: TenantAxiomConfig): Promise<TenantAxiomConfig> {
  const response = await fetch(`/api/admin/axiom/tenant/${config.tenantId}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to save tenant AXIOM config');
  }
  return response.json();
}

export default function TenantAxiomConfigPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('settings');
  const [localConfig, setLocalConfig] = useState<TenantAxiomConfig | null>(null);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['tenant-axiom-config', tenantId],
    queryFn: () => fetchTenantConfig(tenantId),
    enabled: !!tenantId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['tenant-axiom-stats', tenantId],
    queryFn: () => fetchTenantStats(tenantId),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: saveTenantConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-axiom-config', tenantId] });
      toast({
        title: 'Configuration Saved',
        description: 'AXIOM settings have been updated for this tenant.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleSave = () => {
    if (localConfig) {
      saveMutation.mutate(localConfig);
    }
  };

  const updateConfig = (updates: Partial<TenantAxiomConfig>) => {
    if (localConfig) {
      setLocalConfig({ ...localConfig, ...updates });
    }
  };

  const updateFeatureFlag = (flag: keyof TenantAxiomConfig['featureFlags'], value: boolean) => {
    if (localConfig) {
      setLocalConfig({
        ...localConfig,
        featureFlags: { ...localConfig.featureFlags, [flag]: value },
      });
    }
  };

  const updateModelPreferences = (updates: Partial<TenantAxiomConfig['modelPreferences']>) => {
    if (localConfig) {
      setLocalConfig({
        ...localConfig,
        modelPreferences: { ...localConfig.modelPreferences, ...updates },
      });
    }
  };

  if (configLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            AXIOM Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure AXIOM/CLARION settings for tenant: {tenantId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tenant-axiom-config', tenantId] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSessions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedSessions} completed ({Math.round((stats.completedSessions / stats.totalSessions) * 100) || 0}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageQuestionsAnswered.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">per session</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.averageConfidenceScore * 100).toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground">domain detection</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Domain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">
                {stats.topDomains[0]?.domain || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.topDomains[0]?.count || 0} sessions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Model Preferences
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic AXIOM behavior for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enabled">Enable AXIOM</Label>
                  <p className="text-sm text-muted-foreground">
                    Master toggle for AXIOM features
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={localConfig?.enabled ?? true}
                  onCheckedChange={(checked) => updateConfig({ enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Questions Per Session</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[localConfig?.maxQuestionsPerSession ?? 5]}
                    onValueChange={([value]) => updateConfig({ maxQuestionsPerSession: value })}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono">
                    {localConfig?.maxQuestionsPerSession ?? 5}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Maximum clarifying questions before prompt compilation
                </p>
              </div>

              <div className="space-y-2">
                <Label>Confidence Threshold</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[(localConfig?.confidenceThreshold ?? 0.85) * 100]}
                    onValueChange={([value]) => updateConfig({ confidenceThreshold: value / 100 })}
                    min={50}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-mono">
                    {Math.round((localConfig?.confidenceThreshold ?? 0.85) * 100)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Skip questions when domain confidence exceeds this threshold
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="caching">Enable Question Caching</Label>
                  <p className="text-sm text-muted-foreground">
                    Cache question trees for faster loading
                  </p>
                </div>
                <Switch
                  id="caching"
                  checked={localConfig?.enableCaching ?? true}
                  onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                />
              </div>

              {localConfig?.enableCaching && (
                <div className="space-y-2">
                  <Label>Cache TTL (minutes)</Label>
                  <Input
                    type="number"
                    value={localConfig?.cacheTtlMinutes ?? 60}
                    onChange={(e) => updateConfig({ cacheTtlMinutes: parseInt(e.target.value) || 60 })}
                    min={5}
                    max={1440}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Default Domain</Label>
                <Select
                  value={localConfig?.defaultDomain || 'auto'}
                  onValueChange={(value) => updateConfig({ defaultDomain: value === 'auto' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="technology.software">Technology → Software</SelectItem>
                    <SelectItem value="business.finance">Business → Finance</SelectItem>
                    <SelectItem value="science.research">Science → Research</SelectItem>
                    <SelectItem value="creative.writing">Creative → Writing</SelectItem>
                    <SelectItem value="education.learning">Education → Learning</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Pre-select a domain or let AXIOM auto-detect
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Prompt Modifications</CardTitle>
              <CardDescription>
                Add custom text to compiled prompts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt Prefix</Label>
                <Input
                  placeholder="Text added before the system prompt..."
                  value={localConfig?.customPromptPrefix || ''}
                  onChange={(e) => updateConfig({ customPromptPrefix: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prompt Suffix</Label>
                <Input
                  placeholder="Text added after the system prompt..."
                  value={localConfig?.customPromptSuffix || ''}
                  onChange={(e) => updateConfig({ customPromptSuffix: e.target.value || null })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable specific AXIOM features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label>Adaptive Questions</Label>
                  <p className="text-sm text-muted-foreground">
                    Dynamically adjust questions based on answers
                  </p>
                </div>
                <Switch
                  checked={localConfig?.featureFlags.enableAdaptiveQuestions ?? true}
                  onCheckedChange={(checked) => updateFeatureFlag('enableAdaptiveQuestions', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label>Model Scoring</Label>
                  <p className="text-sm text-muted-foreground">
                    Show real-time model prediction scores
                  </p>
                </div>
                <Switch
                  checked={localConfig?.featureFlags.enableModelScoring ?? true}
                  onCheckedChange={(checked) => updateFeatureFlag('enableModelScoring', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label>Prompt Preview</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to preview compiled prompts
                  </p>
                </div>
                <Switch
                  checked={localConfig?.featureFlags.enablePromptPreview ?? true}
                  onCheckedChange={(checked) => updateFeatureFlag('enablePromptPreview', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Feedback Capture</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect user feedback on AXIOM suggestions
                  </p>
                </div>
                <Switch
                  checked={localConfig?.featureFlags.enableFeedbackCapture ?? true}
                  onCheckedChange={(checked) => updateFeatureFlag('enableFeedbackCapture', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Preferences</CardTitle>
              <CardDescription>
                Configure model routing preferences for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Preferred Provider</Label>
                <Select
                  value={localConfig?.modelPreferences.preferredProvider || 'any'}
                  onValueChange={(value) => updateModelPreferences({ preferredProvider: value === 'any' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">No preference</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="xai">xAI</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="self-hosted">Self-Hosted</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Prioritize models from this provider when routing
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cost Limit (per session)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="No limit"
                    value={localConfig?.modelPreferences.costLimit || ''}
                    onChange={(e) => updateModelPreferences({ 
                      costLimit: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Maximum cost per AXIOM session (leave empty for no limit)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {statsLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : stats ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Top Domains</CardTitle>
                  <CardDescription>
                    Most frequently detected domains
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topDomains.map((domain) => (
                        <TableRow key={domain.domain}>
                          <TableCell className="font-medium">{domain.domain}</TableCell>
                          <TableCell className="text-right">{domain.count}</TableCell>
                          <TableCell className="text-right">
                            {((domain.count / stats.totalSessions) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Model Usage</CardTitle>
                  <CardDescription>
                    Models selected by AXIOM routing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Avg Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.modelUsage.map((model) => (
                        <TableRow key={model.model}>
                          <TableCell className="font-medium">{model.model}</TableCell>
                          <TableCell className="text-right">{model.count}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={model.avgScore >= 0.8 ? 'default' : 'secondary'}>
                              {(model.avgScore * 100).toFixed(0)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>No statistics available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
