'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Brain,
  Zap,
  Settings2,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  Heart,
  Lightbulb,
  Loader2,
  Network,
  RefreshCw,
  RotateCw,
  Save,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Scale,
  Search,
  BookOpen,
  MessageSquare,
  Compass,
  GitBranch,
  Layers,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ServiceWeight {
  serviceId: string;
  weight: number;
  enabled: boolean;
  priority: number;
  minLatencyMs: number;
  maxCostCents: number;
  bedrockOptimized: boolean;
  autoMode: boolean;
  autoWeight?: number;
  userOverride: boolean;
  lastAutoTunedAt?: string;
}

interface ConsciousnessWeight {
  indicatorId: string;
  weight: number;
  enabled: boolean;
  cycleDepth: number;
  integrationThreshold: number;
  autoMode: boolean;
  userOverride: boolean;
}

interface DecisionWeights {
  domainDetectionWeight: number;
  proficiencyMatchWeight: number;
  subspecialtyWeight: number;
  modelQualityWeight: number;
  modelCostWeight: number;
  modelLatencyWeight: number;
  modelSpecialtyWeight: number;
  modelReliabilityWeight: number;
  globalWorkspaceWeight: number;
  recurrentProcessingWeight: number;
  integratedInformationWeight: number;
  selfModelingWeight: number;
  moralCompassWeight: number;
  ethicalGuardrailWeight: number;
  confidenceCalibrationWeight: number;
  errorDetectionWeight: number;
  selfImprovementWeight: number;
}

interface ServiceHealthStatus {
  serviceId: string;
  serviceName: string;
  enabled: boolean;
  weight: number;
  avgLatencyMs: number;
  errorRate: number;
  invocationCount: number;
  lastInvoked: string | null;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
}

interface OrchestrationRequest {
  requestId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  detectedDomainId: string | null;
  selectedModel: string | null;
  totalLatencyMs: number | null;
  estimatedCostCents: number | null;
}

interface DashboardData {
  settings: {
    serviceWeights: ServiceWeight[];
    consciousnessWeights: ConsciousnessWeight[];
    decisionWeights: DecisionWeights;
    bedrockConfig: { enabled: boolean };
    selfImprovementConfig: { enabled: boolean; autoTuneWeights: boolean };
    defaultPipeline: { stages: unknown[] } | null;
  };
  serviceHealth: ServiceHealthStatus[];
  recentRequests: OrchestrationRequest[];
  summary: {
    enabledServices: number;
    totalServices: number;
    healthyServices: number;
    avgServiceWeight: number;
    pipelineStages: number;
    bedrockEnabled: boolean;
    selfImprovementEnabled: boolean;
  };
}

// ============================================================================
// Service Icons
// ============================================================================

const SERVICE_ICONS: Record<string, typeof Brain> = {
  consciousness: Brain,
  metacognition: Lightbulb,
  moral_compass: Heart,
  self_improvement: TrendingUp,
  domain_taxonomy: BookOpen,
  brain_router: Network,
  confidence_calibration: Target,
  error_detection: AlertCircle,
  knowledge_graph: Database,
  proactive_assistance: Sparkles,
  analogical_reasoning: GitBranch,
  world_model: Layers,
  episodic_memory: Clock,
  theory_of_mind: Eye,
  goal_planning: Compass,
  causal_reasoning: Workflow,
  multimodal_binding: Cpu,
  response_synthesis: MessageSquare,
};

const SERVICE_COLORS: Record<string, string> = {
  consciousness: 'text-violet-500',
  metacognition: 'text-amber-500',
  moral_compass: 'text-red-500',
  self_improvement: 'text-emerald-500',
  domain_taxonomy: 'text-blue-500',
  brain_router: 'text-purple-500',
  confidence_calibration: 'text-cyan-500',
  error_detection: 'text-orange-500',
  knowledge_graph: 'text-indigo-500',
  proactive_assistance: 'text-pink-500',
  analogical_reasoning: 'text-teal-500',
  world_model: 'text-slate-500',
  episodic_memory: 'text-yellow-500',
  theory_of_mind: 'text-rose-500',
  goal_planning: 'text-lime-500',
  causal_reasoning: 'text-sky-500',
  multimodal_binding: 'text-fuchsia-500',
  response_synthesis: 'text-green-500',
};

