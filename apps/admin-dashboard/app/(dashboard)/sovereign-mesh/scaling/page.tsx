'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, BarChart3, 
  CheckCircle2, Cpu, Database, DollarSign, Globe, 
  Layers, MemoryStick, RefreshCw, Server, 
  TrendingUp, Users
} from 'lucide-react';

interface ScalingProfile {
  id: string;
  name: string;
  description: string;
  tier: 'development' | 'staging' | 'production' | 'enterprise';
  targetSessions: number;
  lambda: { reservedConcurrency: number; provisionedConcurrency: number; maxConcurrency: number; memoryMb: number };
  aurora: { minCapacityAcu: number; maxCapacityAcu: number; readReplicaCount: number; enableGlobalDatabase: boolean };
  redis: { nodeType: string; numShards: number; replicasPerShard: number; enableClusterMode: boolean };
  apiGateway: { throttlingRateLimit: number; enableCloudFront: boolean };
  estimatedMonthlyCost: number;
  isActive: boolean;
}

interface SessionMetrics {
  currentActiveSessions: number;
  peakSessionsToday: number;
  peakSessionsWeek: number;
  sessionsLast24Hours: number;
  avgSessionDurationSeconds: number;
}

interface SessionCapacity {
  maxConcurrentSessions: number;
  currentUtilizationPercent: number;
  headroomSessions: number;
  bottleneck: string;
}

interface ComponentHealth {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  utilization: number;
  latencyMs: number;
  errorRate: number;
}

interface ScalingCostEstimate {
  totalMonthlyCost: number;
  costPerSession: number;
  components: Record<string, { totalCost: number }>;
}

interface ScalingDashboard {
  currentProfile: ScalingProfile;
  sessionMetrics: SessionMetrics;
  sessionCapacity: SessionCapacity;
  costEstimate: ScalingCostEstimate;
  componentHealth: ComponentHealth[];
  recommendations: Array<{ id: string; priority: string; title: string; description: string; category: string }>;
  activeAlerts: Array<{ id: string; severity: string; message: string; component: string }>;
}

const TIER_COLORS = {
  development: 'bg-gray-500',
  staging: 'bg-blue-500',
  production: 'bg-green-500',
  enterprise: 'bg-purple-500',
};

const TIER_LABELS = {
  development: { label: 'Development', sessions: '100', cost: '$70/mo' },
  staging: { label: 'Staging', sessions: '1K', cost: '$500/mo' },
  production: { label: 'Production', sessions: '10K', cost: '$5K/mo' },
  enterprise: { label: 'Enterprise', sessions: '500K', cost: '$68K/mo' },
};

