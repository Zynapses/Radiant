'use client';

/**
 * RADIANT v5.52.40 - Ghost Inference Configuration Page
 * 
 * Admin UI for configuring vLLM settings for ghost vector extraction.
 * Follows UI/UX patterns from docs/UI-UX-PATTERNS.md
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Server,
  Cpu,
  MemoryStick,
  Zap,
  Settings,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  Activity,
  Brain,
  Layers,
  Gauge,
  HardDrive,
  Info,
  Rocket,
  History,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GhostInferenceConfig {
  id: string;
  tenantId: string;
  modelName: string;
  modelVersion: string | null;
  tensorParallelSize: number;
  maxModelLen: number;
  dtype: 'float16' | 'bfloat16' | 'float32';
  gpuMemoryUtilization: number;
  returnHiddenStates: boolean;
  hiddenStateLayer: number;
  ghostVectorDimension: number;
  maxNumSeqs: number;
  maxNumBatchedTokens: number | null;
  swapSpaceGb: number;
  enforceEager: boolean;
  quantization: string | null;
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  scaleToZero: boolean;
  warmupInstances: number;
  maxConcurrentInvocations: number;
  startupHealthCheckTimeoutSeconds: number;
  endpointNamePrefix: string;
  status: 'active' | 'warming' | 'scaling' | 'error' | 'disabled';
  lastDeploymentAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InstanceType {
  instanceType: string;
  gpuCount: number;
  gpuType: string;
  gpuMemoryGb: number;
  vcpuCount: number;
  memoryGb: number;
  hourlyCostUsd: number;
  maxTensorParallel: number;
  recommendedFor: string[];
}

interface Deployment {
  id: string;
  endpointName: string;
  status: 'pending' | 'deploying' | 'active' | 'failed' | 'terminated';
  startedAt: string;
  completedAt: string | null;
  startupDurationSeconds: number | null;
  totalInvocations: number;
  totalErrors: number;
  avgLatencyMs: number | null;
  estimatedHourlyCost: number | null;
  actualCostUsd: number;
  errorMessage: string | null;
}

interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  tokensProcessed: number;
  hiddenStatesExtracted: number;
  costUsd: number;
}

interface Dashboard {
  config: GhostInferenceConfig | null;
  activeDeployment: Deployment | null;
  metrics24h: Metrics;
  instanceTypes: InstanceType[];
}

// ============================================================================
// Component
// ============================================================================

export default function GhostInferencePage() {
  const { toast } = useToast();
  
  // State
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  
  // Editing state
  const [editedConfig, setEditedConfig] = useState<Partial<GhostInferenceConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Dialogs
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    estimatedHourlyCost: number | null;
    estimatedMonthlyCost: number | null;
  } | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/ghost-inference/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        if (data.config) {
          setEditedConfig({});
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load ghost inference configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchDeployments = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ghost-inference/deployments?limit=10');
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      }
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchDeployments();
  }, [fetchDashboard, fetchDeployments]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCreateConfig = async () => {
    try {
      const res = await fetch('/api/admin/ghost-inference/config', {
        method: 'POST',
      });
      if (res.ok) {
        toast({
          title: 'Configuration Created',
          description: 'Default ghost inference configuration has been created.',
        });
        fetchDashboard();
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create configuration.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create configuration.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateConfig = (field: string, value: unknown) => {
    setEditedConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    if (!hasChanges || Object.keys(editedConfig).length === 0) return;
    
    setIsSaving(true);
    try {
      // Validate first
      const validateRes = await fetch('/api/admin/ghost-inference/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedConfig),
      });
      
      if (validateRes.ok) {
        const validation = await validateRes.json();
        if (!validation.valid) {
          toast({
            title: 'Validation Failed',
            description: validation.errors.join(', '),
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }
      }
      
      // Save
      const res = await fetch('/api/admin/ghost-inference/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedConfig),
      });
      
      if (res.ok) {
        toast({
          title: 'Configuration Saved',
          description: 'Ghost inference configuration has been updated.',
        });
        setEditedConfig({});
        setHasChanges(false);
        fetchDashboard();
      } else {
        const error = await res.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to save configuration.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await fetch('/api/admin/ghost-inference/deploy', {
        method: 'POST',
      });
      
      if (res.ok) {
        const deployment = await res.json();
        toast({
          title: 'Deployment Initiated',
          description: `Endpoint ${deployment.endpointName} is being deployed.`,
        });
        setShowDeployDialog(false);
        fetchDashboard();
        fetchDeployments();
      } else {
        const error = await res.json();
        toast({
          title: 'Deployment Failed',
          description: error.error || 'Failed to initiate deployment.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initiate deployment.',
        variant: 'destructive',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleValidate = async () => {
    const configToValidate = { ...dashboard?.config, ...editedConfig };
    try {
      const res = await fetch('/api/admin/ghost-inference/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToValidate),
      });
      
      if (res.ok) {
        const result = await res.json();
        setValidationResult(result);
        setShowDeployDialog(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to validate configuration.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setEditedConfig({});
    setHasChanges(false);
    setShowResetDialog(false);
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const getConfigValue = <T,>(field: keyof GhostInferenceConfig): T => {
    if (field in editedConfig) {
      return editedConfig[field] as T;
    }
    return dashboard?.config?.[field] as T;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      active: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
      warming: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      scaling: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: <Activity className="h-3 w-3" /> },
      error: { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: <XCircle className="h-3 w-3" /> },
      disabled: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: <Clock className="h-3 w-3" /> },
      pending: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: <Clock className="h-3 w-3" /> },
      deploying: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      failed: { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: <XCircle className="h-3 w-3" /> },
      terminated: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: <XCircle className="h-3 w-3" /> },
    };
    
    const config = statusConfig[status] || statusConfig.disabled;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCost = (cost: number) => `$${cost.toFixed(2)}`;
  const formatNumber = (num: number) => num.toLocaleString();

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No configuration yet
  if (!dashboard?.config) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ghost Inference</h1>
          <p className="text-muted-foreground">
            Configure vLLM settings for ghost vector extraction
          </p>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Brain className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Configuration Found</h2>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Ghost inference is not configured for this tenant. Create a configuration
              to enable self-hosted LLaMA inference with ghost vector extraction.
            </p>
            <Button onClick={handleCreateConfig}>
              <Settings className="h-4 w-4 mr-2" />
              Create Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = dashboard.config;
  const metrics = dashboard.metrics24h;
  const instanceTypes = dashboard.instanceTypes;
  const activeDeployment = dashboard.activeDeployment;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ghost Inference</h1>
          <p className="text-muted-foreground">
            Configure vLLM settings for ghost vector extraction
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <Button variant="outline" onClick={() => setShowResetDialog(true)}>
                Discard Changes
              </Button>
              <Button onClick={handleSaveConfig} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </>
          )}
          <Button onClick={handleValidate} variant={hasChanges ? 'outline' : 'default'}>
            <Rocket className="h-4 w-4 mr-2" />
            Deploy
          </Button>
          <Button variant="outline" size="icon" onClick={fetchDashboard}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {getStatusBadge(config.status)}
              {config.lastDeploymentAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(config.lastDeploymentAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Requests (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.totalRequests)}</div>
            <div className="text-xs text-muted-foreground">
              {metrics.successfulRequests} successful, {metrics.failedRequests} failed
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Latency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.avgLatencyMs ? `${metrics.avgLatencyMs.toFixed(0)}ms` : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">
              P95: {metrics.p95LatencyMs ? `${metrics.p95LatencyMs.toFixed(0)}ms` : 'N/A'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(metrics.costUsd)}</div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(metrics.hiddenStatesExtracted)} ghost vectors
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="model" className="space-y-4">
        <TabsList>
          <TabsTrigger value="model">
            <Brain className="h-4 w-4 mr-2" />
            Model
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Gauge className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="infrastructure">
            <Server className="h-4 w-4 mr-2" />
            Infrastructure
          </TabsTrigger>
          <TabsTrigger value="deployments">
            <History className="h-4 w-4 mr-2" />
            Deployments
          </TabsTrigger>
        </TabsList>

        {/* Model Tab */}
        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>
                Configure the LLaMA model for ghost vector extraction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="modelName">Model Name</Label>
                  <Input
                    id="modelName"
                    value={getConfigValue<string>('modelName')}
                    onChange={(e) => handleUpdateConfig('modelName', e.target.value)}
                    placeholder="meta-llama/Llama-3-70B-Instruct"
                  />
                  <p className="text-xs text-muted-foreground">
                    HuggingFace model identifier
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="modelVersion">Model Version</Label>
                  <Input
                    id="modelVersion"
                    value={getConfigValue<string>('modelVersion') || ''}
                    onChange={(e) => handleUpdateConfig('modelVersion', e.target.value || null)}
                    placeholder="latest"
                  />
                  <p className="text-xs text-muted-foreground">
                    Git revision or tag (optional)
                  </p>
                </div>
              </div>

              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium">Ghost Vector Settings</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Return Hidden States</Label>
                    <p className="text-xs text-muted-foreground">
                      Extract hidden states for ghost vectors
                    </p>
                  </div>
                  <Switch
                    checked={getConfigValue<boolean>('returnHiddenStates')}
                    onCheckedChange={(checked) => handleUpdateConfig('returnHiddenStates', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Hidden State Layer: {getConfigValue<number>('hiddenStateLayer')}</Label>
                    <Slider
                      value={[getConfigValue<number>('hiddenStateLayer')]}
                      onValueChange={([value]) => handleUpdateConfig('hiddenStateLayer', value)}
                      min={-80}
                      max={0}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      -1 = last layer, -2 = second to last, etc.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ghostVectorDimension">Ghost Vector Dimension</Label>
                    <Input
                      id="ghostVectorDimension"
                      type="number"
                      value={getConfigValue<number>('ghostVectorDimension')}
                      onChange={(e) => handleUpdateConfig('ghostVectorDimension', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium">Data Type & Quantization</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Data Type</Label>
                    <Select
                      value={getConfigValue<string>('dtype')}
                      onValueChange={(value) => handleUpdateConfig('dtype', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="float16">Float16 (Recommended)</SelectItem>
                        <SelectItem value="bfloat16">BFloat16</SelectItem>
                        <SelectItem value="float32">Float32 (High Memory)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Quantization</Label>
                    <Select
                      value={getConfigValue<string>('quantization') || 'none'}
                      onValueChange={(value) => handleUpdateConfig('quantization', value === 'none' ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Full Precision)</SelectItem>
                        <SelectItem value="awq">AWQ</SelectItem>
                        <SelectItem value="gptq">GPTQ</SelectItem>
                        <SelectItem value="squeezellm">SqueezeLLM</SelectItem>
                        <SelectItem value="fp8">FP8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Tuning</CardTitle>
              <CardDescription>
                Configure vLLM performance parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Tensor Parallel Size</Label>
                  <Select
                    value={getConfigValue<number>('tensorParallelSize').toString()}
                    onValueChange={(value) => handleUpdateConfig('tensorParallelSize', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 GPU</SelectItem>
                      <SelectItem value="2">2 GPUs</SelectItem>
                      <SelectItem value="4">4 GPUs</SelectItem>
                      <SelectItem value="8">8 GPUs</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Must match instance GPU count
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxModelLen">Max Context Length</Label>
                  <Input
                    id="maxModelLen"
                    type="number"
                    value={getConfigValue<number>('maxModelLen')}
                    onChange={(e) => handleUpdateConfig('maxModelLen', parseInt(e.target.value))}
                    min={1024}
                    max={131072}
                  />
                  <p className="text-xs text-muted-foreground">
                    1024 - 131072 tokens
                  </p>
                </div>
              </div>

              <Separator />
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>GPU Memory Utilization: {(getConfigValue<number>('gpuMemoryUtilization') * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[getConfigValue<number>('gpuMemoryUtilization') * 100]}
                    onValueChange={([value]) => handleUpdateConfig('gpuMemoryUtilization', value / 100)}
                    min={50}
                    max={99}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = more throughput, lower = more stability
                  </p>
                </div>
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxNumSeqs">Max Concurrent Sequences</Label>
                  <Input
                    id="maxNumSeqs"
                    type="number"
                    value={getConfigValue<number>('maxNumSeqs')}
                    onChange={(e) => handleUpdateConfig('maxNumSeqs', parseInt(e.target.value))}
                    min={1}
                    max={1024}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="swapSpaceGb">Swap Space (GB)</Label>
                  <Input
                    id="swapSpaceGb"
                    type="number"
                    value={getConfigValue<number>('swapSpaceGb')}
                    onChange={(e) => handleUpdateConfig('swapSpaceGb', parseInt(e.target.value))}
                    min={0}
                    max={64}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enforce Eager Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Disable CUDA graphs for better compatibility
                  </p>
                </div>
                <Switch
                  checked={getConfigValue<boolean>('enforceEager')}
                  onCheckedChange={(checked) => handleUpdateConfig('enforceEager', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure Settings</CardTitle>
              <CardDescription>
                Configure SageMaker endpoint settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Instance Type</Label>
                <Select
                  value={getConfigValue<string>('instanceType')}
                  onValueChange={(value) => handleUpdateConfig('instanceType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instanceTypes.map((it) => (
                      <SelectItem key={it.instanceType} value={it.instanceType}>
                        <div className="flex items-center justify-between w-full">
                          <span>{it.instanceType}</span>
                          <span className="text-muted-foreground ml-4">
                            {it.gpuCount}x {it.gpuType} ({it.gpuMemoryGb}GB) - ${it.hourlyCostUsd}/hr
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Instance details */}
                {instanceTypes.find(it => it.instanceType === getConfigValue<string>('instanceType')) && (
                  <div className="bg-muted/50 rounded-lg p-4 mt-2">
                    {(() => {
                      const selected = instanceTypes.find(it => it.instanceType === getConfigValue<string>('instanceType'))!;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">GPUs:</span>
                            <span className="ml-2 font-medium">{selected.gpuCount}x {selected.gpuType}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">GPU Memory:</span>
                            <span className="ml-2 font-medium">{selected.gpuMemoryGb} GB</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">vCPUs:</span>
                            <span className="ml-2 font-medium">{selected.vcpuCount}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Memory:</span>
                            <span className="ml-2 font-medium">{selected.memoryGb} GB</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="minInstances">Min Instances</Label>
                  <Input
                    id="minInstances"
                    type="number"
                    value={getConfigValue<number>('minInstances')}
                    onChange={(e) => handleUpdateConfig('minInstances', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxInstances">Max Instances</Label>
                  <Input
                    id="maxInstances"
                    type="number"
                    value={getConfigValue<number>('maxInstances')}
                    onChange={(e) => handleUpdateConfig('maxInstances', parseInt(e.target.value))}
                    min={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="warmupInstances">Warmup Instances</Label>
                  <Input
                    id="warmupInstances"
                    type="number"
                    value={getConfigValue<number>('warmupInstances')}
                    onChange={(e) => handleUpdateConfig('warmupInstances', parseInt(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Scale to Zero</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow endpoint to scale down to 0 instances (causes cold starts)
                  </p>
                </div>
                <Switch
                  checked={getConfigValue<boolean>('scaleToZero')}
                  onCheckedChange={(checked) => handleUpdateConfig('scaleToZero', checked)}
                />
              </div>

              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxConcurrentInvocations">Max Concurrent Invocations</Label>
                  <Input
                    id="maxConcurrentInvocations"
                    type="number"
                    value={getConfigValue<number>('maxConcurrentInvocations')}
                    onChange={(e) => handleUpdateConfig('maxConcurrentInvocations', parseInt(e.target.value))}
                    min={1}
                    max={32}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="startupHealthCheckTimeoutSeconds">Startup Timeout (seconds)</Label>
                  <Input
                    id="startupHealthCheckTimeoutSeconds"
                    type="number"
                    value={getConfigValue<number>('startupHealthCheckTimeoutSeconds')}
                    onChange={(e) => handleUpdateConfig('startupHealthCheckTimeoutSeconds', parseInt(e.target.value))}
                    min={120}
                    max={1800}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endpointNamePrefix">Endpoint Name Prefix</Label>
                <Input
                  id="endpointNamePrefix"
                  value={getConfigValue<string>('endpointNamePrefix')}
                  onChange={(e) => handleUpdateConfig('endpointNamePrefix', e.target.value)}
                  placeholder="radiant-ghost"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                Recent SageMaker endpoint deployments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No deployments yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Startup Time</TableHead>
                      <TableHead>Invocations</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deployments.map((deployment) => (
                      <TableRow key={deployment.id}>
                        <TableCell className="font-mono text-sm">
                          {deployment.endpointName}
                        </TableCell>
                        <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                        <TableCell>
                          {new Date(deployment.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {deployment.startupDurationSeconds
                            ? `${Math.floor(deployment.startupDurationSeconds / 60)}m ${deployment.startupDurationSeconds % 60}s`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {formatNumber(deployment.totalInvocations)}
                          {deployment.totalErrors > 0 && (
                            <span className="text-red-500 ml-1">
                              ({deployment.totalErrors} errors)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{formatCost(deployment.actualCostUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deploy Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Ghost Inference Endpoint</DialogTitle>
            <DialogDescription>
              This will create a new SageMaker endpoint with the current configuration.
            </DialogDescription>
          </DialogHeader>
          
          {validationResult && (
            <div className="space-y-4">
              {validationResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                    <XCircle className="h-4 w-4" />
                    Validation Errors
                  </div>
                  <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
                    {validationResult.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings
                  </div>
                  <ul className="list-disc list-inside text-sm text-amber-600 dark:text-amber-300">
                    {validationResult.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.estimatedHourlyCost && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated Hourly Cost:</span>
                    <span className="font-bold">{formatCost(validationResult.estimatedHourlyCost)}/hr</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Estimated Monthly Cost:</span>
                    <span className="font-bold">{formatCost(validationResult.estimatedMonthlyCost || 0)}/mo</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={isDeploying || (validationResult?.errors?.length ?? 0) > 0}
            >
              {isDeploying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deploy Endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all unsaved changes to the configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
