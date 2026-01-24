'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Server,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
  Settings,
  Shield,
  Zap,
  Database,
  Cloud
} from 'lucide-react';
import { LatencyHeatmap, type RegionLatency } from '@/components/geographic/latency-heatmap';

// ============================================================================
// Types
// ============================================================================

interface TierState {
  currentTier: string;
  targetTier: string | null;
  transitionStatus: string;
  lastChangedAt: string;
  lastChangedBy: string;
  cooldownHours: number;
  nextChangeAllowedAt: string;
  cooldownActive: boolean;
  estimatedMonthlyCost: number;
  actualMtdCost: number;
}

interface TierConfig {
  tierName: string;
  displayName: string;
  description: string;
  estimatedMonthlyCost: number;
  features: string[];
  limitations: string[];
  sagemakerShadowSelfInstanceType: string;
  sagemakerShadowSelfMinInstances: number;
  sagemakerShadowSelfMaxInstances: number;
  sagemakerShadowSelfScaleToZero: boolean;
  bedrockDefaultModel: string;
  opensearchType: string;
  opensearchInstanceType: string | null;
  elasticacheType: string;
  neptuneType: string;
  budgetMonthlyCuriosityLimit: number;
  budgetDailyExplorationCap: number;
}

interface TierComparison {
  tier: string;
  displayName: string;
  description: string;
  estimatedMonthlyCost: number;
  costBreakdown: Record<string, number>;
  features: string[];
  limitations: string[];
}

// ============================================================================
// Component
// ============================================================================

