'use client';

/**
 * Economic Governor Admin Page
 * RADIANT v5.0.2 - System Evolution
 * 
 * Admin interface for managing cost optimization and model routing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { 
  Gauge, 
  DollarSign, 
  TrendingDown, 
  Zap,
  RefreshCw,
  Settings,
  BarChart3,
  ArrowDownRight,
  ArrowUpRight,
  Minus
} from 'lucide-react';

type GovernorMode = 'performance' | 'balanced' | 'cost_saver' | 'off';

interface DomainConfig {
  domain: string;
  mode: GovernorMode;
  updatedAt: string;
}

interface GovernorStats {
  period: { days: number };
  summary: {
    totalDecisions: number;
    avgComplexity: number;
    totalSavings: number;
    modelSwaps: number;
    taskDistribution: {
      simple: number;
      medium: number;
      complex: number;
    };
  };
  daily: Array<{
    day: string;
    decisions: number;
    savings: number;
    avgComplexity: number;
  }>;
  byMode: Array<{
    mode: string;
    count: number;
    savings: number;
  }>;
}

interface RecentDecision {
  id: string;
  executionId: string;
  originalModel: string;
  selectedModel: string;
  complexityScore: number;
  savingsAmount: number;
  mode: string;
  reason: string;
  createdAt: string;
}

const DOMAINS = ['general', 'medical', 'financial', 'legal', 'technical', 'creative'];

const MODE_DESCRIPTIONS: Record<GovernorMode, { label: string; description: string; color: string }> = {
  performance: { 
    label: 'Performance', 
    description: 'Always use the original model (no optimization)',
    color: 'bg-blue-500'
  },
  balanced: { 
    label: 'Balanced', 
    description: 'Optimize simple tasks, preserve quality for complex ones',
    color: 'bg-green-500'
  },
  cost_saver: { 
    label: 'Cost Saver', 
    description: 'Aggressively optimize for cost (may impact quality)',
    color: 'bg-yellow-500'
  },
  off: { 
    label: 'Disabled', 
    description: 'Governor is completely disabled',
    color: 'bg-gray-500'
  }
};

export default function GovernorPage() {
  const { toast } = useToast();
  const [domainConfigs, setDomainConfigs] = useState<DomainConfig[]>([]);
  const [stats, setStats] = useState<GovernorStats | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/mission-control/governor/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      const data = await response.json();
      setDomainConfigs(data.domains || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load Governor configuration',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/mission-control/governor/statistics?days=${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch governor stats:', error);
    }
  }, [selectedPeriod]);

  const fetchRecentDecisions = useCallback(async () => {
    try {
      const response = await fetch('/api/mission-control/governor/recent?limit=20');
      if (!response.ok) throw new Error('Failed to fetch recent decisions');
      const data = await response.json();
      setRecentDecisions(data.decisions || []);
    } catch (error) {
      console.error('Failed to fetch recent decisions:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchStats(), fetchRecentDecisions()])
      .finally(() => setLoading(false));
  }, [fetchConfig, fetchStats, fetchRecentDecisions]);

  const handleModeChange = async (domain: string, mode: GovernorMode) => {
    try {
      const response = await fetch('/api/mission-control/governor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, mode })
      });

      if (!response.ok) throw new Error('Failed to update mode');

      toast({ title: 'Success', description: `Governor mode updated for ${domain}` });
      fetchConfig();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to update Governor mode', 
        variant: 'destructive' 
      });
    }
  };

  const getModelSwapIcon = (original: string, selected: string) => {
    if (original === selected) return <Minus className="h-4 w-4 text-gray-400" />;
    if (selected.includes('mini') || selected.includes('haiku')) {
      return <ArrowDownRight className="h-4 w-4 text-green-500" />;
    }
    return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
  };

  const getComplexityBadge = (score: number) => {
    if (score <= 4) return <Badge className="bg-green-100 text-green-800">Simple ({score})</Badge>;
    if (score <= 8) return <Badge className="bg-yellow-100 text-yellow-800">Medium ({score})</Badge>;
    return <Badge className="bg-red-100 text-red-800">Complex ({score})</Badge>;
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gauge className="h-8 w-8" />
            Economic Governor
          </h1>
          <p className="text-muted-foreground mt-1">
            Cost optimization through intelligent model routing
          </p>
        </div>
        <Button variant="outline" onClick={() => {
          fetchConfig();
          fetchStats();
          fetchRecentDecisions();
        }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats?.summary.totalSavings.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {selectedPeriod} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decisions Made</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.totalDecisions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.summary.modelSwaps || 0} model swaps
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Complexity</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.summary.avgComplexity.toFixed(1) || '0.0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Scale: 1-10
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Reduction</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.summary.totalDecisions ? 
                `${((stats.summary.modelSwaps / stats.summary.totalDecisions) * 100).toFixed(0)}%` : 
                '0%'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Tasks optimized
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Distribution */}
      {stats?.summary.taskDistribution && (
        <Card>
          <CardHeader>
            <CardTitle>Task Complexity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Simple (1-4)</div>
                <div className="text-2xl font-bold">{stats.summary.taskDistribution.simple}</div>
                <div className="text-xs text-muted-foreground">Routed to efficient models</div>
              </div>
              <div className="flex-1 p-4 bg-yellow-50 rounded-lg">
                <div className="text-sm text-yellow-600 font-medium">Medium (5-8)</div>
                <div className="text-2xl font-bold">{stats.summary.taskDistribution.medium}</div>
                <div className="text-xs text-muted-foreground">Used original model</div>
              </div>
              <div className="flex-1 p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-red-600 font-medium">Complex (9-10)</div>
                <div className="text-2xl font-bold">{stats.summary.taskDistribution.complex}</div>
                <div className="text-xs text-muted-foreground">Upgraded to premium</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="recent">Recent Decisions</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domain Configuration</CardTitle>
              <CardDescription>
                Configure Governor mode per domain. Different domains can have different optimization strategies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DOMAINS.map(domain => {
                    const config = domainConfigs.find(c => c.domain === domain);
                    const currentMode = (config?.mode || 'balanced') as GovernorMode;
                    const modeInfo = MODE_DESCRIPTIONS[currentMode];
                    
                    return (
                      <TableRow key={domain}>
                        <TableCell className="font-medium capitalize">{domain}</TableCell>
                        <TableCell>
                          <Select 
                            value={currentMode}
                            onValueChange={(v) => handleModeChange(domain, v as GovernorMode)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(MODE_DESCRIPTIONS).map(([mode, info]) => (
                                <SelectItem key={mode} value={mode}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${info.color}`} />
                                    {info.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {modeInfo.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {config?.updatedAt ? new Date(config.updatedAt).toLocaleDateString() : 'Default'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mode Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(MODE_DESCRIPTIONS).map(([mode, info]) => (
                  <div key={mode} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${info.color}`} />
                      <span className="font-medium">{info.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                    <div className="mt-2 text-xs">
                      {mode === 'balanced' && (
                        <span className="text-green-600">Recommended for most use cases</span>
                      )}
                      {mode === 'cost_saver' && (
                        <span className="text-yellow-600">May reduce response quality</span>
                      )}
                      {mode === 'performance' && (
                        <span className="text-blue-600">Best quality, highest cost</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Routing Decisions</CardTitle>
              <CardDescription>
                Last 20 model routing decisions made by the Governor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Complexity</TableHead>
                    <TableHead>Original Model</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Selected Model</TableHead>
                    <TableHead>Savings</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDecisions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No routing decisions yet. The Governor will start making decisions when tasks are processed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentDecisions.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(d.createdAt).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>{getComplexityBadge(d.complexityScore)}</TableCell>
                        <TableCell className="font-mono text-sm">{d.originalModel}</TableCell>
                        <TableCell>{getModelSwapIcon(d.originalModel, d.selectedModel)}</TableCell>
                        <TableCell className="font-mono text-sm">{d.selectedModel}</TableCell>
                        <TableCell className={d.savingsAmount > 0 ? 'text-green-600' : ''}>
                          {d.savingsAmount > 0 ? `$${d.savingsAmount.toFixed(4)}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {d.reason}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
