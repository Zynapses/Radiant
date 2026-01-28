'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wand2,
  Save,
  RefreshCw,
  Settings,
  Zap,
  Shield,
  Brain,
  BarChart3,
} from 'lucide-react';

interface AIHelperConfig {
  enabled: boolean;
  enableDisambiguation: boolean;
  enableInference: boolean;
  enableRecovery: boolean;
  enableValidation: boolean;
  enableExplanation: boolean;
  defaultModel: string;
  maxTokensPerCall: number;
  cacheTtlSeconds: number;
  maxCallsPerMinute: number;
  maxDailyBudgetUsd: number;
  confidenceThreshold: number;
}

interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  callsByType: Record<string, number>;
}

export default function AIHelperPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<AIHelperConfig>({
    enabled: true,
    enableDisambiguation: true,
    enableInference: true,
    enableRecovery: true,
    enableValidation: true,
    enableExplanation: true,
    defaultModel: 'gpt-4o-mini',
    maxTokensPerCall: 2000,
    cacheTtlSeconds: 3600,
    maxCallsPerMinute: 60,
    maxDailyBudgetUsd: 10,
    confidenceThreshold: 0.7,
  });
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, usageRes] = await Promise.all([
        fetch('/api/admin/sovereign-mesh/ai-helper/config'),
        fetch('/api/admin/sovereign-mesh/ai-helper/usage'),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) setConfig(data.config);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.usage || null);
      }
    } catch (error) {
      console.error('Failed to load AI Helper config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/sovereign-mesh/ai-helper/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast({
          title: 'Configuration Saved',
          description: 'AI Helper configuration has been updated.',
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save AI Helper configuration.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: 'Save Failed',
        description: 'An error occurred while saving configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Helper Configuration</h1>
          <p className="text-muted-foreground">
            Configure parametric AI assistance for the Sovereign Mesh
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="usage">Usage Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    AI Helper
                  </CardTitle>
                  <CardDescription>
                    Parametric AI assistance at every node level
                  </CardDescription>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Disambiguation</Label>
                    <p className="text-sm text-muted-foreground">Resolve unclear inputs</p>
                  </div>
                  <Switch
                    checked={config.enableDisambiguation}
                    onCheckedChange={(checked) => setConfig({ ...config, enableDisambiguation: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Parameter Inference</Label>
                    <p className="text-sm text-muted-foreground">Infer missing parameters</p>
                  </div>
                  <Switch
                    checked={config.enableInference}
                    onCheckedChange={(checked) => setConfig({ ...config, enableInference: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Error Recovery</Label>
                    <p className="text-sm text-muted-foreground">Intelligent error handling</p>
                  </div>
                  <Switch
                    checked={config.enableRecovery}
                    onCheckedChange={(checked) => setConfig({ ...config, enableRecovery: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Validation</Label>
                    <p className="text-sm text-muted-foreground">Pre-execution validation</p>
                  </div>
                  <Switch
                    checked={config.enableValidation}
                    onCheckedChange={(checked) => setConfig({ ...config, enableValidation: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Explanation</Label>
                    <p className="text-sm text-muted-foreground">Post-execution explanations</p>
                  </div>
                  <Switch
                    checked={config.enableExplanation}
                    onCheckedChange={(checked) => setConfig({ ...config, enableExplanation: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Model Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Model</Label>
                  <Select
                    value={config.defaultModel}
                    onValueChange={(value) => setConfig({ ...config, defaultModel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o (Balanced)</SelectItem>
                      <SelectItem value="claude-3-haiku">Claude 3 Haiku (Fast)</SelectItem>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet (Balanced)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens Per Call</Label>
                  <Input
                    type="number"
                    value={config.maxTokensPerCall}
                    onChange={(e) => setConfig({ ...config, maxTokensPerCall: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confidence Threshold: {config.confidenceThreshold}</Label>
                  <Slider
                    value={[config.confidenceThreshold]}
                    min={0.5}
                    max={0.99}
                    step={0.01}
                    onValueChange={([value]) => setConfig({ ...config, confidenceThreshold: value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum confidence to accept AI suggestions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Rate Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Max Calls Per Minute</Label>
                  <Input
                    type="number"
                    value={config.maxCallsPerMinute}
                    onChange={(e) => setConfig({ ...config, maxCallsPerMinute: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Daily Budget (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.maxDailyBudgetUsd}
                    onChange={(e) => setConfig({ ...config, maxDailyBudgetUsd: parseFloat(e.target.value) })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Caching
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cache TTL (seconds)</Label>
                  <Input
                    type="number"
                    value={config.cacheTtlSeconds}
                    onChange={(e) => setConfig({ ...config, cacheTtlSeconds: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    How long to cache AI responses
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Calls (24h)</CardDescription>
                <CardTitle className="text-2xl">{usage?.totalCalls?.toLocaleString() || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Tokens (24h)</CardDescription>
                <CardTitle className="text-2xl">{usage?.totalTokens?.toLocaleString() || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Cost (24h)</CardDescription>
                <CardTitle className="text-2xl">${usage?.totalCostUsd?.toFixed(2) || '0.00'}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cache Hit Rate</CardDescription>
                <CardTitle className="text-2xl">{((usage?.cacheHitRate || 0) * 100).toFixed(1)}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Calls by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usage?.callsByType && Object.entries(usage.callsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{type}</Badge>
                    </div>
                    <span className="font-medium">{count.toLocaleString()}</span>
                  </div>
                ))}
                {(!usage?.callsByType || Object.keys(usage.callsByType).length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No usage data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
