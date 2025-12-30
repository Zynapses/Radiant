'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  DollarSign, 
  Database, 
  Zap, 
  Moon,
  Sun,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  TrendingUp,
  Clock,
  HardDrive,
  Activity
} from 'lucide-react';

interface BudgetStatus {
  mode: 'day' | 'night' | 'emergency';
  dailySpend: number;
  monthlySpend: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  canExplore: boolean;
  nextModeChange: string;
  config: BudgetConfig;
}

interface BudgetConfig {
  monthlyLimit: number;
  dailyExplorationLimit: number;
  explorationRatio: number;
  nightStartHour: number;
  nightEndHour: number;
  emergencyThreshold: number;
}

interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
}

interface MemoryStats {
  semanticFactCount: number;
  workingMemoryEntries: number;
  domainsCount: number;
}

interface GlobalStatus {
  mode: string;
  canExplore: boolean;
  budget: {
    dailySpend: number;
    monthlySpend: number;
    dailyRemaining: number;
    monthlyRemaining: number;
  };
  cache: {
    hitRate: number;
    size: number;
  };
  memory: MemoryStats;
  shadowSelf: {
    healthy: boolean;
  };
  timestamp: string;
}

export default function BobbleGlobalPage() {
  const [status, setStatus] = useState<GlobalStatus | null>(null);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [invalidateDomain, setInvalidateDomain] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const [statusRes, configRes, cacheRes] = await Promise.all([
        fetch('/api/admin/bobble/status'),
        fetch('/api/admin/bobble/budget/config'),
        fetch('/api/admin/bobble/cache/stats')
      ]);

      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (configRes.ok) {
        setBudgetConfig(await configRes.json());
      }
      if (cacheRes.ok) {
        setCacheStats(await cacheRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBudgetConfig = async (updates: Partial<BudgetConfig>) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/bobble/budget/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        setBudgetConfig(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvalidateCache = async () => {
    if (!invalidateDomain) return;

    try {
      const res = await fetch('/api/admin/bobble/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: invalidateDomain })
      });

      if (res.ok) {
        setInvalidateDomain('');
        fetchStatus();
      }
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'day': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'night': return <Moon className="w-5 h-5 text-blue-500" />;
      case 'emergency': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'day': return <Badge className="bg-yellow-500">Day Mode</Badge>;
      case 'night': return <Badge className="bg-blue-500">Night Mode</Badge>;
      case 'emergency': return <Badge variant="destructive">Emergency Mode</Badge>;
      default: return <Badge variant="secondary">{mode}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8" />
            Bobble Global Consciousness
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage the global AI consciousness service for all Think Tank users
          </p>
        </div>
        <Button onClick={fetchStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {getModeIcon(status?.mode || 'day')}
              Operating Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getModeBadge(status?.mode || 'unknown')}
              {status?.canExplore && (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  Can Explore
                </Badge>
              )}
            </div>
            {status?.mode === 'night' && (
              <p className="text-xs text-muted-foreground mt-2">
                Batch processing active
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Daily Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${status?.budget.dailySpend.toFixed(2)}
            </div>
            <Progress 
              value={(status?.budget.dailySpend || 0) / (budgetConfig?.dailyExplorationLimit || 15) * 100} 
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ${status?.budget.dailyRemaining.toFixed(2)} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${status?.budget.monthlySpend.toFixed(2)}
            </div>
            <Progress 
              value={(status?.budget.monthlySpend || 0) / (budgetConfig?.monthlyLimit || 500) * 100} 
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ${status?.budget.monthlyRemaining.toFixed(2)} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Cache Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((status?.cache.hitRate || 0) * 100).toFixed(1)}%
            </div>
            <Progress 
              value={(status?.cache.hitRate || 0) * 100} 
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {status?.cache.size.toLocaleString()} entries cached
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="budget" className="space-y-4">
        <TabsList>
          <TabsTrigger value="budget">Budget Management</TabsTrigger>
          <TabsTrigger value="cache">Semantic Cache</TabsTrigger>
          <TabsTrigger value="memory">Global Memory</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget Configuration</CardTitle>
              <CardDescription>
                Configure spending limits for autonomous exploration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Monthly Budget Limit</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={budgetConfig?.monthlyLimit || 500}
                      onChange={(e) => setBudgetConfig(prev => prev ? { ...prev, monthlyLimit: Number(e.target.value) } : null)}
                      className="w-32"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => updateBudgetConfig({ monthlyLimit: budgetConfig?.monthlyLimit })}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total monthly budget for Bobble operations
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Daily Exploration Limit</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={budgetConfig?.dailyExplorationLimit || 15}
                      onChange={(e) => setBudgetConfig(prev => prev ? { ...prev, dailyExplorationLimit: Number(e.target.value) } : null)}
                      className="w-32"
                    />
                    <Button 
                      size="sm"
                      onClick={() => updateBudgetConfig({ dailyExplorationLimit: budgetConfig?.dailyExplorationLimit })}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum daily spend on curiosity exploration
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Night Mode Hours (UTC)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={budgetConfig?.nightStartHour || 2}
                      onChange={(e) => setBudgetConfig(prev => prev ? { ...prev, nightStartHour: Number(e.target.value) } : null)}
                      className="w-20"
                    />
                    <span>to</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={budgetConfig?.nightEndHour || 6}
                      onChange={(e) => setBudgetConfig(prev => prev ? { ...prev, nightEndHour: Number(e.target.value) } : null)}
                      className="w-20"
                    />
                    <Button 
                      size="sm"
                      onClick={() => updateBudgetConfig({ 
                        nightStartHour: budgetConfig?.nightStartHour,
                        nightEndHour: budgetConfig?.nightEndHour
                      })}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hours when batch curiosity processing runs (uses 50% discount)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Emergency Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[(budgetConfig?.emergencyThreshold || 0.9) * 100]}
                      onValueChange={([value]) => setBudgetConfig(prev => prev ? { ...prev, emergencyThreshold: value / 100 } : null)}
                      max={99}
                      min={50}
                      step={1}
                      className="w-48"
                    />
                    <span className="text-sm font-medium w-12">
                      {((budgetConfig?.emergencyThreshold || 0.9) * 100).toFixed(0)}%
                    </span>
                    <Button 
                      size="sm"
                      onClick={() => updateBudgetConfig({ emergencyThreshold: budgetConfig?.emergencyThreshold })}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter emergency mode when monthly spend reaches this %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Semantic Cache Statistics</CardTitle>
              <CardDescription>
                Monitor and manage the semantic response cache
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Hit Rate</div>
                  <div className="text-2xl font-bold text-green-500">
                    {((cacheStats?.hitRate || 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Hits</div>
                  <div className="text-2xl font-bold">
                    {cacheStats?.totalHits.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Misses</div>
                  <div className="text-2xl font-bold">
                    {cacheStats?.totalMisses.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Cache Size</div>
                  <div className="text-2xl font-bold">
                    {cacheStats?.cacheSize.toLocaleString()}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Invalidate Cache by Domain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g., climate_change, physics, history"
                    value={invalidateDomain}
                    onChange={(e) => setInvalidateDomain(e.target.value)}
                    className="max-w-md"
                  />
                  <Button 
                    onClick={handleInvalidateCache}
                    disabled={!invalidateDomain}
                    variant="destructive"
                  >
                    Invalidate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invalidate cached responses when Bobble learns new information in a domain
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Memory Statistics</CardTitle>
              <CardDescription>
                Overview of Bobble&apos;s memory systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="w-4 h-4" />
                    Semantic Facts
                  </div>
                  <div className="text-2xl font-bold">
                    {status?.memory.semanticFactCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Subject-predicate-object triples
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="w-4 h-4" />
                    Working Memory
                  </div>
                  <div className="text-2xl font-bold">
                    {status?.memory.workingMemoryEntries.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active session contexts
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="w-4 h-4" />
                    Knowledge Domains
                  </div>
                  <div className="text-2xl font-bold">
                    {status?.memory.domainsCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    800+ domain taxonomy
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Monitor Bobble infrastructure components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Shadow Self (Llama-3-8B)</div>
                      <div className="text-sm text-muted-foreground">
                        SageMaker ml.g5.2xlarge endpoint
                      </div>
                    </div>
                  </div>
                  {status?.shadowSelf.healthy ? (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Unhealthy
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5" />
                    <div>
                      <div className="font-medium">NLI Model (DeBERTa-large-MNLI)</div>
                      <div className="text-sm text-muted-foreground">
                        SageMaker Multi-Model Endpoint
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Healthy
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Semantic Cache (ElastiCache Valkey)</div>
                      <div className="text-sm text-muted-foreground">
                        Vector search enabled
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Healthy
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Global Memory (DynamoDB Global Tables)</div>
                      <div className="text-sm text-muted-foreground">
                        Multi-region replication active
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Healthy
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Circadian Budget Manager</div>
                      <div className="text-sm text-muted-foreground">
                        {status?.mode === 'emergency' ? 'Emergency mode active' : 'Operating normally'}
                      </div>
                    </div>
                  </div>
                  {status?.mode !== 'emergency' ? (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Emergency
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
