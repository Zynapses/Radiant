'use client';

/**
 * LIVS Admin Dashboard Page
 * 
 * LLM Integrity Verification System management:
 * - Configuration toggles
 * - Soft rules management
 * - Model integrity analytics
 * - Interrogation history
 * - Pipeline audit viewer
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Settings,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  BarChart3,
  Brain,
  Workflow,
  FileText,
  FileSearch,
  Zap,
} from 'lucide-react';

interface LIVSDashboard {
  config: {
    enabled: boolean;
    tier1Enabled: boolean;
    tier2Enabled: boolean;
    costMode: string;
  };
  interrogationMetrics: {
    total24h: number;
    total7d: number;
    total30d: number;
    liesDetected24h: number;
    liesDetected7d: number;
    liesDetected30d: number;
    averageLieRate: number;
  };
  topLyingModels: { modelId: string; lieRate: number; sampleSize: number }[];
  topReliableModels: { modelId: string; lieRate: number; sampleSize: number }[];
  orchestrationMetrics: {
    pipelinesAudited24h: number;
    failurePatternsDetected24h: number;
    averageIntegrityScore: number;
  };
  activeSoftRules: number;
  recentInterrogations: {
    id: string;
    modelId: string;
    verdict: string;
    timestamp: string;
  }[];
}

interface SoftRule {
  id: string;
  name: string;
  description?: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  priority: number;
  createdByType: string;
  active: boolean;
}

interface CognitivePrecisionConfig {
  contextAnchorEnabled: boolean;
  contextAnchorMinConfidence: number;
  contextAnchorAllowOverride: boolean;
  contextAnchorMaxClarifyingQuestions: number;
  constraintInjectionEnabled: boolean;
  constraintMaxPerRequest: number;
  constraintIncludeSystemDefaults: boolean;
  criticEnabled: boolean;
  criticModelId: string;
  screeningModelId: string;
  criticTemperature: number;
  tieredEscalationEnabled: boolean;
  screeningEscalationThreshold: number;
  ensembleEnabled: boolean;
  ensembleCriticModels: string[];
  ensembleVotingStrategy: 'majority' | 'unanimous' | 'weighted';
  isolationEnabled: boolean;
  isolationLevel: 'none' | 'partial' | 'full';
  applyCriticConstraints: boolean;
  maxCriticRetries: number;
  trackPerformance: boolean;
}

interface NegativeConstraint {
  id: string;
  constraintText: string;
  taskTypes: string[];
  category: 'content' | 'behavior' | 'format' | 'safety' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  isSystemDefault: boolean;
  createdAt: string;
}

interface CriticMetrics {
  totalInvocations: number;
  screeningInvocations: number;
  fullInvocations: number;
  ensembleInvocations: number;
  avgEscalationRate: number;
  avgHeuristicAgreementRate: number;
  avgConfidenceScreening: number;
  avgConfidenceFull: number;
  avgConfidenceEnsemble: number;
  verdictSupports: number;
  verdictWeakens: number;
  verdictInconclusive: number;
  avgProcessingTimeScreeningMs: number;
  avgProcessingTimeFullMs: number;
  avgProcessingTimeEnsembleMs: number;
}

interface AnchorLog {
  id: string;
  taskType: string;
  detectedRole: string;
  detectedAudience: string;
  knowledgeGaps: string[];
  confidenceScore: number;
  gateAction: 'PROCEED' | 'CLARIFY' | 'OVERRIDE_ALLOWED' | 'BLOCKED';
  clarifyingQuestions: string[];
  constraintsApplied: number;
  processingTimeMs: number;
  createdAt: string;
}

interface CognitivePrecisionDashboard {
  config: CognitivePrecisionConfig | null;
  anchorStats: { gateAction: string; count: number; avgConfidence: number; avgConstraints: number }[];
  customConstraintCount: number;
  criticMetrics: Partial<CriticMetrics>;
}

interface ModelProfile {
  modelId: string;
  lieRate: number;
  totalInterrogations: number;
  liesDetected: number;
  sampleSize: number;
  lastInterrogation: string;
  trend?: { date: string; lieRate: number }[];
  domainBreakdown?: { domain: string; lieRate: number; count: number }[];
  globalWeights?: { globalLieRate: number; globalSampleSize: number };
}

interface InterrogationDetail {
  id: string;
  tenantId: string;
  modelId: string;
  originalPrompt: string;
  originalResponse: string;
  verdict: string;
  confidence: number;
  lieDetected: boolean;
  evidencePoints: string[];
  interrogationDepth: number;
  processingTimeMs: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface PipelineAudit {
  id: string;
  tenantId: string;
  pipelineId: string;
  pipelineType: string;
  integrityScore: number;
  failurePatterns: string[];
  modelResults: { modelId: string; passed: boolean; score: number }[];
  recommendations: string[];
  createdAt: string;
}

interface OrchestrationPattern {
  id: string;
  patternId: string;
  patternType: string;
  reliabilityScore: number;
  executionCount: number;
  avgProcessingTime: number;
  failureRate: number;
  lastUsed: string;
}

const gateActionColors: Record<string, string> = {
  PROCEED: 'bg-green-500',
  CLARIFY: 'bg-yellow-500',
  OVERRIDE_ALLOWED: 'bg-orange-500',
  BLOCKED: 'bg-red-500',
};

const severityColors: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const verdictColors: Record<string, string> = {
  trusted: 'bg-green-500',
  suspicious: 'bg-yellow-500',
  likely_lie: 'bg-orange-500',
  confirmed_lie: 'bg-red-500',
};

const verdictIcons: Record<string, React.ReactNode> = {
  trusted: <CheckCircle className="h-4 w-4 text-green-500" />,
  suspicious: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  likely_lie: <ShieldAlert className="h-4 w-4 text-orange-500" />,
  confirmed_lie: <XCircle className="h-4 w-4 text-red-500" />,
};

const integrityScoreColor = (score: number) => {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  if (score >= 0.4) return 'text-orange-600';
  return 'text-red-600';
};

export default function LIVSPage() {
  const [dashboard, setDashboard] = useState<LIVSDashboard | null>(null);
  const [rules, setRules] = useState<SoftRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const { toast } = useToast();

  // Configuration state
  const [config, setConfig] = useState({
    enabled: true,
    individualInterrogation: {
      enabled: true,
      defaultDepth: 1,
      autoEscalate: true,
    },
    orchestrationIntegrity: {
      enabled: true,
      preActionInterrogation: true,
    },
    costMode: 'balanced',
  });

  // New rule state
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    conditions: '{}',
    actions: '{}',
    priority: 0,
  });

  // Cognitive Precision state
  const [cpDashboard, setCpDashboard] = useState<CognitivePrecisionDashboard | null>(null);
  const [cpConfig, setCpConfig] = useState<CognitivePrecisionConfig | null>(null);
  const [constraints, setConstraints] = useState<NegativeConstraint[]>([]);
  const [criticMetrics, setCriticMetrics] = useState<CriticMetrics | null>(null);
  const [anchorLogs, setAnchorLogs] = useState<AnchorLog[]>([]);
  const [cpConfigOpen, setCpConfigOpen] = useState(false);
  const [newConstraintOpen, setNewConstraintOpen] = useState(false);
  const [newConstraint, setNewConstraint] = useState<{
    constraintText: string;
    taskTypes: string[];
    category: 'content' | 'behavior' | 'format' | 'safety' | 'custom';
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>({
    constraintText: '',
    taskTypes: ['unknown'],
    category: 'custom',
    severity: 'medium',
  });

  // Extended model/interrogation/audit state
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelProfile | null>(null);
  const [modelDetailOpen, setModelDetailOpen] = useState(false);
  const [interrogations, setInterrogations] = useState<InterrogationDetail[]>([]);
  const [selectedInterrogation, setSelectedInterrogation] = useState<InterrogationDetail | null>(null);
  const [interrogationDetailOpen, setInterrogationDetailOpen] = useState(false);
  const [audits, setAudits] = useState<PipelineAudit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<PipelineAudit | null>(null);
  const [auditDetailOpen, setAuditDetailOpen] = useState(false);
  const [patterns, setPatterns] = useState<OrchestrationPattern[]>([]);
  const [aggregatingWeights, setAggregatingWeights] = useState(false);

  useEffect(() => {
    fetchDashboard();
    fetchRules();
    fetchCognitivePrecisionDashboard();
    fetchModelProfiles();
    fetchInterrogations();
    fetchAudits();
    fetchPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCognitivePrecisionDashboard = async () => {
    try {
      const res = await fetch('/api/admin/livs/cognitive-precision/dashboard');
      const data = await res.json();
      setCpDashboard(data);
      if (data.config) setCpConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch cognitive precision dashboard:', error);
    }
  };

  const fetchCpConfig = async () => {
    try {
      const res = await fetch('/api/admin/livs/cognitive-precision/config');
      const data = await res.json();
      setCpConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch cognitive precision config:', error);
    }
  };

  const fetchConstraints = async () => {
    try {
      const res = await fetch('/api/admin/livs/cognitive-precision/constraints');
      const data = await res.json();
      setConstraints(data.constraints || []);
    } catch (error) {
      console.error('Failed to fetch constraints:', error);
    }
  };

  const fetchCriticMetrics = async () => {
    try {
      const res = await fetch('/api/admin/livs/cognitive-precision/metrics');
      const data = await res.json();
      setCriticMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to fetch critic metrics:', error);
    }
  };

  const fetchAnchorLogs = async () => {
    try {
      const res = await fetch('/api/admin/livs/cognitive-precision/anchor-logs?limit=50');
      const data = await res.json();
      setAnchorLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch anchor logs:', error);
    }
  };

  const saveCpConfig = async () => {
    if (!cpConfig) return;
    try {
      await fetch('/api/admin/livs/cognitive-precision/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cpConfig),
      });
      toast({ title: 'Success', description: 'Cognitive Precision configuration saved' });
      setCpConfigOpen(false);
      fetchCognitivePrecisionDashboard();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' });
    }
  };

  const createConstraint = async () => {
    try {
      await fetch('/api/admin/livs/cognitive-precision/constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConstraint),
      });
      toast({ title: 'Success', description: 'Constraint created' });
      setNewConstraintOpen(false);
      setNewConstraint({ constraintText: '', taskTypes: ['unknown'], category: 'custom', severity: 'medium' });
      fetchConstraints();
      fetchCognitivePrecisionDashboard();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create constraint', variant: 'destructive' });
    }
  };

  const deleteConstraint = async (id: string) => {
    try {
      await fetch(`/api/admin/livs/cognitive-precision/constraints/${id}`, { method: 'DELETE' });
      toast({ title: 'Success', description: 'Constraint deleted' });
      fetchConstraints();
      fetchCognitivePrecisionDashboard();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete constraint', variant: 'destructive' });
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/livs/dashboard');
      const data = await res.json();
      setDashboard(data.dashboard);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/admin/livs/rules');
      const data = await res.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/livs/config');
      const data = await res.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await fetch('/api/admin/livs/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      toast({
        title: 'Success',
        description: 'Configuration saved',
      });
      setConfigOpen(false);
      fetchDashboard();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  const createRule = async () => {
    try {
      await fetch('/api/admin/livs/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          description: newRule.description,
          conditions: JSON.parse(newRule.conditions),
          actions: JSON.parse(newRule.actions),
          priority: newRule.priority,
        }),
      });
      toast({
        title: 'Success',
        description: 'Rule created',
      });
      setNewRuleOpen(false);
      setNewRule({ name: '', description: '', conditions: '{}', actions: '{}', priority: 0 });
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create rule',
        variant: 'destructive',
      });
    }
  };

  const toggleRule = async (ruleId: string) => {
    try {
      await fetch(`/api/admin/livs/rules/${ruleId}/toggle`, { method: 'POST' });
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle rule',
        variant: 'destructive',
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await fetch(`/api/admin/livs/rules/${ruleId}`, { method: 'DELETE' });
      toast({
        title: 'Success',
        description: 'Rule deleted',
      });
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  const fetchModelProfiles = async () => {
    try {
      const res = await fetch('/api/admin/livs/models?sortBy=lie_rate&order=desc');
      const data = await res.json();
      setModelProfiles(data.profiles || []);
    } catch (error) {
      console.error('Failed to fetch model profiles:', error);
    }
  };

  const fetchModelDetail = async (modelId: string) => {
    try {
      const res = await fetch(`/api/admin/livs/models/${encodeURIComponent(modelId)}`);
      const data = await res.json();
      setSelectedModel({
        ...data.profile,
        trend: data.trend,
        domainBreakdown: data.domainBreakdown,
        globalWeights: data.globalWeights,
      });
      setModelDetailOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch model details', variant: 'destructive' });
    }
  };

  const fetchInterrogations = async () => {
    try {
      const res = await fetch('/api/admin/livs/interrogations?limit=50');
      const data = await res.json();
      setInterrogations(data.interrogations || []);
    } catch (error) {
      console.error('Failed to fetch interrogations:', error);
    }
  };

  const fetchInterrogationDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/livs/interrogations/${id}`);
      const data = await res.json();
      setSelectedInterrogation(data.interrogation);
      setInterrogationDetailOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch interrogation details', variant: 'destructive' });
    }
  };

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/admin/livs/audits?limit=50');
      const data = await res.json();
      setAudits(data.audits || []);
    } catch (error) {
      console.error('Failed to fetch audits:', error);
    }
  };

  const fetchAuditDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/livs/audits/${id}`);
      const data = await res.json();
      setSelectedAudit(data.audit);
      setAuditDetailOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch audit details', variant: 'destructive' });
    }
  };

  const fetchPatterns = async () => {
    try {
      const res = await fetch('/api/admin/livs/patterns');
      const data = await res.json();
      setPatterns(data.patterns || []);
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    }
  };

  const triggerGlobalAggregation = async () => {
    setAggregatingWeights(true);
    try {
      await fetch('/api/admin/livs/global/aggregate', { method: 'POST' });
      toast({ title: 'Success', description: 'Global weights aggregated successfully' });
      fetchModelProfiles();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to aggregate global weights', variant: 'destructive' });
    } finally {
      setAggregatingWeights(false);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            LLM Integrity Verification System
          </h1>
          <p className="text-muted-foreground">
            Two-tier defense against AI &quot;lying&quot; behaviors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button onClick={fetchConfig}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>LIVS Configuration</DialogTitle>
                <DialogDescription>
                  Configure integrity verification settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>LIVS Enabled</Label>
                    <p className="text-sm text-muted-foreground">
                      Master toggle for integrity verification
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, enabled: checked })
                    }
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Tier 1: Individual Interrogation</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Enabled</Label>
                      <Switch
                        checked={config.individualInterrogation.enabled}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            individualInterrogation: {
                              ...config.individualInterrogation,
                              enabled: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Default Depth</Label>
                      <Select
                        value={String(config.individualInterrogation.defaultDepth)}
                        onValueChange={(v) =>
                          setConfig({
                            ...config,
                            individualInterrogation: {
                              ...config.individualInterrogation,
                              defaultDepth: parseInt(v),
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          <SelectItem value="1">Spot Check</SelectItem>
                          <SelectItem value="2">Moderate</SelectItem>
                          <SelectItem value="3">Thorough</SelectItem>
                          <SelectItem value="4">Forensic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-Escalate</Label>
                      <Switch
                        checked={config.individualInterrogation.autoEscalate}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            individualInterrogation: {
                              ...config.individualInterrogation,
                              autoEscalate: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Tier 2: Orchestration Integrity</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Enabled</Label>
                      <Switch
                        checked={config.orchestrationIntegrity.enabled}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            orchestrationIntegrity: {
                              ...config.orchestrationIntegrity,
                              enabled: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Pre-Action Interrogation</Label>
                      <Switch
                        checked={config.orchestrationIntegrity.preActionInterrogation}
                        onCheckedChange={(checked) =>
                          setConfig({
                            ...config,
                            orchestrationIntegrity: {
                              ...config.orchestrationIntegrity,
                              preActionInterrogation: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Cost Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Balance between cost and thoroughness
                      </p>
                    </div>
                    <Select
                      value={config.costMode}
                      onValueChange={(v) => setConfig({ ...config, costMode: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">Economy</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="thorough">Thorough</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveConfig}>Save Configuration</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={dashboard?.config.enabled ? 'border-green-500' : 'border-yellow-500'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {dashboard?.config.enabled ? (
                <ShieldCheck className="h-6 w-6 text-green-500" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-yellow-500" />
              )}
              <div>
                <p className="font-medium">
                  {dashboard?.config.enabled ? 'LIVS Active' : 'LIVS Disabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tier 1: {dashboard?.config.tier1Enabled ? 'ON' : 'OFF'} |{' '}
                  Tier 2: {dashboard?.config.tier2Enabled ? 'ON' : 'OFF'} |{' '}
                  Mode: {dashboard?.config.costMode}
                </p>
              </div>
            </div>
            <Badge variant={dashboard?.config.enabled ? 'default' : 'secondary'}>
              {dashboard?.activeSoftRules} Active Rules
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Interrogations (24h)
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.interrogationMetrics.total24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.interrogationMetrics.liesDetected24h || 0} lies detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Lie Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.interrogationMetrics.averageLieRate || 0) * 100).toFixed(1)}%
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {(dashboard?.interrogationMetrics.averageLieRate || 0) > 0.1 ? (
                <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
              )}
              Across all models
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pipelines Audited (24h)
            </CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.orchestrationMetrics.pipelinesAudited24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.orchestrationMetrics.failurePatternsDetected24h || 0} issues found
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrity Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.orchestrationMetrics.averageIntegrityScore || 0) * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">Average pipeline score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">
            <Brain className="h-4 w-4 mr-2" />
            Model Integrity
          </TabsTrigger>
          <TabsTrigger value="rules">
            <FileText className="h-4 w-4 mr-2" />
            Soft Rules
          </TabsTrigger>
          <TabsTrigger value="history">
            <Search className="h-4 w-4 mr-2" />
            Interrogation History
          </TabsTrigger>
          <TabsTrigger value="cognitive-precision" onClick={() => { fetchConstraints(); fetchCriticMetrics(); fetchAnchorLogs(); }}>
            <Zap className="h-4 w-4 mr-2" />
            Cognitive Precision
          </TabsTrigger>
          <TabsTrigger value="audits" onClick={fetchAudits}>
            <FileText className="h-4 w-4 mr-2" />
            Pipeline Audits
          </TabsTrigger>
          <TabsTrigger value="patterns" onClick={fetchPatterns}>
            <Workflow className="h-4 w-4 mr-2" />
            Orchestration Patterns
          </TabsTrigger>
        </TabsList>

        {/* Model Integrity Tab */}
        <TabsContent value="models" className="space-y-4">
          {/* Actions Row */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={triggerGlobalAggregation}
              disabled={aggregatingWeights}
            >
              {aggregatingWeights ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Aggregate Global Weights
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-500" />
                  Top Lying Models
                </CardTitle>
                <CardDescription>Models with highest lie detection rates</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Lie Rate</TableHead>
                      <TableHead>Samples</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.topLyingModels.map((model) => (
                      <TableRow key={model.modelId}>
                        <TableCell className="font-mono text-sm">
                          {model.modelId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {(model.lieRate * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{model.sampleSize}</TableCell>
                      </TableRow>
                    ))}
                    {(!dashboard?.topLyingModels || dashboard.topLyingModels.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No data yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-green-500" />
                  Most Reliable Models
                </CardTitle>
                <CardDescription>Models with lowest lie detection rates</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Lie Rate</TableHead>
                      <TableHead>Samples</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.topReliableModels.map((model) => (
                      <TableRow key={model.modelId}>
                        <TableCell className="font-mono text-sm">
                          {model.modelId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600">
                            {(model.lieRate * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{model.sampleSize}</TableCell>
                      </TableRow>
                    ))}
                    {(!dashboard?.topReliableModels || dashboard.topReliableModels.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No data yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Soft Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Soft Rules</CardTitle>
                <CardDescription>
                  Configurable integrity rules for specific domains, models, or query types
                </CardDescription>
              </div>
              <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Soft Rule</DialogTitle>
                    <DialogDescription>
                      Define conditions and actions for integrity verification
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="Medical Domain Verification"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newRule.description}
                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                        placeholder="Deep interrogation for medical queries"
                      />
                    </div>
                    <div>
                      <Label>Conditions (JSON)</Label>
                      <Textarea
                        value={newRule.conditions}
                        onChange={(e) => setNewRule({ ...newRule, conditions: e.target.value })}
                        placeholder='{"queryTypes": ["medical"], "domains": ["healthcare"]}'
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label>Actions (JSON)</Label>
                      <Textarea
                        value={newRule.actions}
                        onChange={(e) => setNewRule({ ...newRule, actions: e.target.value })}
                        placeholder='{"forceInterrogationDepth": 3, "requireEvidenceCitation": true}'
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        value={newRule.priority}
                        onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewRuleOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createRule}>Create Rule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.createdByType}</Badge>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.active}
                          onCheckedChange={() => toggleRule(rule.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {rule.createdByType !== 'system' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No soft rules configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interrogation History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Interrogations</CardTitle>
              <CardDescription>Latest LLM integrity checks</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.recentInterrogations.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.modelId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {verdictIcons[item.verdict]}
                          <span className="capitalize">{item.verdict.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard?.recentInterrogations ||
                    dashboard.recentInterrogations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No interrogations yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cognitive Precision Tab */}
        <TabsContent value="cognitive-precision" className="space-y-4">
          {/* CP Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Context Anchor</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cpDashboard?.config?.contextAnchorEnabled ? 'ON' : 'OFF'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Min confidence: {((cpDashboard?.config?.contextAnchorMinConfidence || 0.7) * 100).toFixed(0)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Constraints</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cpDashboard?.customConstraintCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Custom constraints active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critic Invocations</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cpDashboard?.criticMetrics?.totalInvocations || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 7 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lie Detection</CardTitle>
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((cpDashboard?.criticMetrics?.avgEscalationRate || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Critic override rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CP Configuration Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Cognitive Precision Configuration
                </CardTitle>
                <CardDescription>
                  Configure Context Anchor Gate, Negative Constraints, and Critic Model settings
                </CardDescription>
              </div>
              <Dialog open={cpConfigOpen} onOpenChange={setCpConfigOpen}>
                <DialogTrigger asChild>
                  <Button onClick={fetchCpConfig}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cognitive Precision Protocols</DialogTitle>
                    <DialogDescription>
                      Configure pre-generation and post-generation verification
                    </DialogDescription>
                  </DialogHeader>
                  {cpConfig && (
                    <div className="space-y-6 py-4">
                      {/* Context Anchor Gate */}
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Context Anchor Gate
                        </h4>
                        <div className="grid gap-4 pl-6">
                          <div className="flex items-center justify-between">
                            <Label>Enabled</Label>
                            <Switch
                              checked={cpConfig.contextAnchorEnabled}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, contextAnchorEnabled: v })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Min Confidence Threshold</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              className="w-24"
                              value={cpConfig.contextAnchorMinConfidence}
                              onChange={(e) => setCpConfig({ ...cpConfig, contextAnchorMinConfidence: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Allow Override</Label>
                            <Switch
                              checked={cpConfig.contextAnchorAllowOverride}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, contextAnchorAllowOverride: v })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Negative Constraints */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Negative Constraint Injection
                        </h4>
                        <div className="grid gap-4 pl-6">
                          <div className="flex items-center justify-between">
                            <Label>Enabled</Label>
                            <Switch
                              checked={cpConfig.constraintInjectionEnabled}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, constraintInjectionEnabled: v })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Include System Defaults</Label>
                            <Switch
                              checked={cpConfig.constraintIncludeSystemDefaults}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, constraintIncludeSystemDefaults: v })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Critic Model */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          Critic Model Separation
                        </h4>
                        <div className="grid gap-4 pl-6">
                          <div className="flex items-center justify-between">
                            <Label>Critic Enabled</Label>
                            <Switch
                              checked={cpConfig.criticEnabled}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, criticEnabled: v })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Primary Critic Model</Label>
                            <Input
                              className="w-64"
                              value={cpConfig.criticModelId}
                              onChange={(e) => setCpConfig({ ...cpConfig, criticModelId: e.target.value })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Screening Model</Label>
                            <Input
                              className="w-64"
                              value={cpConfig.screeningModelId}
                              onChange={(e) => setCpConfig({ ...cpConfig, screeningModelId: e.target.value })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Tiered Escalation</Label>
                            <Switch
                              checked={cpConfig.tieredEscalationEnabled}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, tieredEscalationEnabled: v })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Ensemble Critics</Label>
                            <Switch
                              checked={cpConfig.ensembleEnabled}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, ensembleEnabled: v })}
                            />
                          </div>
                          {cpConfig.ensembleEnabled && (
                            <div className="flex items-center justify-between">
                              <Label>Voting Strategy</Label>
                              <Select
                                value={cpConfig.ensembleVotingStrategy}
                                onValueChange={(v: 'majority' | 'unanimous' | 'weighted') => setCpConfig({ ...cpConfig, ensembleVotingStrategy: v })}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="majority">Majority</SelectItem>
                                  <SelectItem value="unanimous">Unanimous</SelectItem>
                                  <SelectItem value="weighted">Weighted</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Label>Isolation Level</Label>
                            <Select
                              value={cpConfig.isolationLevel}
                              onValueChange={(v: 'none' | 'partial' | 'full') => setCpConfig({ ...cpConfig, isolationLevel: v })}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="full">Full</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Track Performance</Label>
                            <Switch
                              checked={cpConfig.trackPerformance}
                              onCheckedChange={(v) => setCpConfig({ ...cpConfig, trackPerformance: v })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCpConfigOpen(false)}>Cancel</Button>
                    <Button onClick={saveCpConfig}>Save Configuration</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Context Anchor Gate</h5>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Status: <Badge variant={cpConfig?.contextAnchorEnabled ? 'default' : 'secondary'}>{cpConfig?.contextAnchorEnabled ? 'Enabled' : 'Disabled'}</Badge></p>
                    <p>Min Confidence: {((cpConfig?.contextAnchorMinConfidence || 0.7) * 100).toFixed(0)}%</p>
                    <p>Allow Override: {cpConfig?.contextAnchorAllowOverride ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Negative Constraints</h5>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Status: <Badge variant={cpConfig?.constraintInjectionEnabled ? 'default' : 'secondary'}>{cpConfig?.constraintInjectionEnabled ? 'Enabled' : 'Disabled'}</Badge></p>
                    <p>System Defaults: {cpConfig?.constraintIncludeSystemDefaults ? 'Included' : 'Excluded'}</p>
                    <p>Custom: {cpDashboard?.customConstraintCount || 0} active</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Critic Model</h5>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Status: <Badge variant={cpConfig?.criticEnabled ? 'default' : 'secondary'}>{cpConfig?.criticEnabled ? 'Enabled' : 'Disabled'}</Badge></p>
                    <p>Tiered: {cpConfig?.tieredEscalationEnabled ? 'Yes' : 'No'}</p>
                    <p>Ensemble: {cpConfig?.ensembleEnabled ? cpConfig.ensembleVotingStrategy : 'Disabled'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Negative Constraints Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Negative Constraints</CardTitle>
                <CardDescription>
                  Pre-generation &quot;don&apos;t do&quot; rules injected into system prompts
                </CardDescription>
              </div>
              <Dialog open={newConstraintOpen} onOpenChange={setNewConstraintOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Constraint
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Negative Constraint</DialogTitle>
                    <DialogDescription>
                      Define a new &quot;don&apos;t do&quot; rule for AI generation
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Constraint Text</Label>
                      <Textarea
                        value={newConstraint.constraintText}
                        onChange={(e) => setNewConstraint({ ...newConstraint, constraintText: e.target.value })}
                        placeholder="DO NOT provide medical diagnoses or treatment recommendations"
                      />
                    </div>
                    <div>
                      <Label>Task Types</Label>
                      <Input
                        value={newConstraint.taskTypes.join(', ')}
                        onChange={(e) => setNewConstraint({ ...newConstraint, taskTypes: e.target.value.split(',').map(t => t.trim()) })}
                        placeholder="code_generation, analysis, unknown"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={newConstraint.category}
                          onValueChange={(v) => setNewConstraint({ ...newConstraint, category: v as 'content' | 'behavior' | 'format' | 'safety' | 'custom' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="content">Content</SelectItem>
                            <SelectItem value="behavior">Behavior</SelectItem>
                            <SelectItem value="format">Format</SelectItem>
                            <SelectItem value="safety">Safety</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Severity</Label>
                        <Select
                          value={newConstraint.severity}
                          onValueChange={(v) => setNewConstraint({ ...newConstraint, severity: v as 'low' | 'medium' | 'high' | 'critical' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewConstraintOpen(false)}>Cancel</Button>
                    <Button onClick={createConstraint}>Create Constraint</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Constraint</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Task Types</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {constraints.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{c.constraintText}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={severityColors[c.severity]}>{c.severity}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.taskTypes.slice(0, 2).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                          {c.taskTypes.length > 2 && (
                            <Badge variant="secondary" className="text-xs">+{c.taskTypes.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.isSystemDefault ? 'default' : 'outline'}>
                          {c.isSystemDefault ? 'System' : 'Custom'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!c.isSystemDefault && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteConstraint(c.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {constraints.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No constraints loaded. Click the tab again to refresh.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Critic Metrics & Anchor Logs */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Critic Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Critic Performance (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {criticMetrics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Invocations</p>
                        <p className="text-2xl font-bold">{criticMetrics.totalInvocations || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Escalation Rate</p>
                        <p className="text-2xl font-bold">{((criticMetrics.avgEscalationRate || 0) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Screening</p>
                        <p className="font-medium">{criticMetrics.screeningInvocations || 0}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Full</p>
                        <p className="font-medium">{criticMetrics.fullInvocations || 0}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Ensemble</p>
                        <p className="font-medium">{criticMetrics.ensembleInvocations || 0}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2">Verdict Distribution</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-green-600">
                          Supports: {criticMetrics.verdictSupports || 0}
                        </Badge>
                        <Badge variant="outline" className="text-red-600">
                          Weakens: {criticMetrics.verdictWeakens || 0}
                        </Badge>
                        <Badge variant="outline" className="text-yellow-600">
                          Inconclusive: {criticMetrics.verdictInconclusive || 0}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">Click the tab to load metrics</p>
                )}
              </CardContent>
            </Card>

            {/* Context Anchor Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Anchor Evaluations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {anchorLogs.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {anchorLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <p className="font-medium">{log.taskType}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{(log.confidenceScore * 100).toFixed(0)}%</Badge>
                          <Badge className={gateActionColors[log.gateAction]}>{log.gateAction}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">Click the tab to load logs</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pipeline Audits Tab */}
        <TabsContent value="audits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5" />
                Pipeline Audits
              </CardTitle>
              <CardDescription>
                Integrity audits for orchestration pipelines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Integrity Score</TableHead>
                    <TableHead>Failure Patterns</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(audit.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{audit.pipelineId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{audit.pipelineType}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={integrityScoreColor(audit.integrityScore)}>
                          {(audit.integrityScore * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {audit.failurePatterns.length > 0 ? (
                          <Badge variant="destructive">{audit.failurePatterns.length} issues</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">Clean</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => fetchAuditDetail(audit.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {audits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No audits recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orchestration Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Orchestration Patterns
              </CardTitle>
              <CardDescription>
                Pattern reliability and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reliability</TableHead>
                    <TableHead>Executions</TableHead>
                    <TableHead>Avg Time</TableHead>
                    <TableHead>Failure Rate</TableHead>
                    <TableHead>Last Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-mono text-sm">{pattern.patternId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pattern.patternType}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={integrityScoreColor(pattern.reliabilityScore)}>
                          {(pattern.reliabilityScore * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>{pattern.executionCount.toLocaleString()}</TableCell>
                      <TableCell>{pattern.avgProcessingTime.toFixed(0)}ms</TableCell>
                      <TableCell>
                        <Badge variant={pattern.failureRate > 0.1 ? 'destructive' : 'outline'}>
                          {(pattern.failureRate * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(pattern.lastUsed).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {patterns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No patterns recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Model Detail Dialog */}
      <Dialog open={modelDetailOpen} onOpenChange={setModelDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Model Integrity Profile</DialogTitle>
            <DialogDescription>{selectedModel?.modelId}</DialogDescription>
          </DialogHeader>
          {selectedModel && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Lie Rate</p>
                  <p className="text-2xl font-bold text-red-600">
                    {(selectedModel.lieRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sample Size</p>
                  <p className="text-2xl font-bold">{selectedModel.sampleSize}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Interrogations</p>
                  <p className="text-2xl font-bold">{selectedModel.totalInterrogations}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lies Detected</p>
                  <p className="text-2xl font-bold text-orange-600">{selectedModel.liesDetected}</p>
                </div>
              </div>

              {selectedModel.globalWeights && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Global Weights</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Global Lie Rate</p>
                      <p className="font-bold">
                        {(selectedModel.globalWeights.globalLieRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Global Sample Size</p>
                      <p className="font-bold">{selectedModel.globalWeights.globalSampleSize}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedModel.domainBreakdown && selectedModel.domainBreakdown.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Domain Breakdown</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Lie Rate</TableHead>
                        <TableHead>Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedModel.domainBreakdown.map((d) => (
                        <TableRow key={d.domain}>
                          <TableCell>{d.domain}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={d.lieRate > 0.3 ? 'text-red-600' : 'text-green-600'}>
                              {(d.lieRate * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>{d.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedModel.trend && selectedModel.trend.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Recent Trend (7 days)</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selectedModel.trend.map((t) => (
                      <div key={t.date} className="p-2 bg-muted rounded text-sm">
                        <p className="text-muted-foreground">{t.date}</p>
                        <p className={t.lieRate > 0.3 ? 'text-red-600 font-bold' : 'font-bold'}>
                          {(t.lieRate * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Interrogation Detail Dialog */}
      <Dialog open={interrogationDetailOpen} onOpenChange={setInterrogationDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Interrogation Details</DialogTitle>
            <DialogDescription>
              {selectedInterrogation?.modelId} - {new Date(selectedInterrogation?.createdAt || '').toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedInterrogation && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Verdict</p>
                  <div className="flex items-center gap-2 mt-1">
                    {verdictIcons[selectedInterrogation.verdict]}
                    <Badge className={verdictColors[selectedInterrogation.verdict]}>
                      {selectedInterrogation.verdict.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-xl font-bold">{(selectedInterrogation.confidence * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processing Time</p>
                  <p className="text-xl font-bold">{selectedInterrogation.processingTimeMs}ms</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Original Prompt</h4>
                <pre className="p-3 bg-muted rounded text-sm overflow-x-auto whitespace-pre-wrap">
                  {selectedInterrogation.originalPrompt}
                </pre>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Original Response</h4>
                <pre className="p-3 bg-muted rounded text-sm overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedInterrogation.originalResponse}
                </pre>
              </div>

              {selectedInterrogation.evidencePoints && selectedInterrogation.evidencePoints.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Evidence Points</h4>
                  <ul className="space-y-2">
                    {selectedInterrogation.evidencePoints.map((point, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground">{idx + 1}.</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Interrogation Depth</p>
                  <p className="font-medium">{selectedInterrogation.interrogationDepth}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lie Detected</p>
                  <Badge variant={selectedInterrogation.lieDetected ? 'destructive' : 'outline'}>
                    {selectedInterrogation.lieDetected ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit Detail Dialog */}
      <Dialog open={auditDetailOpen} onOpenChange={setAuditDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pipeline Audit Details</DialogTitle>
            <DialogDescription>
              {selectedAudit?.pipelineId} - {selectedAudit?.pipelineType}
            </DialogDescription>
          </DialogHeader>
          {selectedAudit && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Integrity Score</p>
                  <p className={`text-3xl font-bold ${integrityScoreColor(selectedAudit.integrityScore)}`}>
                    {(selectedAudit.integrityScore * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Audited At</p>
                  <p className="text-lg font-medium">
                    {new Date(selectedAudit.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedAudit.failurePatterns.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 text-red-600">Failure Patterns Detected</h4>
                  <ul className="space-y-2">
                    {selectedAudit.failurePatterns.map((pattern, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        {pattern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Model Results</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAudit.modelResults.map((result) => (
                      <TableRow key={result.modelId}>
                        <TableCell className="font-mono text-sm">{result.modelId}</TableCell>
                        <TableCell>
                          {result.passed ? (
                            <Badge className="bg-green-500">Passed</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={integrityScoreColor(result.score)}>
                            {(result.score * 100).toFixed(0)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedAudit.recommendations.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {selectedAudit.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