export default function SovereignMeshScalingPage() {
  const [dashboard, setDashboard] = useState<ScalingDashboard | null>(null);
  const [_profiles, setProfiles] = useState<ScalingProfile[]>();
  void _profiles; // Reserved for profiles display
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [_selectedTier, setSelectedTier] = useState<string | null>(null);
  void _selectedTier; // Reserved for tier selection

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, profilesRes] = await Promise.all([
        fetch('/api/admin/sovereign-mesh/scaling/dashboard'),
        fetch('/api/admin/sovereign-mesh/scaling/profiles'),
      ]);

      if (dashboardRes.ok) {
        setDashboard(await dashboardRes.json());
      }
      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Failed to fetch scaling data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const applyPreset = async (tier: string) => {
    setApplying(true);
    try {
      const res = await fetch(`/api/admin/sovereign-mesh/scaling/presets/${tier}/apply`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
    setApplying(false);
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const profile = dashboard?.currentProfile;
  const metrics = dashboard?.sessionMetrics;
  const capacity = dashboard?.sessionCapacity;
  const cost = dashboard?.costEstimate;
  const health = dashboard?.componentHealth || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Infrastructure Scaling</h1>
          <p className="text-muted-foreground">
            Scale from 100 to 500,000+ concurrent sessions with cost control
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Tier Banner */}
      {profile && (
        <Card className={`border-l-4 border-l-${profile.tier === 'enterprise' ? 'purple' : profile.tier === 'production' ? 'green' : 'blue'}-500`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge className={TIER_COLORS[profile.tier]}>{profile.tier.toUpperCase()}</Badge>
                <div>
                  <div className="font-semibold text-lg">{profile.name}</div>
                  <div className="text-sm text-muted-foreground">{profile.description}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-8 text-center">
                <div>
                  <div className="text-2xl font-bold">{metrics?.currentActiveSessions.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Active Sessions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{capacity?.maxConcurrentSessions.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Max Capacity</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{capacity?.currentUtilizationPercent.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Utilization</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">${cost?.totalMonthlyCost.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Est. Monthly</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {dashboard?.activeAlerts && dashboard.activeAlerts.length > 0 && (
        <div className="space-y-2">
          {dashboard.activeAlerts.map(alert => (
            <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.component}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Users className="w-4 h-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="infrastructure">
            <Server className="w-4 h-4 mr-2" />
            Infrastructure
          </TabsTrigger>
          <TabsTrigger value="cost">
            <DollarSign className="w-4 h-4 mr-2" />
            Cost
          </TabsTrigger>
          <TabsTrigger value="scale">
            <Layers className="w-4 h-4 mr-2" />
            Scale
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Session Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Active Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.currentActiveSessions.toLocaleString()}</div>
                <Progress value={capacity?.currentUtilizationPercent || 0} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {capacity?.headroomSessions.toLocaleString()} headroom
                </p>
              </CardContent>
            </Card>

            {/* Peak Sessions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Peak Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.peakSessionsToday.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Week peak: {metrics?.peakSessionsWeek.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            {/* Bottleneck */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Bottleneck
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{capacity?.bottleneck || 'None'}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Limiting factor for scaling
                </p>
              </CardContent>
            </Card>

            {/* Cost Per Session */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Cost/Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${cost?.costPerSession.toFixed(4)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per concurrent session
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Component Health */}
          <Card>
            <CardHeader>
              <CardTitle>Component Health</CardTitle>
              <CardDescription>Real-time status of infrastructure components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {health.map(h => (
                  <div key={h.component} className="text-center p-4 rounded-lg border">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                      h.status === 'healthy' ? 'bg-green-500' : 
                      h.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <div className="font-semibold capitalize">{h.component.replace('_', ' ')}</div>
                    <div className="text-sm text-muted-foreground">{h.utilization.toFixed(0)}% util</div>
                    <div className="text-xs text-muted-foreground">{h.latencyMs}ms</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {dashboard?.recommendations && dashboard.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.recommendations.slice(0, 3).map(rec => (
                  <div key={rec.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rec.priority === 'critical' ? 'destructive' : rec.priority === 'high' ? 'default' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                        <span className="font-medium">{rec.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                    <Button size="sm" variant="outline">Apply</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Capacity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Current</span>
                    <span className="font-bold">{metrics?.currentActiveSessions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maximum</span>
                    <span className="font-bold">{capacity?.maxConcurrentSessions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Headroom</span>
                    <span className="font-bold text-green-600">{capacity?.headroomSessions.toLocaleString()}</span>
                  </div>
                </div>
                <Progress value={capacity?.currentUtilizationPercent || 0} className="h-4" />
                <div className="text-center text-sm text-muted-foreground">
                  {capacity?.currentUtilizationPercent.toFixed(1)}% utilization
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Last 24 Hours</span>
                  <span className="font-bold">{metrics?.sessionsLast24Hours.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak Today</span>
                  <span className="font-bold">{metrics?.peakSessionsToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak This Week</span>
                  <span className="font-bold">{metrics?.peakSessionsWeek.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Duration</span>
                  <span className="font-bold">{metrics?.avgSessionDurationSeconds.toFixed(1)}s</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Capacity by Component</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> Lambda
                  </span>
                  <span className="font-bold">{(profile?.lambda.maxConcurrency || 0) * 10}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4" /> Aurora
                  </span>
                  <span className="font-bold">{((profile?.aurora.maxCapacityAcu || 0) * 100).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4" /> Redis
                  </span>
                  <span className="font-bold">{profile?.redis.numShards ? (profile.redis.numShards * 50000).toLocaleString() : '65,000'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4" /> API Gateway
                  </span>
                  <span className="font-bold">{profile?.apiGateway.throttlingRateLimit.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lambda */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" /> Lambda Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Reserved Concurrency</Label>
                    <div className="text-2xl font-bold">{profile?.lambda.reservedConcurrency}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Provisioned</Label>
                    <div className="text-2xl font-bold">{profile?.lambda.provisionedConcurrency}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Max Concurrency</Label>
                    <div className="text-2xl font-bold">{profile?.lambda.maxConcurrency}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Memory</Label>
                    <div className="text-2xl font-bold">{profile?.lambda.memoryMb} MB</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Aurora */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" /> Aurora Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Min ACU</Label>
                    <div className="text-2xl font-bold">{profile?.aurora.minCapacityAcu}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Max ACU</Label>
                    <div className="text-2xl font-bold">{profile?.aurora.maxCapacityAcu}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Read Replicas</Label>
                    <div className="text-2xl font-bold">{profile?.aurora.readReplicaCount}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Global DB</Label>
                    <div className="text-2xl font-bold">{profile?.aurora.enableGlobalDatabase ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Redis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MemoryStick className="w-5 h-5" /> Redis Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Node Type</Label>
                    <div className="text-lg font-bold">{profile?.redis.nodeType}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Shards</Label>
                    <div className="text-2xl font-bold">{profile?.redis.numShards}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Replicas/Shard</Label>
                    <div className="text-2xl font-bold">{profile?.redis.replicasPerShard}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cluster Mode</Label>
                    <div className="text-2xl font-bold">{profile?.redis.enableClusterMode ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Gateway */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" /> API Gateway Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Rate Limit</Label>
                    <div className="text-2xl font-bold">{profile?.apiGateway.throttlingRateLimit.toLocaleString()} RPS</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CloudFront</Label>
                    <div className="text-2xl font-bold">{profile?.apiGateway.enableCloudFront ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cost Tab */}
        <TabsContent value="cost" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>Monthly cost by component</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cost?.components && Object.entries(cost.components).map(([name, comp]) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="capitalize">{name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Progress value={(comp.totalCost / (cost?.totalMonthlyCost || 1)) * 100} className="w-32 h-2" />
                        <span className="font-bold w-24 text-right">${comp.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>Total Monthly Cost</span>
                    <span>${cost?.totalMonthlyCost.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Cost per Session</Label>
                  <div className="text-2xl font-bold">${cost?.costPerSession.toFixed(4)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cost per 1,000 Sessions</Label>
                  <div className="text-2xl font-bold">${((cost?.costPerSession || 0) * 1000).toFixed(2)}</div>
                </div>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Annual Estimate</Label>
                  <div className="text-2xl font-bold">${((cost?.totalMonthlyCost || 0) * 12).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scale Tab */}
        <TabsContent value="scale" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Scale</CardTitle>
              <CardDescription>Select a scaling tier to instantly configure infrastructure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {(['development', 'staging', 'production', 'enterprise'] as const).map(tier => {
                  const info = TIER_LABELS[tier];
                  const isActive = profile?.tier === tier;
                  return (
                    <div
                      key={tier}
                      className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedTier(tier)}
                    >
                      <Badge className={TIER_COLORS[tier]}>{tier}</Badge>
                      <h3 className="text-xl font-bold mt-3">{info.label}</h3>
                      <div className="text-3xl font-bold mt-2">{info.sessions}</div>
                      <div className="text-sm text-muted-foreground">max sessions</div>
                      <div className="text-lg font-semibold mt-4 text-green-600">{info.cost}</div>
                      {isActive && (
                        <Badge variant="outline" className="mt-3">Current</Badge>
                      )}
                      {!isActive && (
                        <Button 
                          className="mt-3 w-full" 
                          size="sm"
                          disabled={applying}
                          onClick={(e) => { e.stopPropagation(); applyPreset(tier); }}
                        >
                          {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Apply'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Scaling Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Scaling Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span>Development → Staging</span>
                    <span className="text-sm">+$430/mo for 10x capacity</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span>Staging → Production</span>
                    <span className="text-sm">+$4,500/mo for 10x capacity</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span>Production → Enterprise</span>
                    <span className="text-sm">+$63,500/mo for 50x capacity</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Lambda provisioned concurrency for instant starts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Aurora Serverless v2 with auto-scaling ACUs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Redis cluster mode for horizontal scaling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Multi-region deployment for global reach</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>CloudFront edge caching for low latency</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