// ============================================================================
// Component
// ============================================================================

export default function AGIDashboardPage() {
  const queryClient = useQueryClient();
  const [_selectedService, _setSelectedService] = useState<string | null>(null);
  void _selectedService; // Reserved for service detail view
  void _setSelectedService;
  const [localWeights, setLocalWeights] = useState<ServiceWeight[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch dashboard data
  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['agi-dashboard'],
    queryFn: () => fetch('/api/admin/agi-orchestration/dashboard').then(r => r.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update service weights mutation
  const updateWeightsMutation = useMutation({
    mutationFn: (weights: ServiceWeight[]) =>
      fetch('/api/admin/agi-orchestration/service-weights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: weights.map(w => ({
          serviceId: w.serviceId,
          weight: w.weight,
          enabled: w.enabled,
          priority: w.priority,
        })) }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agi-dashboard'] });
      toast.success('Service weights updated');
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Failed to update weights');
    },
  });

  // Initialize local weights when data loads
  if (dashboard && localWeights.length === 0) {
    setLocalWeights(dashboard.settings.serviceWeights);
  }

  const updateLocalWeight = (serviceId: string, updates: Partial<ServiceWeight>) => {
    setLocalWeights(prev => prev.map(w => 
      w.serviceId === serviceId ? { ...w, ...updates } : w
    ));
    setHasChanges(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500';
      case 'degraded': return 'bg-amber-500';
      case 'unhealthy': return 'bg-red-500';
      case 'disabled': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Healthy</Badge>;
      case 'degraded': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><AlertCircle className="h-3 w-3 mr-1" />Degraded</Badge>;
      case 'unhealthy': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertCircle className="h-3 w-3 mr-1" />Unhealthy</Badge>;
      case 'disabled': return <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Failed to load dashboard</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-500" />
            AGI Orchestration Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor and configure the AGI brain&apos;s service weights and decision-making
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasChanges && (
            <Button 
              onClick={() => updateWeightsMutation.mutate(localWeights)}
              disabled={updateWeightsMutation.isPending}
            >
              {updateWeightsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Cpu className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dashboard.summary.enabledServices}/{dashboard.summary.totalServices}
                </p>
                <p className="text-sm text-muted-foreground">Services Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dashboard.summary.healthyServices}/{dashboard.summary.enabledServices}
                </p>
                <p className="text-sm text-muted-foreground">Services Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Workflow className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboard.summary.pipelineStages}</p>
                <p className="text-sm text-muted-foreground">Pipeline Stages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Scale className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(dashboard.summary.avgServiceWeight * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground">Avg Weight</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Toggles */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn(
          'transition-colors',
          dashboard.settings.bedrockConfig.enabled && 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Database className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">AWS Bedrock</p>
                  <p className="text-xs text-muted-foreground">Knowledge bases & agents</p>
                </div>
              </div>
              <Badge variant={dashboard.settings.bedrockConfig.enabled ? 'default' : 'secondary'}>
                {dashboard.settings.bedrockConfig.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'transition-colors',
          dashboard.settings.selfImprovementConfig.enabled && 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium">Self-Improvement</p>
                  <p className="text-xs text-muted-foreground">Auto-learning from feedback</p>
                </div>
              </div>
              <Badge variant={dashboard.settings.selfImprovementConfig.enabled ? 'default' : 'secondary'}>
                {dashboard.settings.selfImprovementConfig.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'transition-colors',
          dashboard.settings.selfImprovementConfig.autoTuneWeights && 'border-purple-200 bg-purple-50/50 dark:bg-purple-950/20'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Settings2 className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Auto-Tune Weights</p>
                  <p className="text-xs text-muted-foreground">Automatic optimization</p>
                </div>
              </div>
              <Badge variant={dashboard.settings.selfImprovementConfig.autoTuneWeights ? 'default' : 'secondary'}>
                {dashboard.settings.selfImprovementConfig.autoTuneWeights ? 'Active' : 'Manual'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList>
          <TabsTrigger value="services">Service Weights</TabsTrigger>
          <TabsTrigger value="health">Service Health</TabsTrigger>
          <TabsTrigger value="decisions">Decision Weights</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Service Weights Tab */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                AGI Service Weights
              </CardTitle>
              <CardDescription>
                Adjust the influence of each cognitive service in the orchestration pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {localWeights.map((service) => {
                  const Icon = SERVICE_ICONS[service.serviceId] || Cpu;
                  const color = SERVICE_COLORS[service.serviceId] || 'text-slate-500';
                  
                  return (
                    <div
                      key={service.serviceId}
                      className={cn(
                        'p-4 rounded-lg border transition-all',
                        service.enabled 
                          ? 'bg-card hover:border-primary/50' 
                          : 'bg-muted/30 opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Icon className={cn('h-5 w-5', color)} />
                          <span className="font-medium text-sm capitalize">
                            {service.serviceId.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Switch
                          checked={service.enabled}
                          onCheckedChange={(enabled) => 
                            updateLocalWeight(service.serviceId, { enabled })
                          }
                        />
                      </div>
                      
                      {service.enabled && (
                        <div className="space-y-4">
                          {/* Auto Mode Toggle */}
                          <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-xs font-medium">Auto Mode</span>
                            </div>
                            <Switch
                              checked={service.autoMode && !service.userOverride}
                              onCheckedChange={(auto) => 
                                updateLocalWeight(service.serviceId, { 
                                  autoMode: auto, 
                                  userOverride: !auto 
                                })
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Weight</span>
                              <div className="flex items-center gap-2">
                                {service.autoMode && !service.userOverride && service.autoWeight && (
                                  <span className="text-xs text-amber-600">
                                    (auto: {(service.autoWeight * 100).toFixed(0)}%)
                                  </span>
                                )}
                                <span className="font-mono">{(service.weight * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <Slider
                              value={[service.weight * 100]}
                              onValueChange={([val]) => 
                                updateLocalWeight(service.serviceId, { 
                                  weight: val / 100,
                                  userOverride: true,
                                  autoMode: false
                                })
                              }
                              min={0}
                              max={100}
                              step={5}
                              className="w-full"
                              disabled={service.autoMode && !service.userOverride}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Priority</span>
                              <span className="font-mono">{service.priority}</span>
                            </div>
                            <Slider
                              value={[service.priority]}
                              onValueChange={([val]) => 
                                updateLocalWeight(service.serviceId, { priority: val })
                              }
                              min={1}
                              max={10}
                              step={1}
                              className="w-full"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {service.bedrockOptimized && (
                              <Badge variant="outline" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                Bedrock
                              </Badge>
                            )}
                            {service.userOverride && (
                              <Badge variant="secondary" className="text-xs">
                                Manual
                              </Badge>
                            )}
                            {service.autoMode && !service.userOverride && (
                              <Badge variant="default" className="text-xs bg-amber-500">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Service Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Service Health Status
              </CardTitle>
              <CardDescription>
                Real-time health monitoring for all AGI services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard.serviceHealth.map((service) => {
                  const Icon = SERVICE_ICONS[service.serviceId] || Cpu;
                  const color = SERVICE_COLORS[service.serviceId] || 'text-slate-500';
                  
                  return (
                    <div
                      key={service.serviceId}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn('w-2 h-2 rounded-full', getStatusColor(service.status))} />
                        <Icon className={cn('h-5 w-5', color)} />
                        <div>
                          <p className="font-medium">{service.serviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            Weight: {(service.weight * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-mono">{service.avgLatencyMs.toFixed(0)}ms</p>
                          <p className="text-xs text-muted-foreground">Avg Latency</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono">{(service.errorRate * 100).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Error Rate</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono">{service.invocationCount}</p>
                          <p className="text-xs text-muted-foreground">Invocations</p>
                        </div>
                        <div className="w-24">
                          {getStatusBadge(service.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Decision Weights Tab */}
        <TabsContent value="decisions" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Domain Detection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Domain Detection Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeightSlider
                  label="Domain Detection"
                  value={dashboard.settings.decisionWeights.domainDetectionWeight}
                />
                <WeightSlider
                  label="Proficiency Match"
                  value={dashboard.settings.decisionWeights.proficiencyMatchWeight}
                />
                <WeightSlider
                  label="Subspecialty"
                  value={dashboard.settings.decisionWeights.subspecialtyWeight}
                />
              </CardContent>
            </Card>

            {/* Model Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Model Selection Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeightSlider
                  label="Quality"
                  value={dashboard.settings.decisionWeights.modelQualityWeight}
                />
                <WeightSlider
                  label="Cost"
                  value={dashboard.settings.decisionWeights.modelCostWeight}
                />
                <WeightSlider
                  label="Latency"
                  value={dashboard.settings.decisionWeights.modelLatencyWeight}
                />
                <WeightSlider
                  label="Specialty Match"
                  value={dashboard.settings.decisionWeights.modelSpecialtyWeight}
                />
                <WeightSlider
                  label="Reliability"
                  value={dashboard.settings.decisionWeights.modelReliabilityWeight}
                />
              </CardContent>
            </Card>

            {/* Consciousness */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Consciousness Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeightSlider
                  label="Global Workspace"
                  value={dashboard.settings.decisionWeights.globalWorkspaceWeight}
                />
                <WeightSlider
                  label="Recurrent Processing"
                  value={dashboard.settings.decisionWeights.recurrentProcessingWeight}
                />
                <WeightSlider
                  label="Integrated Information"
                  value={dashboard.settings.decisionWeights.integratedInformationWeight}
                />
                <WeightSlider
                  label="Self-Modeling"
                  value={dashboard.settings.decisionWeights.selfModelingWeight}
                />
              </CardContent>
            </Card>

            {/* Ethics & Meta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Ethics & Meta Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeightSlider
                  label="Moral Compass"
                  value={dashboard.settings.decisionWeights.moralCompassWeight}
                />
                <WeightSlider
                  label="Ethical Guardrails"
                  value={dashboard.settings.decisionWeights.ethicalGuardrailWeight}
                />
                <WeightSlider
                  label="Confidence Calibration"
                  value={dashboard.settings.decisionWeights.confidenceCalibrationWeight}
                />
                <WeightSlider
                  label="Error Detection"
                  value={dashboard.settings.decisionWeights.errorDetectionWeight}
                />
                <WeightSlider
                  label="Self-Improvement"
                  value={dashboard.settings.decisionWeights.selfImprovementWeight}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-4">
          <ParametersPanel />
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Recent Orchestration Requests
              </CardTitle>
              <CardDescription>
                Latest AGI orchestration requests with domain detection and model selection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.recentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent requests
                </div>
              ) : (
                <div className="space-y-2">
                  {dashboard.recentRequests.map((request) => (
                    <div
                      key={request.requestId}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          request.status === 'completed' ? 'bg-emerald-500' :
                          request.status === 'in_progress' ? 'bg-amber-500' :
                          'bg-red-500'
                        )} />
                        <div>
                          <p className="font-mono text-sm">{request.requestId.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {request.detectedDomainId && (
                          <Badge variant="outline" className="text-xs">
                            {request.detectedDomainId}
                          </Badge>
                        )}
                        {request.selectedModel && (
                          <span className="text-sm font-mono">
                            {request.selectedModel.split('/').pop()}
                          </span>
                        )}
                        {request.totalLatencyMs && (
                          <span className="text-sm text-muted-foreground">
                            {request.totalLatencyMs}ms
                          </span>
                        )}
                        {request.estimatedCostCents && (
                          <span className="text-sm text-muted-foreground">
                            ${(request.estimatedCostCents / 100).toFixed(4)}
                          </span>
                        )}
                        <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                          {request.status}
                        </Badge>
                      </div>
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

// ============================================================================
// Helper Components
// ============================================================================

function WeightSlider({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <Progress value={value * 100} className="h-2" />
    </div>
  );
}

interface ParameterDefault {
  category: string;
  name: string;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  currentValue: number;
  autoMode: boolean;
  userOverride: boolean;
  description?: string;
}

const PARAMETER_CATEGORIES = [
  { id: 'domain_detection', name: 'Domain Detection', icon: Search },
  { id: 'model_selection', name: 'Model Selection', icon: Network },
  { id: 'consciousness', name: 'Consciousness', icon: Brain },
  { id: 'ethics', name: 'Ethics', icon: Shield },
  { id: 'self_improvement', name: 'Self-Improvement', icon: TrendingUp },
  { id: 'performance', name: 'Performance', icon: Zap },
  { id: 'confidence', name: 'Confidence', icon: Target },
];

function ParametersPanel() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('domain_detection');

  const { data: parameters, isLoading } = useQuery<{ parameters: ParameterDefault[] }>({
    queryKey: ['agi-parameters', selectedCategory],
    queryFn: () => fetch(`/api/admin/agi-orchestration/parameters/${selectedCategory}`).then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ category, name, value, autoMode }: { category: string; name: string; value: number; autoMode: boolean }) => {
      const response = await fetch(`/api/admin/agi-orchestration/parameters/${category}/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, autoMode, userOverride: !autoMode }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agi-parameters'] });
      toast.success('Parameter updated');
    },
    onError: () => {
      toast.error('Failed to update parameter');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/agi-orchestration/parameters/reset', {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agi-parameters'] });
      toast.success('Parameters reset to defaults');
    },
  });

  const categoryInfo = PARAMETER_CATEGORIES.find(c => c.id === selectedCategory);
  const CategoryIcon = categoryInfo?.icon || Settings2;

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {/* Category Sidebar */}
      <Card className="md:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1">
            {PARAMETER_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4 mr-2" />
              )}
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Parameters List */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CategoryIcon className="h-5 w-5" />
            {categoryInfo?.name} Parameters
          </CardTitle>
          <CardDescription>
            Configure {categoryInfo?.name.toLowerCase()} settings. Auto mode uses optimized defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !parameters?.parameters?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No parameters found
            </div>
          ) : (
            <div className="space-y-4">
              {parameters.parameters.map((param) => (
                <div
                  key={`${param.category}-${param.name}`}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-sm">
                        {param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      {param.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {param.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-xs">Auto</span>
                              <Switch
                                checked={param.autoMode && !param.userOverride}
                                onCheckedChange={(auto) => 
                                  updateMutation.mutate({
                                    category: param.category,
                                    name: param.name,
                                    value: auto ? param.defaultValue : param.currentValue,
                                    autoMode: auto,
                                  })
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>When enabled, this parameter is automatically optimized</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Value {param.minValue !== undefined && param.maxValue !== undefined && 
                          `(${param.minValue} - ${param.maxValue})`}
                      </span>
                      <div className="flex items-center gap-2">
                        {param.autoMode && !param.userOverride && (
                          <span className="text-xs text-amber-600">
                            default: {param.defaultValue}
                          </span>
                        )}
                        <span className="font-mono">
                          {param.currentValue.toFixed(param.currentValue < 1 ? 2 : 0)}
                        </span>
                      </div>
                    </div>
                    <Slider
                      value={[param.currentValue]}
                      onValueChange={([val]) => 
                        updateMutation.mutate({
                          category: param.category,
                          name: param.name,
                          value: val,
                          autoMode: false,
                        })
                      }
                      min={param.minValue ?? 0}
                      max={param.maxValue ?? (param.currentValue > 1 ? param.currentValue * 2 : 1)}
                      step={param.currentValue < 1 ? 0.01 : 1}
                      disabled={param.autoMode && !param.userOverride}
                      className="w-full"
                    />
                  </div>

                  <div className="flex gap-1 mt-2">
                    {param.userOverride && (
                      <Badge variant="secondary" className="text-xs">Manual</Badge>
                    )}
                    {param.autoMode && !param.userOverride && (
                      <Badge variant="default" className="text-xs bg-amber-500">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Auto
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
