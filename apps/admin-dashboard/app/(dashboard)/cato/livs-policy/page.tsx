'use client';

/**
 * LIVS-M 2.0 Policy Registry Admin Page
 * v7.9.0 - Policy-Driven Forensic Verification for AI Swarms
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Scale,
  Lightbulb,
  Wrench,
  ShieldCheck,
  Zap,
  AlertTriangle,
  CheckCircle,
  Settings,
  History,
  BookOpen,
  ArrowUpCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';

type PolicyMode = 'RAPID_PROTO' | 'ENGINEERING' | 'STRICT_AUDIT';

interface PolicyConfig {
  mode: PolicyMode;
  enableSycophancyDetection: boolean;
  enableStubRejection: boolean;
  enableChaosInjection: boolean;
  maxConsensusVelocity: number;
  allowMockData: boolean;
}

interface PolicyHistory {
  id: string;
  previousMode: string | null;
  newMode: string;
  changedBy: string;
  changeReason: string | null;
  createdAt: string;
}

interface PolicyMetrics {
  totalEvaluations: number;
  approvals: number;
  rejections: number;
  interventions: number;
  chaosInjections: number;
  avgEvaluationTimeMs: number;
}

interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  installedVersion: string;
  updateAvailable: boolean;
  changelog: string[];
  breakingChanges: boolean;
  migrationRequired: boolean;
  lastChecked: string;
}

const POLICY_MODES: Record<PolicyMode, {
  icon: React.ReactNode;
  displayName: string;
  shortName: string;
  description: string;
  behavior: string;
  useCase: string;
  color: string;
  bgColor: string;
  defaults: Partial<PolicyConfig>;
}> = {
  RAPID_PROTO: {
    icon: <Lightbulb className="h-6 w-6" />,
    displayName: 'Brainstorming',
    shortName: 'Brainstorming',
    description: '"Yes, and..." mode',
    behavior: 'The AI accepts partial code, stubs (TODO), and rough ideas. It focuses on speed and creativity. Warnings are logged but do not stop the work.',
    useCase: 'Hackathons, MVP planning, early drafting',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    defaults: {
      enableSycophancyDetection: false,
      enableStubRejection: false,
      enableChaosInjection: false,
      maxConsensusVelocity: 10,
      allowMockData: true,
    },
  },
  ENGINEERING: {
    icon: <Wrench className="h-6 w-6" />,
    displayName: 'Standard',
    shortName: 'Standard',
    description: '"Trust but Verify" mode',
    behavior: 'Code must run. Stubs are rejected if they break functionality. Tests are encouraged but not mandatory for every single function.',
    useCase: 'Daily development, Sprint work',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    defaults: {
      enableSycophancyDetection: true,
      enableStubRejection: true,
      enableChaosInjection: false,
      maxConsensusVelocity: 2,
      allowMockData: false,
    },
  },
  STRICT_AUDIT: {
    icon: <ShieldCheck className="h-6 w-6" />,
    displayName: 'Strict Audit',
    shortName: 'Strict',
    description: '"Zero Trust" mode',
    behavior: 'The AI rejects anything that is not perfect. No stubs. No mocked data. Mandatory test coverage. Sycophancy (agreeing too fast) triggers an automatic Devil\'s Advocate intervention.',
    useCase: 'Production releases, medical/legal queries, security patches',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    defaults: {
      enableSycophancyDetection: true,
      enableStubRejection: true,
      enableChaosInjection: true,
      maxConsensusVelocity: 1,
      allowMockData: false,
    },
  },
};

export default function LIVSPolicyPage() {
  const [activeTab, setActiveTab] = useState('modes');
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['livs-policy-config'],
    queryFn: async (): Promise<PolicyConfig> => {
      try {
        const result = await apiClient.get<PolicyConfig>('/admin/livs/policy-registry/config');
        return result;
      } catch {
        return {
          mode: 'ENGINEERING',
          enableSycophancyDetection: true,
          enableStubRejection: true,
          enableChaosInjection: false,
          maxConsensusVelocity: 2,
          allowMockData: false,
        };
      }
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ['livs-policy-metrics'],
    queryFn: async (): Promise<PolicyMetrics> => {
      try {
        return await apiClient.get<PolicyMetrics>('/admin/livs/policy-registry/metrics');
      } catch {
        return {
          totalEvaluations: 0,
          approvals: 0,
          rejections: 0,
          interventions: 0,
          chaosInjections: 0,
          avgEvaluationTimeMs: 0,
        };
      }
    },
  });

  const { data: history } = useQuery({
    queryKey: ['livs-policy-history'],
    queryFn: async (): Promise<PolicyHistory[]> => {
      try {
        return await apiClient.get<PolicyHistory[]>('/admin/livs/policy-registry/history');
      } catch {
        return [];
      }
    },
  });

  const { data: versionInfo } = useQuery({
    queryKey: ['livs-version'],
    queryFn: async (): Promise<VersionCheckResult> => {
      try {
        return await apiClient.get<VersionCheckResult>('/admin/livs/version/check');
      } catch {
        return {
          currentVersion: '2.1.0',
          latestVersion: '2.1.0',
          installedVersion: '2.0.0',
          updateAvailable: true,
          changelog: [
            '**v2.1.0** (2026-02-05):',
            '  - Added version tracking and upgrade notifications',
            '  - Admin UI shows available updates with changelog',
            '  - One-click policy registry upgrade mechanism',
          ],
          breakingChanges: false,
          migrationRequired: false,
          lastChecked: new Date().toISOString(),
        };
      }
    },
    staleTime: 60000,
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/admin/livs/version/upgrade');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livs-version'] });
      setSuccess('Successfully upgraded LIVS-M to the latest version!');
      setTimeout(() => setSuccess(null), 5000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to upgrade LIVS-M');
    },
  });

  const updateModeMutation = useMutation({
    mutationFn: async (newMode: PolicyMode) => {
      await apiClient.put('/admin/livs/policy-registry/mode', { mode: newMode });
    },
    onSuccess: (_data, newMode) => {
      queryClient.invalidateQueries({ queryKey: ['livs-policy-config'] });
      queryClient.invalidateQueries({ queryKey: ['livs-policy-history'] });
      setSuccess(`Switched to ${POLICY_MODES[newMode].displayName} mode`);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update mode');
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async (updates: Partial<PolicyConfig>) => {
      await apiClient.patch('/admin/livs/policy-registry/settings', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livs-policy-config'] });
      setSuccess('Settings updated');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    },
  });

  const currentMode = config?.mode || 'ENGINEERING';
  const modeConfig = POLICY_MODES[currentMode];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">LIVS-M 2.0 Policy Registry</h1>
            <Badge variant="outline" className="text-xs">
              v{versionInfo?.installedVersion || '2.0.0'}
            </Badge>
            {versionInfo?.updateAvailable && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600 animate-pulse">
                <Sparkles className="h-3 w-3 mr-1" />
                Update Available
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Policy-Driven Forensic Verification for AI Swarms
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['livs-policy-config'] })}
          disabled={configLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${configLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="modes">
            <Scale className="h-4 w-4 mr-2" />
            Policy Modes
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Advanced Settings
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Zap className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="guide">
            <BookOpen className="h-4 w-4 mr-2" />
            User Guide
          </TabsTrigger>
          <TabsTrigger value="updates" className="relative">
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Updates
            {versionInfo?.updateAvailable && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modes" className="space-y-6">
          {/* Mode Selection Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Select Governance Mode</CardTitle>
              <CardDescription>
                Choose how strictly the AI governance system enforces code quality and prevents sycophancy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {(Object.keys(POLICY_MODES) as PolicyMode[]).map((mode) => {
                  const modeInfo = POLICY_MODES[mode];
                  const isActive = currentMode === mode;

                  return (
                    <Card
                      key={mode}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isActive ? 'ring-2 ring-primary' : ''
                      } ${modeInfo.bgColor}`}
                      onClick={() => updateModeMutation.mutate(mode)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className={modeInfo.color}>{modeInfo.icon}</div>
                          {isActive && <Badge variant="default">Active</Badge>}
                        </div>
                        <CardTitle className="text-lg">{modeInfo.displayName}</CardTitle>
                        <p className="text-sm font-medium text-muted-foreground">{modeInfo.description}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">{modeInfo.behavior}</p>
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                          <strong>Best for:</strong> {modeInfo.useCase}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Current Mode Summary */}
          <Card className={modeConfig.bgColor}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className={modeConfig.color}>{modeConfig.icon}</span>
                Current Mode: {modeConfig.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className={`h-4 w-4 ${config?.enableSycophancyDetection ? 'text-green-500' : 'text-gray-400'}`} />
                  <span>Sycophancy Detection: {config?.enableSycophancyDetection ? 'ON' : 'OFF'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${config?.enableStubRejection ? 'text-green-500' : 'text-gray-400'}`} />
                  <span>Stub Rejection: {config?.enableStubRejection ? 'ON' : 'OFF'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${config?.enableChaosInjection ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span>Chaos Injection: {config?.enableChaosInjection ? 'ON' : 'OFF'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-500" />
                  <span>Max Consensus Velocity: {config?.maxConsensusVelocity}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Fine-tune individual governance behaviors (overrides mode defaults)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Sycophancy Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Detect when agents agree too quickly without critical thinking
                  </p>
                </div>
                <Switch
                  checked={config?.enableSycophancyDetection ?? true}
                  onCheckedChange={(v) => updateSettingMutation.mutate({ enableSycophancyDetection: v })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Stub Rejection</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically reject outputs containing TODO, placeholder, or stub code
                  </p>
                </div>
                <Switch
                  checked={config?.enableStubRejection ?? true}
                  onCheckedChange={(v) => updateSettingMutation.mutate({ enableStubRejection: v })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Chaos Injection</Label>
                  <p className="text-sm text-muted-foreground">
                    Inject Devil&apos;s Advocate challenges when sycophancy is detected
                  </p>
                </div>
                <Switch
                  checked={config?.enableChaosInjection ?? false}
                  onCheckedChange={(v) => updateSettingMutation.mutate({ enableChaosInjection: v })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Allow Mock Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Permit use of mock/sample data in outputs
                  </p>
                </div>
                <Switch
                  checked={config?.allowMockData ?? false}
                  onCheckedChange={(v) => updateSettingMutation.mutate({ allowMockData: v })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-base">Max Consensus Velocity</Label>
                <p className="text-sm text-muted-foreground">
                  Maximum interaction turns before agents can agree (lower = stricter)
                </p>
                <Select
                  value={String(config?.maxConsensusVelocity ?? 2)}
                  onValueChange={(v) => updateSettingMutation.mutate({ maxConsensusVelocity: parseInt(v) })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Strictest)</SelectItem>
                    <SelectItem value="2">2 (Standard)</SelectItem>
                    <SelectItem value="5">5 (Relaxed)</SelectItem>
                    <SelectItem value="10">10 (Permissive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Policy Evaluation Metrics (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{metrics?.totalEvaluations || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Evaluations</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{metrics?.approvals || 0}</p>
                  <p className="text-sm text-muted-foreground">Approvals</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{metrics?.rejections || 0}</p>
                  <p className="text-sm text-muted-foreground">Rejections</p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{metrics?.interventions || 0}</p>
                  <p className="text-sm text-muted-foreground">Interventions</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{metrics?.chaosInjections || 0}</p>
                  <p className="text-sm text-muted-foreground">Chaos Injections</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{metrics?.avgEvaluationTimeMs || 0}ms</p>
                  <p className="text-sm text-muted-foreground">Avg Eval Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Policy Change History</CardTitle>
            </CardHeader>
            <CardContent>
              {!history || history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No changes recorded</p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {entry.previousMode ? (
                              <>
                                {POLICY_MODES[entry.previousMode as PolicyMode]?.displayName || entry.previousMode}
                                {' → '}
                                {POLICY_MODES[entry.newMode as PolicyMode]?.displayName || entry.newMode}
                              </>
                            ) : (
                              `Set to ${POLICY_MODES[entry.newMode as PolicyMode]?.displayName || entry.newMode}`
                            )}
                          </p>
                          {entry.changeReason && (
                            <p className="text-sm text-muted-foreground">{entry.changeReason}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {new Date(entry.createdAt).toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LIVS-M 2.0 User Guide</CardTitle>
              <CardDescription>
                Think of LIVS-M not as a chatbot, but as an engineering team with a dial.
                You control that dial.
              </CardDescription>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <h3>The &quot;Defcon&quot; Modes</h3>
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Behavior</th>
                    <th>When to Use</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Brainstorming</strong></td>
                    <td>&quot;Yes, and...&quot; - Accepts partial code, stubs, rough ideas</td>
                    <td>Hackathons, MVP planning, early drafting</td>
                  </tr>
                  <tr>
                    <td><strong>Standard</strong></td>
                    <td>&quot;Trust but Verify&quot; - Code must run, stubs rejected if breaking</td>
                    <td>Daily development, Sprint work</td>
                  </tr>
                  <tr>
                    <td><strong>Strict Audit</strong></td>
                    <td>&quot;Zero Trust&quot; - No stubs, no mocks, mandatory tests</td>
                    <td>Production releases, medical/legal, security</td>
                  </tr>
                </tbody>
              </table>

              <h3>Common Scenarios</h3>

              <h4>Scenario A: The &quot;Watermelon&quot; Project</h4>
              <p><strong>Symptom:</strong> AI agents report &quot;Done&quot; but code is full of <code>pass</code> and <code>return True</code>.</p>
              <p><strong>Fix:</strong> Enable Stub Rejection. The Supervisor will reject any lazy code.</p>

              <h4>Scenario B: The &quot;Groupthink&quot; Echo Chamber</h4>
              <p><strong>Symptom:</strong> Agent A makes a mistake, Agent B just agrees.</p>
              <p><strong>Fix:</strong> Set Max Consensus Velocity to 1 and enable Chaos Injection.</p>

              <h4>Scenario C: Friday Afternoon Deployment</h4>
              <p><strong>Symptom:</strong> You want to ensure nothing risky goes out.</p>
              <p><strong>Fix:</strong> Switch to Strict Audit mode before deploying.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5" />
                LIVS-M Version Management
              </CardTitle>
              <CardDescription>
                Check for updates and upgrade your LIVS-M policy registry to the latest version
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Installed Version</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">v{versionInfo?.installedVersion || '2.0.0'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Latest Version</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">v{versionInfo?.latestVersion || '2.1.0'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {versionInfo?.updateAvailable ? (
                      <Badge variant="default" className="bg-green-500">Update Available</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600">Up to Date</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {versionInfo?.updateAvailable && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">What&apos;s New in v{versionInfo.latestVersion}</h4>
                    <div className="bg-muted rounded-lg p-4 space-y-1">
                      {versionInfo.changelog.map((line, i) => (
                        <p key={i} className={`text-sm ${line.startsWith('**') ? 'font-semibold mt-2' : 'text-muted-foreground'}`}>
                          {line.replace(/\*\*/g, '')}
                        </p>
                      ))}
                    </div>
                  </div>

                  {versionInfo.breakingChanges && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Breaking Changes</AlertTitle>
                      <AlertDescription>
                        This update contains breaking changes. Review the changelog carefully before upgrading.
                      </AlertDescription>
                    </Alert>
                  )}

                  {versionInfo.migrationRequired && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Migration Required</AlertTitle>
                      <AlertDescription>
                        This update requires a database migration. The migration will run automatically during upgrade.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={() => upgradeMutation.mutate()}
                    disabled={upgradeMutation.isPending}
                    className="w-full"
                  >
                    {upgradeMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      <>
                        <ArrowUpCircle className="h-4 w-4 mr-2" />
                        Upgrade to v{versionInfo.latestVersion}
                      </>
                    )}
                  </Button>
                </>
              )}

              {!versionInfo?.updateAvailable && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>You&apos;re up to date!</AlertTitle>
                  <AlertDescription>
                    LIVS-M v{versionInfo?.installedVersion} is the latest version available.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
