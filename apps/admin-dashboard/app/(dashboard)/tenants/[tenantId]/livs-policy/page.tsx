'use client';

/**
 * Tenant Admin - LIVS-M Policy Configuration Page
 * 
 * Allows tenant administrators to configure LIVS-M 2.0 policy settings
 * specific to their organization.
 * 
 * @version 1.0.0
 * @since RADIANT v7.9.0
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Scale,
  Settings,
  BarChart3,
  HelpCircle,
  Save,
  RefreshCw,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquareWarning,
  Bug,
  Shuffle,
  History,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type LIVSMPolicyMode = 'RAPID_PROTO' | 'ENGINEERING' | 'STRICT_AUDIT';

interface TenantLIVSConfig {
  tenantId: string;
  policyMode: LIVSMPolicyMode;
  sycophancyDetection: boolean;
  stubRejection: boolean;
  chaosInjection: boolean;
  mockDataRejection: boolean;
  maxConsensusVelocity: number;
  interrogationDepth: number;
  enableGovernedDebate: boolean;
  enableForensicValidation: boolean;
  customRules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    severity: 'warning' | 'error' | 'block';
  }>;
}

interface TenantLIVSStats {
  totalEvaluations: number;
  approvedCount: number;
  rejectedCount: number;
  interventionCount: number;
  sycophancyDetections: number;
  stubDetections: number;
  averageIntegrityScore: number;
  topViolations: Array<{ rule: string; count: number }>;
  periodStart: string;
  periodEnd: string;
}

interface LIVSHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  previousMode: LIVSMPolicyMode | null;
  newMode: LIVSMPolicyMode | null;
  changedBy: string;
  details: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const POLICY_MODES: Array<{
  value: LIVSMPolicyMode;
  label: string;
  nickname: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'RAPID_PROTO',
    label: 'Brainstorming',
    nickname: '"Yes, and..."',
    description: 'Fast iteration for hackathons, MVPs, and exploration. Accepts stubs, warnings do not block.',
    color: 'bg-green-500',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    value: 'ENGINEERING',
    label: 'Standard',
    nickname: '"Trust but Verify"',
    description: 'Balanced mode for daily work and sprints. Code must run, sycophancy is warned.',
    color: 'bg-blue-500',
    icon: <Scale className="h-5 w-5" />,
  },
  {
    value: 'STRICT_AUDIT',
    label: 'Strict Audit',
    nickname: '"Zero Trust"',
    description: 'Maximum rigor for production, security, and compliance. No stubs, mandatory tests, Devil&apos;s Advocate.',
    color: 'bg-red-500',
    icon: <Shield className="h-5 w-5" />,
  },
];

const defaultConfig: TenantLIVSConfig = {
  tenantId: '',
  policyMode: 'ENGINEERING',
  sycophancyDetection: true,
  stubRejection: true,
  chaosInjection: false,
  mockDataRejection: true,
  maxConsensusVelocity: 3,
  interrogationDepth: 2,
  enableGovernedDebate: true,
  enableForensicValidation: true,
  customRules: [],
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchTenantLIVSConfig(tenantId: string): Promise<TenantLIVSConfig> {
  const response = await fetch(`/api/admin/tenants/${tenantId}/livs/config`);
  if (!response.ok) {
    if (response.status === 404) {
      return { ...defaultConfig, tenantId };
    }
    throw new Error('Failed to fetch tenant LIVS-M config');
  }
  return response.json();
}

async function fetchTenantLIVSStats(tenantId: string): Promise<TenantLIVSStats> {
  const response = await fetch(`/api/admin/tenants/${tenantId}/livs/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch tenant LIVS-M stats');
  }
  return response.json();
}

async function fetchTenantLIVSHistory(tenantId: string): Promise<LIVSHistoryEntry[]> {
  const response = await fetch(`/api/admin/tenants/${tenantId}/livs/history`);
  if (!response.ok) {
    throw new Error('Failed to fetch tenant LIVS-M history');
  }
  return response.json();
}

async function saveTenantLIVSConfig(config: TenantLIVSConfig): Promise<TenantLIVSConfig> {
  const response = await fetch(`/api/admin/tenants/${config.tenantId}/livs/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to save tenant LIVS-M config');
  }
  return response.json();
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TenantLIVSPolicyPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState<TenantLIVSConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch tenant LIVS config
  const { data: savedConfig, isLoading: configLoading } = useQuery({
    queryKey: ['tenant-livs-config', tenantId],
    queryFn: () => fetchTenantLIVSConfig(tenantId),
    enabled: !!tenantId,
  });

  // Fetch tenant LIVS stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['tenant-livs-stats', tenantId],
    queryFn: () => fetchTenantLIVSStats(tenantId),
    enabled: !!tenantId,
  });

  // Fetch tenant LIVS history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['tenant-livs-history', tenantId],
    queryFn: () => fetchTenantLIVSHistory(tenantId),
    enabled: !!tenantId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: saveTenantLIVSConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-livs-config', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-livs-history', tenantId] });
      setHasChanges(false);
      toast({
        title: 'Configuration Saved',
        description: 'LIVS-M policy settings have been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Sync local state with fetched config
  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const updateConfig = <K extends keyof TenantLIVSConfig>(
    key: K,
    value: TenantLIVSConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const selectedMode = POLICY_MODES.find(m => m.value === config.policyMode);

  if (configLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8" />
            LIVS-M Policy Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure AI governance and verification policies for this tenant
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (savedConfig) {
                setConfig(savedConfig);
                setHasChanges(false);
              }
            }}
            disabled={!hasChanges}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsaved Changes</AlertTitle>
          <AlertDescription>
            You have unsaved changes to the LIVS-M policy configuration.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="policy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policy" className="gap-2">
            <Scale className="h-4 w-4" />
            Policy Mode
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Advanced Settings
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            User Guide
          </TabsTrigger>
        </TabsList>

        {/* Policy Mode Tab */}
        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Policy Mode</CardTitle>
              <CardDescription>
                Choose how strictly AI outputs should be verified. This affects all Think Tank sessions for users in this tenant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {POLICY_MODES.map(mode => (
                  <Card
                    key={mode.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      config.policyMode === mode.value
                        ? 'ring-2 ring-primary'
                        : ''
                    }`}
                    onClick={() => updateConfig('policyMode', mode.value)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${mode.color} text-white`}>
                          {mode.icon}
                        </div>
                        {config.policyMode === mode.value && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg mt-2">{mode.label}</CardTitle>
                      <p className="text-sm text-muted-foreground italic">
                        {mode.nickname}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {mode.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedMode && (
                <Alert className="mt-4">
                  {selectedMode.icon}
                  <AlertTitle>Current Mode: {selectedMode.label}</AlertTitle>
                  <AlertDescription>
                    {selectedMode.description}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareWarning className="h-5 w-5" />
                  Sycophancy Detection
                </CardTitle>
                <CardDescription>
                  Detect when AI agents agree too quickly without proper analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sycophancy">Enable Detection</Label>
                  <Switch
                    id="sycophancy"
                    checked={config.sycophancyDetection}
                    onCheckedChange={v => updateConfig('sycophancyDetection', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Consensus Velocity</Label>
                  <p className="text-xs text-muted-foreground">
                    Maximum agreements per minute before triggering Devil&apos;s Advocate
                  </p>
                  <Slider
                    value={[config.maxConsensusVelocity]}
                    onValueChange={([v]) => updateConfig('maxConsensusVelocity', v)}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-sm text-center">{config.maxConsensusVelocity} agreements/min</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Stub Rejection
                </CardTitle>
                <CardDescription>
                  Automatically reject placeholder or incomplete code implementations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="stub">Enable Stub Rejection</Label>
                  <Switch
                    id="stub"
                    checked={config.stubRejection}
                    onCheckedChange={v => updateConfig('stubRejection', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="mock">Reject Mock Data</Label>
                  <Switch
                    id="mock"
                    checked={config.mockDataRejection}
                    onCheckedChange={v => updateConfig('mockDataRejection', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shuffle className="h-5 w-5" />
                  Chaos Injection
                </CardTitle>
                <CardDescription>
                  Inject adversarial prompts to break sycophancy patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chaos">Enable Chaos Injection</Label>
                  <Switch
                    id="chaos"
                    checked={config.chaosInjection}
                    onCheckedChange={v => updateConfig('chaosInjection', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, the system will inject Devil&apos;s Advocate prompts
                  when agents reach consensus too quickly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Forensic Validation
                </CardTitle>
                <CardDescription>
                  Deep verification of AI outputs with multi-round interrogation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="forensic">Enable Forensic Validation</Label>
                  <Switch
                    id="forensic"
                    checked={config.enableForensicValidation}
                    onCheckedChange={v => updateConfig('enableForensicValidation', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interrogation Depth (0-4)</Label>
                  <Slider
                    value={[config.interrogationDepth]}
                    onValueChange={([v]) => updateConfig('interrogationDepth', v)}
                    min={0}
                    max={4}
                    step={1}
                  />
                  <p className="text-sm text-center">
                    Level {config.interrogationDepth}: {
                      ['None', 'Basic', 'Standard', 'Deep', 'Forensic'][config.interrogationDepth]
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Governed Debate
                </CardTitle>
                <CardDescription>
                  Multi-agent debate with Thesis/Antithesis agents under Supervisor governance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="debate">Enable Governed Debate</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enables multi-agent patterns where Thesis and Antithesis agents
                      argue under Supervisor governance with sycophancy detection
                    </p>
                  </div>
                  <Switch
                    id="debate"
                    checked={config.enableGovernedDebate}
                    onCheckedChange={v => updateConfig('enableGovernedDebate', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Total Evaluations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.totalEvaluations.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Approved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">{stats.approvedCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {((stats.approvedCount / stats.totalEvaluations) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Rejected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600">{stats.rejectedCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {((stats.rejectedCount / stats.totalEvaluations) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Interventions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-yellow-600">{stats.interventionCount.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Detection Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell>Sycophancy Detections</TableCell>
                          <TableCell className="text-right font-mono">
                            {stats.sycophancyDetections}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Stub Detections</TableCell>
                          <TableCell className="text-right font-mono">
                            {stats.stubDetections}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Average Integrity Score</TableCell>
                          <TableCell className="text-right font-mono">
                            {(stats.averageIntegrityScore * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Violations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.topViolations.slice(0, 5).map((v, i) => (
                          <TableRow key={i}>
                            <TableCell>{v.rule}</TableCell>
                            <TableCell className="text-right font-mono">
                              {v.count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Metrics Available</AlertTitle>
              <AlertDescription>
                Metrics will appear once LIVS-M evaluations have been performed.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Change History</CardTitle>
              <CardDescription>
                Audit log of all LIVS-M policy configuration changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <Skeleton className="h-64" />
              ) : history && history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(entry.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.action}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.previousMode && entry.newMode ? (
                            <span>
                              <Badge variant="secondary">{entry.previousMode}</Badge>
                              {' → '}
                              <Badge>{entry.newMode}</Badge>
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{entry.changedBy}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.details}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No history entries yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Guide Tab */}
        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LIVS-M 2.0 User Guide</CardTitle>
              <CardDescription>
                Understanding AI governance and verification policies
              </CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <h3>What is LIVS-M?</h3>
              <p>
                LIVS-M (LLM Integrity Verification System - Management Edition) is RADIANT&apos;s
                AI governance framework that ensures AI outputs meet quality and integrity standards.
                It uses policy-driven verification to catch common AI failure modes before they
                reach users.
              </p>

              <h3>Policy Modes Explained</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mode</TableHead>
                    <TableHead>Best For</TableHead>
                    <TableHead>Stub Rejection</TableHead>
                    <TableHead>Sycophancy Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><Badge className="bg-green-500">Brainstorming</Badge></TableCell>
                    <TableCell>Hackathons, MVPs, exploration</TableCell>
                    <TableCell>⚠️ Warn only</TableCell>
                    <TableCell>❌ Disabled</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="bg-blue-500">Standard</Badge></TableCell>
                    <TableCell>Daily work, sprints</TableCell>
                    <TableCell>🛑 Block</TableCell>
                    <TableCell>⚠️ Warn</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge className="bg-red-500">Strict Audit</Badge></TableCell>
                    <TableCell>Production, compliance</TableCell>
                    <TableCell>🛑 Block + Alert</TableCell>
                    <TableCell>🛑 Block + Devil&apos;s Advocate</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <h3>Key Features</h3>
              <ul>
                <li>
                  <strong>Sycophancy Detection</strong>: Identifies when AI agents agree
                  too quickly without proper critical analysis
                </li>
                <li>
                  <strong>Stub Rejection</strong>: Automatically rejects placeholder code
                  like &quot;// TODO&quot; or &quot;pass&quot; statements
                </li>
                <li>
                  <strong>Chaos Injection</strong>: Injects Devil&apos;s Advocate prompts
                  to break agreement patterns
                </li>
                <li>
                  <strong>Forensic Validation</strong>: Multi-round interrogation protocol
                  that asks follow-up questions to verify reasoning
                </li>
                <li>
                  <strong>Governed Debate</strong>: Multi-agent patterns where Thesis and
                  Antithesis agents argue under Supervisor governance
                </li>
              </ul>

              <h3>Recommendations by Use Case</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Recommended Mode</TableHead>
                    <TableHead>Rationale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Brainstorming new features</TableCell>
                    <TableCell><Badge className="bg-green-500">Brainstorming</Badge></TableCell>
                    <TableCell>Speed over rigor</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Sprint development</TableCell>
                    <TableCell><Badge className="bg-blue-500">Standard</Badge></TableCell>
                    <TableCell>Balanced quality/speed</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Code review for release</TableCell>
                    <TableCell><Badge className="bg-red-500">Strict Audit</Badge></TableCell>
                    <TableCell>Maximum verification</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Security-sensitive code</TableCell>
                    <TableCell><Badge className="bg-red-500">Strict Audit</Badge></TableCell>
                    <TableCell>Zero tolerance for shortcuts</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Compliance documentation</TableCell>
                    <TableCell><Badge className="bg-red-500">Strict Audit</Badge></TableCell>
                    <TableCell>Audit trail required</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
