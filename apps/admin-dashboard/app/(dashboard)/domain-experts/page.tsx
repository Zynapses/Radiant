'use client';

/**
 * RADIANT Domain Expert Cortex Manager
 * Dashboard for managing 7 specialized neural networks per domain
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Brain,
  Network,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Settings,
  Cpu,
  Activity,
  Shield,
  FileText,
  Users,
  Zap,
  Clock,
  TrendingUp,
  BookOpen,
  Stethoscope,
  Scale,
  DollarSign,
  GraduationCap,
  Dumbbell,
  Laptop,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type DomainExpertNetworkType =
  | 'entity_classifier'
  | 'contraindication_net'
  | 'protocol_matcher'
  | 'severity_assessor'
  | 'personalization_net'
  | 'citation_network'
  | 'orchestration_selector';

type DomainExpertStatus = 'active' | 'training' | 'validating' | 'inactive' | 'failed';

interface DomainExpertConfig {
  domainId: string;
  displayName: string;
  isTrainingDomain: boolean;
  enabled: boolean;
  numEntities: number;
  numActions: number;
  numProtocols: number;
  safetyThreshold: number;
  citationRequired: boolean;
}

interface DomainExpertNetwork {
  id: string;
  networkType: DomainExpertNetworkType;
  version: string;
  status: DomainExpertStatus;
  parameters: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorRate: number;
  requestsPerSecond: number;
}

interface DomainExpertSuite {
  domainId: string;
  domainName: string;
  config: DomainExpertConfig;
  networks: Record<DomainExpertNetworkType, DomainExpertNetwork | null>;
  completeness: number;
  status: 'complete' | 'partial' | 'none';
  totalParameters: number;
  lastUpdated: string;
}

interface TrainingJob {
  id: string;
  domainId: string;
  networkType: DomainExpertNetworkType;
  status: 'pending' | 'preparing' | 'training' | 'validating' | 'completed' | 'failed';
  progressPercent: number;
  currentEpoch: number;
  totalEpochs: number;
}

interface DashboardData {
  summary: {
    totalDomains: number;
    domainsWithExperts: number;
    totalNetworks: number;
    activeNetworks: number;
    trainingJobs: number;
    totalParameters: number;
  };
  domains: DomainExpertSuite[];
  recentTrainingJobs: TrainingJob[];
}

// =============================================================================
// Constants
// =============================================================================

const NETWORK_TYPES: Array<{ type: DomainExpertNetworkType; name: string; icon: React.ReactNode; description: string }> = [
  { type: 'entity_classifier', name: 'Entity Classifier', icon: <FileText className="h-4 w-4" />, description: 'Classifies domain entities' },
  { type: 'contraindication_net', name: 'Contraindication', icon: <AlertTriangle className="h-4 w-4" />, description: 'Flags dangerous combinations' },
  { type: 'protocol_matcher', name: 'Protocol Matcher', icon: <BookOpen className="h-4 w-4" />, description: 'Matches to protocols' },
  { type: 'severity_assessor', name: 'Severity Assessor', icon: <Activity className="h-4 w-4" />, description: 'Assesses severity levels' },
  { type: 'personalization_net', name: 'Personalization', icon: <Users className="h-4 w-4" />, description: 'User personalization' },
  { type: 'citation_network', name: 'Citation Network', icon: <FileText className="h-4 w-4" />, description: 'Finds citations' },
  { type: 'orchestration_selector', name: 'Orchestration', icon: <Network className="h-4 w-4" />, description: 'Selects orchestration' },
];

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  healthcare: <Stethoscope className="h-5 w-5" />,
  legal: <Scale className="h-5 w-5" />,
  finance: <DollarSign className="h-5 w-5" />,
  education: <GraduationCap className="h-5 w-5" />,
  fitness: <Dumbbell className="h-5 w-5" />,
  technology: <Laptop className="h-5 w-5" />,
};

// =============================================================================
// Component
// =============================================================================

export default function DomainExpertsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainExpertSuite | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/domain-experts/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return <PageSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchDashboard} className="mt-4" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalDomains: 0,
    domainsWithExperts: 0,
    totalNetworks: 0,
    activeNetworks: 0,
    trainingJobs: 0,
    totalParameters: 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-emerald-600" />
            Domain Expert Cortex
          </h1>
          <p className="text-muted-foreground mt-1">
            7 Specialized Neural Networks per Domain (~28M params each)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Domains Configured"
          value={summary.domainsWithExperts}
          subtitle={`of ${summary.totalDomains} total`}
          icon={<Network className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Active Networks"
          value={summary.activeNetworks}
          subtitle={`of ${summary.totalNetworks} deployed`}
          icon={<Cpu className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Training Jobs"
          value={summary.trainingJobs}
          subtitle="In progress"
          icon={<TrendingUp className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Total Parameters"
          value={formatParams(summary.totalParameters)}
          subtitle="Across all networks"
          icon={<Brain className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Domain Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Expert Suites</CardTitle>
          <CardDescription>
            Each domain has 7 specialized MLPs (~4M parameters each)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.domains ?? []).map((suite) => (
              <DomainCard
                key={suite.domainId}
                suite={suite}
                onClick={() => {
                  setSelectedDomain(suite);
                  setConfigDialogOpen(true);
                }}
              />
            ))}
            {(data?.domains ?? []).length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No domain experts configured</p>
                <p className="text-sm mt-1">Add a domain to start training expert networks</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Training Jobs */}
      {(data?.recentTrainingJobs ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Active Training Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recentTrainingJobs.filter(j => j.status === 'training').map((job) => (
                <TrainingJobCard key={job.id} job={job} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Types Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Network Types Reference</CardTitle>
          <CardDescription>
            7 specialized MLPs per domain, each ~4M parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {NETWORK_TYPES.map((net) => (
              <div key={net.type} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                <div className="p-2 rounded-lg bg-white">
                  {net.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{net.name}</p>
                  <p className="text-xs text-muted-foreground">{net.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Domain Config Dialog */}
      {selectedDomain && (
        <DomainConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          suite={selectedDomain}
          onSave={async (updates) => {
            await fetch(`/api/admin/domain-experts/domains/${selectedDomain.domainId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            setConfigDialogOpen(false);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function formatParams(params: number): string {
  if (params >= 1000000000) return `${(params / 1000000000).toFixed(1)}B`;
  if (params >= 1000000) return `${(params / 1000000).toFixed(1)}M`;
  if (params >= 1000) return `${(params / 1000).toFixed(0)}K`;
  return params.toString();
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DomainCard({
  suite,
  onClick,
}: {
  suite: DomainExpertSuite;
  onClick: () => void;
}) {
  const statusColors = {
    complete: 'bg-green-500',
    partial: 'bg-yellow-500',
    none: 'bg-gray-400',
  };

  const icon = DOMAIN_ICONS[suite.domainId] || <Network className="h-5 w-5" />;
  const activeCount = Object.values(suite.networks).filter(n => n?.status === 'active').length;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{suite.domainName}</span>
                {suite.config.isTrainingDomain && (
                  <Badge variant="secondary" className="text-xs">Example Domain</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{suite.domainId}</p>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${statusColors[suite.status]}`} />
        </div>

        {/* Network Status Grid */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {NETWORK_TYPES.map((net) => {
            const network = suite.networks[net.type];
            const isActive = network?.status === 'active';
            const isTraining = network?.status === 'training';
            return (
              <div
                key={net.type}
                className={`h-2 rounded ${
                  isActive ? 'bg-green-500' : isTraining ? 'bg-yellow-500 animate-pulse' : 'bg-gray-200'
                }`}
                title={`${net.name}: ${network?.status || 'Not deployed'}`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {activeCount}/7 networks active
          </span>
          <span className="font-mono text-xs">
            {formatParams(suite.totalParameters)}
          </span>
        </div>

        {/* Safety threshold indicator */}
        <div className="mt-3 flex items-center gap-2">
          <Shield className={`h-4 w-4 ${suite.config.safetyThreshold >= 0.9 ? 'text-red-500' : suite.config.safetyThreshold >= 0.7 ? 'text-amber-500' : 'text-green-500'}`} />
          <span className="text-xs text-muted-foreground">
            Safety: {(suite.config.safetyThreshold * 100).toFixed(0)}%
          </span>
          {suite.config.citationRequired && (
            <Badge variant="outline" className="text-xs ml-auto">Citations Required</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingJobCard({ job }: { job: TrainingJob }) {
  const networkInfo = NETWORK_TYPES.find(n => n.type === job.networkType);

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border">
      <div className="p-2 rounded-lg bg-amber-50">
        {networkInfo?.icon || <Cpu className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{job.domainId}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-sm">{networkInfo?.name}</span>
        </div>
        <Progress value={job.progressPercent} className="h-2" />
        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
          <span>Epoch {job.currentEpoch}/{job.totalEpochs}</span>
          <span>{job.progressPercent}%</span>
        </div>
      </div>
    </div>
  );
}

function DomainConfigDialog({
  open,
  onOpenChange,
  suite,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suite: DomainExpertSuite;
  onSave: (updates: Partial<DomainExpertConfig>) => void;
}) {
  const [safetyThreshold, setSafetyThreshold] = useState(suite.config.safetyThreshold * 100);
  const [citationRequired, setCitationRequired] = useState(suite.config.citationRequired);
  const [isTrainingDomain, setIsTrainingDomain] = useState(suite.config.isTrainingDomain);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {DOMAIN_ICONS[suite.domainId] || <Network className="h-5 w-5" />}
            {suite.domainName} Configuration
          </DialogTitle>
          <DialogDescription>
            Configure domain expert networks and safety settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Network Status */}
          <div>
            <Label className="mb-3 block">Network Status</Label>
            <div className="grid grid-cols-2 gap-3">
              {NETWORK_TYPES.map((net) => {
                const network = suite.networks[net.type];
                const statusColors: Record<string, string> = {
                  active: 'border-green-500 bg-green-50',
                  training: 'border-yellow-500 bg-yellow-50',
                  validating: 'border-blue-500 bg-blue-50',
                  inactive: 'border-gray-300',
                  failed: 'border-red-500 bg-red-50',
                };
                return (
                  <div
                    key={net.type}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                      network ? statusColors[network.status] : 'border-dashed border-gray-300'
                    }`}
                  >
                    {net.icon}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{net.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {network ? `v${network.version} - ${network.status}` : 'Not deployed'}
                      </p>
                    </div>
                    {network?.status === 'active' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety Threshold */}
          <div>
            <Label className="mb-3 block">Safety Threshold: {safetyThreshold.toFixed(0)}%</Label>
            <Slider
              value={[safetyThreshold]}
              onValueChange={([v]) => setSafetyThreshold(v)}
              min={50}
              max={100}
              step={5}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Minimum confidence required for safety-critical decisions
            </p>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Citations</Label>
              <p className="text-xs text-muted-foreground">All responses must include sources</p>
            </div>
            <Switch checked={citationRequired} onCheckedChange={setCitationRequired} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Training Domain</Label>
              <p className="text-xs text-muted-foreground">Shows Example Domain badge</p>
            </div>
            <Switch checked={isTrainingDomain} onCheckedChange={setIsTrainingDomain} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                safetyThreshold: safetyThreshold / 100,
                citationRequired,
                isTrainingDomain,
              })
            }
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