export default function InfrastructureTierPage() {
  const [tierState, setTierState] = useState<TierState | null>(null);
  const [tiers, setTiers] = useState<TierComparison[]>([]);
  const [tierConfigs, setTierConfigs] = useState<TierConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  
  // Dialogs
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showProductionWarning, setShowProductionWarning] = useState(false);
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  
  // Config editing
  const [editingConfig, setEditingConfig] = useState<TierConfig | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [regionLatencies, setRegionLatencies] = useState<RegionLatency[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isTransitioning) {
      const poll = async () => {
        try {
          const res = await fetch('/api/admin/infrastructure/tier/transition-status');
          if (res.ok) {
            const status = await res.json();
            if (status.status === 'STABLE') {
              setIsTransitioning(false);
              setTransitionProgress(100);
              fetchData();
            }
          }
        } catch {
          // Continue polling
        }
      };
      
      const interval = setInterval(() => {
        setTransitionProgress(prev => Math.min(prev + 5, 95));
        poll();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isTransitioning]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tierRes, compareRes, configsRes, latencyRes] = await Promise.all([
        fetch('/api/admin/infrastructure/tier'),
        fetch('/api/admin/infrastructure/tier/compare'),
        fetch('/api/admin/infrastructure/tier/configs'),
        fetch('/api/admin/infrastructure/regions/latency')
      ]);

      if (tierRes.ok) {
        setTierState(await tierRes.json());
      }
      if (compareRes.ok) {
        const data = await compareRes.json();
        setTiers(data.tiers);
      }
      if (configsRes.ok) {
        const data = await configsRes.json();
        setTierConfigs(data.configs);
      }
      if (latencyRes.ok) {
        const data = await latencyRes.json();
        setRegionLatencies(data.regions || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pollTransitionStatus = async () => {
    try {
      const res = await fetch('/api/admin/infrastructure/tier/transition-status');
      if (res.ok) {
        const status = await res.json();
        if (status.status === 'STABLE') {
          setIsTransitioning(false);
          setTransitionProgress(100);
          fetchData();
        }
      }
    } catch {
      // Continue polling
    }
  };

  const handleTierSelect = async (targetTier: string) => {
    if (!changeReason || changeReason.length < 10) {
      alert('Please provide a reason for the tier change (minimum 10 characters)');
      return;
    }

    setPendingTier(targetTier);

    try {
      const res = await fetch('/api/admin/infrastructure/tier/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier,
          reason: changeReason
        })
      });

      const result = await res.json();

      if (result.status === 'REQUIRES_CONFIRMATION') {
        setConfirmationToken(result.confirmationToken);
        setWarnings(result.warnings || []);
        if (targetTier === 'PRODUCTION') {
          setShowProductionWarning(true);
        } else {
          setShowConfirmDialog(true);
        }
      } else if (result.status === 'INITIATED') {
        setIsTransitioning(true);
        setTransitionProgress(0);
      } else if (result.status === 'REJECTED') {
        alert(result.errors?.join(', ') || 'Request rejected');
      }
    } catch (error) {
      alert('Failed to request tier change');
    }
  };

  const handleConfirmChange = async () => {
    if (!confirmationToken) return;

    try {
      const res = await fetch('/api/admin/infrastructure/tier/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationToken })
      });

      const result = await res.json();

      if (result.status === 'INITIATED') {
        setShowConfirmDialog(false);
        setShowProductionWarning(false);
        setIsTransitioning(true);
        setTransitionProgress(0);
        setChangeReason('');
      } else {
        alert(result.errors?.join(', ') || 'Confirmation failed');
      }
    } catch (error) {
      alert('Failed to confirm tier change');
    }
  };

  const handleConfigSave = async () => {
    if (!editingConfig) return;

    try {
      const res = await fetch(`/api/admin/infrastructure/tier/configs/${editingConfig.tierName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig)
      });

      if (res.ok) {
        setShowConfigEditor(false);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      alert('Failed to save configuration');
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'DEV': return <Settings className="w-6 h-6 text-blue-500" />;
      case 'STAGING': return <Zap className="w-6 h-6 text-yellow-500" />;
      case 'PRODUCTION': return <Shield className="w-6 h-6 text-green-500" />;
      default: return <Server className="w-6 h-6" />;
    }
  };

  const formatCost = (cost: number) => {
    if (cost >= 1000000) {
      return `$${(cost / 1000000).toFixed(1)}M`;
    } else if (cost >= 1000) {
      return `$${(cost / 1000).toFixed(0)}K`;
    }
    return `$${cost.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Server className="w-8 h-8" />
            Infrastructure Tier
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Cato infrastructure scaling and costs
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Current Status Banner */}
      <Card className={`${
        tierState?.currentTier === 'PRODUCTION' ? 'bg-green-50 border-green-200' :
        tierState?.currentTier === 'STAGING' ? 'bg-yellow-50 border-yellow-200' :
        'bg-blue-50 border-blue-200'
      }`}>
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {getTierIcon(tierState?.currentTier || 'DEV')}
              <div>
                <p className="text-sm text-gray-600">Current Tier</p>
                <p className="text-2xl font-bold">{tierState?.currentTier}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Estimated Monthly Cost</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCost(tierState?.estimatedMonthlyCost || 0)}/mo
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Actual MTD Spend</p>
              <p className="text-2xl font-bold">
                {formatCost(tierState?.actualMtdCost || 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Status</p>
              <Badge className={`text-lg ${
                tierState?.transitionStatus === 'STABLE' ? 'bg-green-500' :
                tierState?.transitionStatus === 'FAILED' ? 'bg-red-500' :
                'bg-yellow-500'
              }`}>
                {tierState?.transitionStatus}
              </Badge>
            </div>
          </div>
          
          {tierState?.cooldownActive && (
            <div className="mt-4 flex items-center gap-2 text-orange-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Cooldown active. Next change allowed: {new Date(tierState.nextChangeAllowedAt).toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Latency Heatmap */}
      <LatencyHeatmap
        regions={regionLatencies}
        title="Global Infrastructure Latency"
        onRegionClick={(region) => console.log('View region:', region)}
      />

      {/* Transition Progress */}
      {isTransitioning && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-600" />
              <div className="flex-1">
                <p className="font-medium">Transitioning to {pendingTier}...</p>
                <Progress value={transitionProgress} className="mt-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  This may take 5-15 minutes. Do not close this page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tiers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tiers">Select Tier</TabsTrigger>
          <TabsTrigger value="config">Configure Tiers</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-4">
          {/* Change Reason Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Change Reason</CardTitle>
              <CardDescription>
                Provide a reason for the tier change (required for all changes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Why are you changing the infrastructure tier? (minimum 10 characters)"
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          {/* Tier Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <Card 
                key={tier.tier}
                className={`relative ${
                  tier.tier === tierState?.currentTier 
                    ? 'border-2 border-blue-500 shadow-lg' 
                    : ''
                }`}
              >
                {tier.tier === tierState?.currentTier && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-blue-500">Current</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {getTierIcon(tier.tier)}
                    <div>
                      <CardTitle>{tier.displayName}</CardTitle>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCost(tier.estimatedMonthlyCost)}/mo
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tier.description}
                  </p>

                  <div className="mb-4">
                    <p className="font-medium text-sm mb-2">Features:</p>
                    <ul className="text-sm space-y-1">
                      {tier.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-green-700">
                          <CheckCircle2 className="w-3 h-3" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {tier.limitations.length > 0 && (
                    <div className="mb-4">
                      <p className="font-medium text-sm mb-2">Limitations:</p>
                      <ul className="text-sm space-y-1">
                        {tier.limitations.map((l, i) => (
                          <li key={i} className="flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="w-3 h-3" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cost Breakdown */}
                  <div className="mb-4">
                    <p className="font-medium text-sm mb-2">Cost Breakdown:</p>
                    <div className="text-xs space-y-1">
                      {Object.entries(tier.costBreakdown).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{key}</span>
                          <span>{formatCost(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {tier.tier !== tierState?.currentTier && (
                    <Button
                      className="w-full"
                      variant={tier.tier === 'PRODUCTION' ? 'destructive' : 'default'}
                      onClick={() => handleTierSelect(tier.tier)}
                      disabled={isTransitioning || tierState?.cooldownActive}
                    >
                      {tier.tier === 'PRODUCTION' ? (
                        <>
                          <ArrowUp className="w-4 h-4 mr-2" />
                          Switch to Production ⚠️
                        </>
                      ) : tiers.findIndex(t => t.tier === tier.tier) < tiers.findIndex(t => t.tier === tierState?.currentTier) ? (
                        <>
                          <ArrowDown className="w-4 h-4 mr-2" />
                          Scale Down to {tier.displayName}
                        </>
                      ) : (
                        <>
                          <ArrowUp className="w-4 h-4 mr-2" />
                          Scale Up to {tier.displayName}
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4">
            {tierConfigs.map((config) => (
              <Card key={config.tierName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getTierIcon(config.tierName)}
                      <div>
                        <CardTitle>{config.displayName}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingConfig(config);
                        setShowConfigEditor(true);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Configuration
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">SageMaker Instances</p>
                      <p className="font-medium">
                        {config.sagemakerShadowSelfMinInstances} - {config.sagemakerShadowSelfMaxInstances}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Instance Type</p>
                      <p className="font-medium">{config.sagemakerShadowSelfInstanceType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Scale to Zero</p>
                      <p className="font-medium">{config.sagemakerShadowSelfScaleToZero ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Curiosity Budget</p>
                      <p className="font-medium">${config.budgetMonthlyCuriosityLimit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Change History</CardTitle>
              <CardDescription>Recent infrastructure tier changes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">No changes recorded yet.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Scale Down Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Confirm Tier Change
            </AlertDialogTitle>
            <AlertDialogDescription>
              {warnings.map((w, i) => (
                <p key={i} className="mb-2">{w}</p>
              ))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>
              Yes, Change Tier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Production Warning Dialog */}
      <AlertDialog open={showProductionWarning} onOpenChange={setShowProductionWarning}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              ⚠️ PRODUCTION TIER WARNING
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-bold text-red-800 text-lg">
                  You are about to switch to PRODUCTION tier.
                </p>
                <p className="text-red-700 mt-2">
                  This will cost approximately <strong>$700,000 - $800,000 per month</strong>.
                </p>
              </div>
              <p className="text-gray-700">
                This action will provision significant AWS resources including:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                <li>50-300 SageMaker ml.g5.2xlarge instances</li>
                <li>Multi-region DynamoDB Global Tables</li>
                <li>OpenSearch Serverless with 50-500 OCUs</li>
                <li>Provisioned Bedrock throughput</li>
              </ul>
              <p className="font-medium text-gray-700">
                Are you absolutely sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmChange}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Switch to PRODUCTION
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Config Editor Dialog */}
      <Dialog open={showConfigEditor} onOpenChange={setShowConfigEditor}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editingConfig?.displayName} Configuration</DialogTitle>
            <DialogDescription>
              Customize the resource configuration for this tier
            </DialogDescription>
          </DialogHeader>
          
          {editingConfig && (
            <div className="space-y-6 py-4">
              {/* SageMaker */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  SageMaker Configuration
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Instance Type</Label>
                    <Input
                      value={editingConfig.sagemakerShadowSelfInstanceType}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        sagemakerShadowSelfInstanceType: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label>Min Instances</Label>
                    <Input
                      type="number"
                      value={editingConfig.sagemakerShadowSelfMinInstances}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        sagemakerShadowSelfMinInstances: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Max Instances</Label>
                    <Input
                      type="number"
                      value={editingConfig.sagemakerShadowSelfMaxInstances}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        sagemakerShadowSelfMaxInstances: parseInt(e.target.value) || 1
                      })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingConfig.sagemakerShadowSelfScaleToZero}
                      onCheckedChange={(checked) => setEditingConfig({
                        ...editingConfig,
                        sagemakerShadowSelfScaleToZero: checked
                      })}
                    />
                    <Label>Scale to Zero</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Budget */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Budget Configuration
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly Curiosity Limit ($)</Label>
                    <Input
                      type="number"
                      value={editingConfig.budgetMonthlyCuriosityLimit}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        budgetMonthlyCuriosityLimit: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label>Daily Exploration Cap ($)</Label>
                    <Input
                      type="number"
                      value={editingConfig.budgetDailyExplorationCap}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        budgetDailyExplorationCap: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Cost Estimate */}
              <div>
                <h4 className="font-medium mb-3">Estimated Monthly Cost</h4>
                <Input
                  type="number"
                  value={editingConfig.estimatedMonthlyCost}
                  onChange={(e) => setEditingConfig({
                    ...editingConfig,
                    estimatedMonthlyCost: parseFloat(e.target.value) || 0
                  })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  This is shown to admins when comparing tiers
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigEditor(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfigSave}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
