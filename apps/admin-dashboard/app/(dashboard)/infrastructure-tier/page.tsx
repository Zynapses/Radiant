'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server, 
  Cpu,
  MemoryStick,
  HardDrive,
  Zap,
  TrendingUp,
  RefreshCw,
  Settings,
  ArrowUpCircle,
} from 'lucide-react';

interface TierConfig {
  id: string;
  name: string;
  description: string;
  compute_units: number;
  memory_gb: number;
  storage_gb: number;
  max_concurrent_requests: number;
  cost_per_hour: number;
  is_active: boolean;
  features: string[];
}

interface TierUsage {
  tier_id: string;
  tier_name: string;
  current_usage_percent: number;
  peak_usage_percent: number;
  avg_latency_ms: number;
  requests_today: number;
  scaling_events_today: number;
}

interface TransitionRequest {
  id: string;
  from_tier: string;
  to_tier: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requested_at: string;
  completed_at?: string;
  reason: string;
}

async function fetchTierConfig(): Promise<TierConfig[]> {
  const res = await fetch('/api/admin/infrastructure-tier/config');
  if (!res.ok) throw new Error('Failed to fetch tier config');
  const data = await res.json();
  return data.tiers || [];
}

async function fetchTierUsage(): Promise<TierUsage[]> {
  const res = await fetch('/api/admin/infrastructure-tier/usage');
  if (!res.ok) throw new Error('Failed to fetch tier usage');
  const data = await res.json();
  return data.usage || [];
}

async function fetchTransitions(): Promise<TransitionRequest[]> {
  const res = await fetch('/api/admin/infrastructure-tier/transitions');
  if (!res.ok) throw new Error('Failed to fetch transitions');
  const data = await res.json();
  return data.transitions || [];
}

export default function InfrastructureTierPage() {
  const _queryClient = useQueryClient();
  void _queryClient; // Reserved for mutations

  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: ['tier-config'],
    queryFn: fetchTierConfig,
  });

  const { data: usage = [], isLoading: _usageLoading } = useQuery({
    queryKey: ['tier-usage'],
    queryFn: fetchTierUsage,
  });

  const { data: transitions = [] } = useQuery({
    queryKey: ['tier-transitions'],
    queryFn: fetchTransitions,
  });

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const getUsageColor = (percent: number) => {
    if (percent > 80) return 'text-red-500';
    if (percent > 60) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500">Completed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (tiersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="h-8 w-8" />
          Infrastructure Tiers
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage compute tiers, scaling, and infrastructure transitions
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tiers">Tier Configuration</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {usage.map((tier) => (
              <Card key={tier.tier_id}>
                <CardHeader className="pb-2">
                  <CardDescription>{tier.tier_name}</CardDescription>
                  <CardTitle className={`text-3xl ${getUsageColor(tier.current_usage_percent)}`}>
                    {tier.current_usage_percent.toFixed(1)}%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={tier.current_usage_percent} className="h-2 mb-2" />
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>Peak: {tier.peak_usage_percent.toFixed(1)}%</div>
                    <div>Latency: {tier.avg_latency_ms}ms</div>
                    <div>Requests: {tier.requests_today.toLocaleString()}</div>
                    <div>Scaling: {tier.scaling_events_today}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resource Utilization
              </CardTitle>
              <CardDescription>
                Real-time infrastructure utilization across all tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Resource utilization charts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Card key={tier.id} className={!tier.is_active ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      {tier.name}
                    </CardTitle>
                    <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{tier.compute_units}</div>
                        <div className="text-xs text-muted-foreground">Compute Units</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{tier.memory_gb} GB</div>
                        <div className="text-xs text-muted-foreground">Memory</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{tier.storage_gb} GB</div>
                        <div className="text-xs text-muted-foreground">Storage</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{tier.max_concurrent_requests}</div>
                        <div className="text-xs text-muted-foreground">Max Concurrent</div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cost per hour</span>
                      <span className="font-medium">{formatCurrency(tier.cost_per_hour)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tier.features.map((feature, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transitions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tier Transitions</CardTitle>
                  <CardDescription>
                    Track infrastructure tier changes and migrations
                  </CardDescription>
                </div>
                <Button>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Request Transition
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {transitions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tier transitions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transitions.map((transition) => (
                    <div key={transition.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{transition.from_tier}</Badge>
                          <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
                          <Badge>{transition.to_tier}</Badge>
                        </div>
                        <div>
                          <div className="font-medium">{transition.reason}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(transition.requested_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(transition.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
