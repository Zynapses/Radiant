'use client';

/**
 * Think Tank Admin Simulator
 * v1.0 - Interactive simulation of admin features
 * 
 * Demonstrates:
 * - Polymorphic UI configuration
 * - Economic Governor settings
 * - Ego System management
 * - Delight triggers
 * - User rules
 * - Domain configuration
 * - Cost management
 * - User analytics
 */

import React, { useState } from 'react';
import { 
  Layers,
  Gauge,
  Brain,
  Sparkles,
  Shield,
  Globe,
  DollarSign,
  Users,
  Activity,
  Zap,
  BarChart3,
  TrendingUp,
  Play,
  Pause,
  RefreshCw,
  Save,
  AlertTriangle,
  Heart,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { 
  AdminViewType, 
  PolymorphicConfig, 
  GovernorConfig, 
  GovernorMode,
  EgoConfig,
  DelightTrigger,
  UserRule,
  DomainConfig,
  ModelPricing,
  ExecutionMode,
} from './types';

import {
  DEFAULT_POLYMORPHIC_CONFIG,
  DEFAULT_GOVERNOR_CONFIG,
  MOCK_GOVERNOR_STATS,
  DEFAULT_EGO_CONFIG,
  MOCK_DELIGHT_TRIGGERS,
  MOCK_DELIGHT_STATS,
  MOCK_USER_RULES,
  MOCK_DOMAINS,
  MOCK_MODEL_PRICING,
  MOCK_COST_BUDGET,
  MOCK_USER_STATS,
  GOVERNOR_MODES,
} from './mock-data';

// Navigation items
const NAV_ITEMS: { id: AdminViewType; icon: React.ElementType; label: string; badge?: string }[] = [
  { id: 'overview', icon: Activity, label: 'Overview' },
  { id: 'polymorphic', icon: Layers, label: 'Polymorphic UI' },
  { id: 'governor', icon: Gauge, label: 'Governor' },
  { id: 'ego', icon: Brain, label: 'Ego System' },
  { id: 'delight', icon: Sparkles, label: 'Delight' },
  { id: 'rules', icon: Shield, label: 'Rules', badge: String(MOCK_USER_RULES.length) },
  { id: 'domains', icon: Globe, label: 'Domains' },
  { id: 'costs', icon: DollarSign, label: 'Costs' },
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
];

export default function AdminSimulatorPage() {
  // State
  const [currentView, setCurrentView] = useState<AdminViewType>('overview');
  const [polymorphicConfig, setPolymorphicConfig] = useState<PolymorphicConfig>(DEFAULT_POLYMORPHIC_CONFIG);
  const [governorConfig, setGovernorConfig] = useState<GovernorConfig>(DEFAULT_GOVERNOR_CONFIG);
  const [egoConfig, setEgoConfig] = useState<EgoConfig>(DEFAULT_EGO_CONFIG);
  const [delightTriggers, setDelightTriggers] = useState<DelightTrigger[]>(MOCK_DELIGHT_TRIGGERS);
  const [userRules, setUserRules] = useState<UserRule[]>(MOCK_USER_RULES);
  const [domains, setDomains] = useState<DomainConfig[]>(MOCK_DOMAINS);
  const [modelPricing, setModelPricing] = useState<ModelPricing[]>(MOCK_MODEL_PRICING);
  const [isSimulating, setIsSimulating] = useState(false);

  // ============================================================================
  // Overview View
  // ============================================================================
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests Today</CardDescription>
            <CardTitle className="text-3xl">{MOCK_GOVERNOR_STATS.totalRequests.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              +12.5% from yesterday
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost Savings</CardDescription>
            <CardTitle className="text-3xl text-green-600">${MOCK_GOVERNOR_STATS.costSavings.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Gauge className="h-4 w-4" />
              Via Economic Governor
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-3xl">{MOCK_USER_STATS.activeToday}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              of {MOCK_USER_STATS.totalUsers} total
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>User Satisfaction</CardDescription>
            <CardTitle className="text-3xl">{MOCK_DELIGHT_STATS.userSatisfaction}/5.0</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <Heart className="h-4 w-4" />
              +{(MOCK_DELIGHT_STATS.engagementLift * 100).toFixed(0)}% engagement
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common admin tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setCurrentView('polymorphic')}>
              <Layers className="h-5 w-5" />
              <span className="text-xs">Configure UI</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setCurrentView('governor')}>
              <Gauge className="h-5 w-5" />
              <span className="text-xs">Tune Governor</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setCurrentView('rules')}>
              <Shield className="h-5 w-5" />
              <span className="text-xs">Manage Rules</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setCurrentView('costs')}>
              <DollarSign className="h-5 w-5" />
              <span className="text-xs">View Costs</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Routing Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Routing Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  Sniper Mode
                </span>
                <span>{((MOCK_GOVERNOR_STATS.sniperRouted / MOCK_GOVERNOR_STATS.totalRequests) * 100).toFixed(1)}%</span>
              </div>
              <Progress value={(MOCK_GOVERNOR_STATS.sniperRouted / MOCK_GOVERNOR_STATS.totalRequests) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" />
                  War Room Mode
                </span>
                <span>{((MOCK_GOVERNOR_STATS.warRoomRouted / MOCK_GOVERNOR_STATS.totalRequests) * 100).toFixed(1)}%</span>
              </div>
              <Progress value={(MOCK_GOVERNOR_STATS.warRoomRouted / MOCK_GOVERNOR_STATS.totalRequests) * 100} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  HITL Escalations
                </span>
                <span>{((MOCK_GOVERNOR_STATS.hitlEscalations / MOCK_GOVERNOR_STATS.totalRequests) * 100).toFixed(1)}%</span>
              </div>
              <Progress value={(MOCK_GOVERNOR_STATS.hitlEscalations / MOCK_GOVERNOR_STATS.totalRequests) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Polymorphic UI</span>
              <Badge variant={polymorphicConfig.enableAutoMorphing ? 'default' : 'secondary'}>
                {polymorphicConfig.enableAutoMorphing ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Economic Governor</span>
              <Badge variant={governorConfig.mode !== 'off' ? 'default' : 'secondary'}>
                {GOVERNOR_MODES[governorConfig.mode].label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Ego System</span>
              <Badge variant={egoConfig.enabled ? 'default' : 'secondary'}>
                {egoConfig.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Delight Triggers</span>
              <Badge variant="outline">
                {delightTriggers.filter(t => t.enabled).length} active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">User Rules</span>
              <Badge variant="outline">
                {userRules.filter(r => r.enabled).length} active
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================================================
  // Polymorphic UI View
  // ============================================================================
  const renderPolymorphicView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Polymorphic UI Configuration</CardTitle>
              <CardDescription>Configure how the UI morphs based on user intent</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Layers className="h-3 w-3" />
              PROMPT-41
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Feature Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Auto Morphing</Label>
                <p className="text-xs text-muted-foreground">UI transforms based on detected intent</p>
              </div>
              <Switch
                checked={polymorphicConfig.enableAutoMorphing}
                onCheckedChange={(checked) => setPolymorphicConfig(prev => ({ ...prev, enableAutoMorphing: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Gearbox Toggle</Label>
                <p className="text-xs text-muted-foreground">Users can switch Sniper/War Room</p>
              </div>
              <Switch
                checked={polymorphicConfig.enableGearbox}
                onCheckedChange={(checked) => setPolymorphicConfig(prev => ({ ...prev, enableGearbox: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Cost Display</Label>
                <p className="text-xs text-muted-foreground">Show estimated cost in UI</p>
              </div>
              <Switch
                checked={polymorphicConfig.enableCostDisplay}
                onCheckedChange={(checked) => setPolymorphicConfig(prev => ({ ...prev, enableCostDisplay: checked }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Escalation</Label>
                <p className="text-xs text-muted-foreground">Allow Sniper → War Room escalation</p>
              </div>
              <Switch
                checked={polymorphicConfig.enableEscalation}
                onCheckedChange={(checked) => setPolymorphicConfig(prev => ({ ...prev, enableEscalation: checked }))}
              />
            </div>
          </div>
          
          <Separator />
          
          {/* Default Mode */}
          <div className="space-y-4">
            <Label>Default Execution Mode</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPolymorphicConfig(prev => ({ ...prev, defaultMode: 'sniper' }))}
                className={`p-4 border rounded-lg text-left transition-all ${
                  polymorphicConfig.defaultMode === 'sniper' 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Sniper Mode</span>
                </div>
                <p className="text-xs text-muted-foreground">Fast, single model, low cost (~1¢)</p>
              </button>
              <button
                onClick={() => setPolymorphicConfig(prev => ({ ...prev, defaultMode: 'war_room' }))}
                className={`p-4 border rounded-lg text-left transition-all ${
                  polymorphicConfig.defaultMode === 'war_room' 
                    ? 'border-violet-500 bg-violet-500/10' 
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-violet-500" />
                  <span className="font-medium">War Room Mode</span>
                </div>
                <p className="text-xs text-muted-foreground">Multi-model consensus, deep (~50¢)</p>
              </button>
            </div>
          </div>
          
          <Separator />
          
          {/* Thresholds */}
          <div className="space-y-4">
            <Label>Complexity Thresholds</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sniper Threshold</span>
                  <span className="text-muted-foreground">{polymorphicConfig.sniperThreshold}</span>
                </div>
                <Slider
                  value={[polymorphicConfig.sniperThreshold]}
                  onValueChange={([value]) => setPolymorphicConfig(prev => ({ ...prev, sniperThreshold: value }))}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">Below this → Sniper mode</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>War Room Threshold</span>
                  <span className="text-muted-foreground">{polymorphicConfig.warRoomThreshold}</span>
                </div>
                <Slider
                  value={[polymorphicConfig.warRoomThreshold]}
                  onValueChange={([value]) => setPolymorphicConfig(prev => ({ ...prev, warRoomThreshold: value }))}
                  max={1}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">Above this → War Room mode</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Domain Routing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Domain-Based Routing</CardTitle>
          <CardDescription>Override execution mode for specific domains</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(polymorphicConfig.domainRouting).map(([domain, mode]) => (
              <div key={domain} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="capitalize font-medium">{domain}</span>
                <Select
                  value={mode}
                  onValueChange={(value: ExecutionMode) => 
                    setPolymorphicConfig(prev => ({
                      ...prev,
                      domainRouting: { ...prev.domainRouting, [domain]: value }
                    }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sniper">
                      <span className="flex items-center gap-2">
                        <Zap className="h-3 w-3 text-green-500" />
                        Sniper
                      </span>
                    </SelectItem>
                    <SelectItem value="war_room">
                      <span className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-violet-500" />
                        War Room
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Governor View
  // ============================================================================
  const renderGovernorView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Economic Governor</CardTitle>
              <CardDescription>Route requests to cost-effective models based on complexity</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Gauge className="h-3 w-3" />
              System 0
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(GOVERNOR_MODES) as GovernorMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setGovernorConfig(prev => ({ ...prev, mode }))}
                className={`p-4 border rounded-lg text-center transition-all ${
                  governorConfig.mode === mode 
                    ? 'border-primary bg-primary/10' 
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <div className="text-2xl mb-2">{GOVERNOR_MODES[mode].icon}</div>
                <div className="font-medium text-sm">{GOVERNOR_MODES[mode].label}</div>
                <p className="text-xs text-muted-foreground mt-1">{GOVERNOR_MODES[mode].description}</p>
              </button>
            ))}
          </div>
          
          <Separator />
          
          {/* Model Configuration */}
          <div className="space-y-4">
            <Label>Model Configuration</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Classifier Model</Label>
                <Select
                  value={governorConfig.classifierModel}
                  onValueChange={(value) => setGovernorConfig(prev => ({ ...prev, classifierModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelPricing.map(m => (
                      <SelectItem key={m.modelId} value={m.modelId}>{m.modelName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Determines complexity</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Cheap Model</Label>
                <Select
                  value={governorConfig.cheapModel}
                  onValueChange={(value) => setGovernorConfig(prev => ({ ...prev, cheapModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelPricing.map(m => (
                      <SelectItem key={m.modelId} value={m.modelId}>{m.modelName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">For simple tasks</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Premium Model</Label>
                <Select
                  value={governorConfig.premiumModel}
                  onValueChange={(value) => setGovernorConfig(prev => ({ ...prev, premiumModel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelPricing.map(m => (
                      <SelectItem key={m.modelId} value={m.modelId}>{m.modelName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">For complex tasks</p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Thresholds */}
          <div className="space-y-4">
            <Label>Routing Thresholds</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Cheap Threshold</span>
                  <span>{governorConfig.cheapThreshold}</span>
                </div>
                <Slider
                  value={[governorConfig.cheapThreshold]}
                  onValueChange={([value]) => setGovernorConfig(prev => ({ ...prev, cheapThreshold: value }))}
                  max={1}
                  step={0.1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Premium Threshold</span>
                  <span>{governorConfig.premiumThreshold}</span>
                </div>
                <Slider
                  value={[governorConfig.premiumThreshold]}
                  onValueChange={([value]) => setGovernorConfig(prev => ({ ...prev, premiumThreshold: value }))}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Governor Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{MOCK_GOVERNOR_STATS.totalRequests.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Requests</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-600">${MOCK_GOVERNOR_STATS.costSavings.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Cost Savings</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{MOCK_GOVERNOR_STATS.avgComplexity.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Avg Complexity</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{MOCK_GOVERNOR_STATS.avgLatencyMs}ms</div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Ego View
  // ============================================================================
  const renderEgoView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Zero-Cost Ego System</CardTitle>
              <CardDescription>Persistent AI identity at $0/month via database injection</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={egoConfig.enabled ? 'default' : 'secondary'}>
                {egoConfig.enabled ? 'Active' : 'Disabled'}
              </Badge>
              <Switch
                checked={egoConfig.enabled}
                onCheckedChange={(checked) => setEgoConfig(prev => ({ ...prev, enabled: checked }))}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Identity */}
          <div className="space-y-4">
            <Label className="text-lg">Identity</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={egoConfig.identity.name}
                  onChange={(e) => setEgoConfig(prev => ({
                    ...prev,
                    identity: { ...prev.identity, name: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Values</Label>
                <Input
                  value={egoConfig.identity.values.join(', ')}
                  onChange={(e) => setEgoConfig(prev => ({
                    ...prev,
                    identity: { ...prev.identity, values: e.target.value.split(', ') }
                  }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Narrative</Label>
              <Textarea
                value={egoConfig.identity.narrative}
                onChange={(e) => setEgoConfig(prev => ({
                  ...prev,
                  identity: { ...prev.identity, narrative: e.target.value }
                }))}
                rows={3}
              />
            </div>
          </div>
          
          <Separator />
          
          {/* Personality Traits */}
          <div className="space-y-4">
            <Label className="text-lg">Personality Traits (Big Five)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(egoConfig.identity.traits).map(([trait, value]) => (
                <div key={trait} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{trait}</span>
                    <span>{value.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={([v]) => setEgoConfig(prev => ({
                      ...prev,
                      identity: {
                        ...prev.identity,
                        traits: { ...prev.identity.traits, [trait]: v }
                      }
                    }))}
                    min={-1}
                    max={1}
                    step={0.1}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          {/* Current Affect */}
          <div className="space-y-4">
            <Label className="text-lg">Current Emotional State</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(egoConfig.affect).map(([key, value]) => (
                <div key={key} className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-bold">{(value * 100).toFixed(0)}%</div>
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          {/* Injection Settings */}
          <div className="space-y-4">
            <Label className="text-lg">Injection Settings</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Inject Identity</Label>
                <Switch
                  checked={egoConfig.injectIdentity}
                  onCheckedChange={(checked) => setEgoConfig(prev => ({ ...prev, injectIdentity: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Inject Affect</Label>
                <Switch
                  checked={egoConfig.injectAffect}
                  onCheckedChange={(checked) => setEgoConfig(prev => ({ ...prev, injectAffect: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Inject Memory</Label>
                <Switch
                  checked={egoConfig.injectMemory}
                  onCheckedChange={(checked) => setEgoConfig(prev => ({ ...prev, injectMemory: checked }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Delight View
  // ============================================================================
  const renderDelightView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Delight Triggers</CardTitle>
          <CardDescription>Moments of joy and surprise for users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {delightTriggers.map((trigger, i) => (
              <div key={trigger.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{trigger.name}</span>
                    <Badge variant="outline" className="text-xs">{trigger.frequency}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{trigger.action}</p>
                </div>
                <Switch
                  checked={trigger.enabled}
                  onCheckedChange={(checked) => {
                    const updated = [...delightTriggers];
                    updated[i] = { ...trigger, enabled: checked };
                    setDelightTriggers(updated);
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delight Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{MOCK_DELIGHT_STATS.triggersActivated.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Triggers Activated</div>
            </div>
            <div className="text-center p-4 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{MOCK_DELIGHT_STATS.userSatisfaction}/5</div>
              <div className="text-xs text-muted-foreground">User Satisfaction</div>
            </div>
            <div className="text-center p-4 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">+{(MOCK_DELIGHT_STATS.engagementLift * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Engagement Lift</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Rules View
  // ============================================================================
  const renderRulesView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Rules</CardTitle>
              <CardDescription>Custom rules applied to AI responses</CardDescription>
            </div>
            <Button size="sm">
              <Shield className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userRules.map((rule, i) => (
              <div key={rule.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant="outline">Priority {rule.priority}</Badge>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => {
                      const updated = [...userRules];
                      updated[i] = { ...rule, enabled: checked };
                      setUserRules(updated);
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{rule.description}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <code className="bg-muted px-1 rounded">{rule.condition}</code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Domains View
  // ============================================================================
  const renderDomainsView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Domain Configuration</CardTitle>
          <CardDescription>Specialized handling for different content domains</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {domains.map((domain, i) => (
              <div key={domain.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">{domain.name}</span>
                    <Badge variant={domain.executionMode === 'war_room' ? 'default' : 'secondary'}>
                      {domain.executionMode === 'war_room' ? 'War Room' : 'Sniper'}
                    </Badge>
                  </div>
                  <Switch
                    checked={domain.enabled}
                    onCheckedChange={(checked) => {
                      const updated = [...domains];
                      updated[i] = { ...domain, enabled: checked };
                      setDomains(updated);
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{domain.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Required Confidence:</span>
                  <Badge variant="outline">{(domain.requiredConfidence * 100).toFixed(0)}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Costs View
  // ============================================================================
  const renderCostsView = () => (
    <div className="space-y-6">
      {/* Budget Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Budget</CardTitle>
          <CardDescription>Monitor and control AI spending</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Daily Spend</span>
                <span>${MOCK_COST_BUDGET.currentDaily.toFixed(2)} / ${MOCK_COST_BUDGET.dailyLimit}</span>
              </div>
              <Progress value={(MOCK_COST_BUDGET.currentDaily / MOCK_COST_BUDGET.dailyLimit) * 100} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Monthly Spend</span>
                <span>${MOCK_COST_BUDGET.currentMonthly.toFixed(2)} / ${MOCK_COST_BUDGET.monthlyLimit}</span>
              </div>
              <Progress value={(MOCK_COST_BUDGET.currentMonthly / MOCK_COST_BUDGET.monthlyLimit) * 100} />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Model Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Model Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {modelPricing.map((model, i) => (
              <div key={model.modelId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={model.isEnabled}
                    onCheckedChange={(checked) => {
                      const updated = [...modelPricing];
                      updated[i] = { ...model, isEnabled: checked };
                      setModelPricing(updated);
                    }}
                  />
                  <div>
                    <div className="font-medium">{model.modelName}</div>
                    <div className="text-xs text-muted-foreground">{model.provider}</div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>${model.inputCostPer1k}/1k in | ${model.outputCostPer1k}/1k out</div>
                  <div className="text-xs text-muted-foreground">{model.avgLatencyMs}ms avg</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Users View
  // ============================================================================
  const renderUsersView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{MOCK_USER_STATS.totalUsers.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Today</CardDescription>
            <CardTitle className="text-3xl">{MOCK_USER_STATS.activeToday}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active This Week</CardDescription>
            <CardTitle className="text-3xl">{MOCK_USER_STATS.activeWeek}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Session</CardDescription>
            <CardTitle className="text-3xl">{MOCK_USER_STATS.avgSessionMinutes}m</CardTitle>
          </CardHeader>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_USER_STATS.topModels.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{item.model}</span>
                  <Badge variant="outline">{item.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_USER_STATS.topFeatures.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{item.feature}</span>
                  <Badge variant="outline">{item.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================================================
  // Analytics View
  // ============================================================================
  const renderAnalyticsView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
          <CardDescription>Comprehensive platform metrics</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Analytics charts would render here</p>
            <p className="text-sm">Connected to real metrics in production</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Render Content
  // ============================================================================
  const renderContent = () => {
    switch (currentView) {
      case 'overview': return renderOverview();
      case 'polymorphic': return renderPolymorphicView();
      case 'governor': return renderGovernorView();
      case 'ego': return renderEgoView();
      case 'delight': return renderDelightView();
      case 'rules': return renderRulesView();
      case 'domains': return renderDomainsView();
      case 'costs': return renderCostsView();
      case 'users': return renderUsersView();
      case 'analytics': return renderAnalyticsView();
      default: return null;
    }
  };

  // ============================================================================
  // Main Layout
  // ============================================================================
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 p-4 space-y-2 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Admin Simulator</h2>
          <p className="text-xs text-muted-foreground">Think Tank Configuration</p>
        </div>
        
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
              currentView === item.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
            {item.badge && (
              <Badge variant="secondary" className="text-xs">
                {item.badge}
              </Badge>
            )}
          </button>
        ))}
        
        <Separator className="my-4" />
        
        {/* Simulation Controls */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Simulation</Label>
          <Button 
            variant={isSimulating ? 'destructive' : 'default'} 
            className="w-full"
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? (
              <><Pause className="h-4 w-4 mr-2" /> Stop</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Start</>
            )}
          </Button>
          <Button variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset All
          </Button>
          <Button variant="outline" className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Export Config
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
}
