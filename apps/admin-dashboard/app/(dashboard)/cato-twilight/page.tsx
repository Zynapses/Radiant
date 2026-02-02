'use client';

/**
 * RADIANT CATO Twilight Dreaming Dashboard
 * 30% Invention Enforcement & PromptBreeder Evolution
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Moon,
  Sparkles,
  Brain,
  Lightbulb,
  TrendingUp,
  Activity,
  Play,
  Pause,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Target,
  FlaskConical,
  Dna,
  Shuffle,
  GitBranch,
  Combine,
  MemoryStick,
  Atom,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type PromptBreederOperator =
  | 'zero_order_hypermutation'
  | 'first_order_hypermutation'
  | 'estimation_of_distribution'
  | 'lineage_based_mutation'
  | 'crossover'
  | 'lamarckian_mutation'
  | 'context_shuffling'
  | 'working_memory_expansion'
  | 'elm';

interface DashboardData {
  summary: {
    totalPopulations: number;
    totalGenomes: number;
    totalInventions: number;
    approvedInventions: number;
    avgFitnessAllPopulations: number;
    currentInventionRate: number;
    targetInventionRate: number;
  };
  activeSession?: {
    id: string;
    status: string;
    generationsEvolved: number;
    genomesCreated: number;
    startedAt: string;
  };
  recentSessions: Array<{
    id: string;
    status: string;
    generationsEvolved: number;
    fitnessImprovement?: number;
    completedAt?: string;
  }>;
  inventionMetrics: {
    inventionRate: number;
    targetInventionRate: number;
    currentDeficit: number;
    enforcementMode: 'passive' | 'active' | 'aggressive';
    consecutiveNonInventive: number;
  };
  enforcementConfig: {
    targetInventionRate: number;
    enforcementEnabled: boolean;
    dreamingEnabled: boolean;
    dreamingSchedule: string;
  };
  recentInventions: Array<{
    id: string;
    inventionType: string;
    noveltyScore: number;
    status: string;
    createdAt: string;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const OPERATOR_INFO: Record<PromptBreederOperator, { name: string; icon: React.ReactNode; description: string }> = {
  zero_order_hypermutation: { name: 'Zero-Order', icon: <Shuffle className="h-4 w-4" />, description: 'Random mutations' },
  first_order_hypermutation: { name: 'First-Order', icon: <TrendingUp className="h-4 w-4" />, description: 'Gradient-guided' },
  estimation_of_distribution: { name: 'Distribution', icon: <Activity className="h-4 w-4" />, description: 'Learn from elites' },
  lineage_based_mutation: { name: 'Lineage', icon: <GitBranch className="h-4 w-4" />, description: 'Ancestry-informed' },
  crossover: { name: 'Crossover', icon: <Combine className="h-4 w-4" />, description: 'Combine parents' },
  lamarckian_mutation: { name: 'Lamarckian', icon: <Dna className="h-4 w-4" />, description: 'Persist adaptations' },
  context_shuffling: { name: 'Shuffling', icon: <Shuffle className="h-4 w-4" />, description: 'Reorder context' },
  working_memory_expansion: { name: 'Memory', icon: <MemoryStick className="h-4 w-4" />, description: 'Expand context' },
  elm: { name: 'ELM', icon: <Atom className="h-4 w-4" />, description: 'Extreme mutations' },
};

// =============================================================================
// Component
// =============================================================================

export default function CatoTwilightPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/cato-twilight/dashboard');
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
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const startDreamingSession = async () => {
    try {
      setStartingSession(true);
      const response = await fetch('/api/admin/cato-twilight/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generations: 10 }),
      });
      if (!response.ok) throw new Error('Failed to start session');
      fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setStartingSession(false);
    }
  };

  if (loading && !data) {
    return <PageSkeleton />;
  }

  const inventionRate = data?.inventionMetrics?.inventionRate ?? 0;
  const targetRate = data?.inventionMetrics?.targetInventionRate ?? 0.30;
  const ratePercent = inventionRate * 100;
  const targetPercent = targetRate * 100;
  const deficit = (targetRate - inventionRate) * 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Moon className="h-8 w-8 text-indigo-600" />
            Twilight Dreaming
          </h1>
          <p className="text-muted-foreground mt-1">
            30% Invention Enforcement & PromptBreeder Evolution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setConfigDialogOpen(true)} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button
            onClick={startDreamingSession}
            disabled={startingSession || !!data?.activeSession}
          >
            {data?.activeSession ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-pulse" />
                Dreaming...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Dreaming
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Invention Rate Gauge */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" />
                Invention Rate
              </h3>
              <p className="text-sm text-muted-foreground">
                Target: {targetPercent.toFixed(0)}% novelty in responses
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-indigo-600">
                {ratePercent.toFixed(1)}%
              </p>
              {deficit > 0 ? (
                <Badge variant="destructive" className="mt-1">
                  {deficit.toFixed(1)}% below target
                </Badge>
              ) : (
                <Badge className="mt-1 bg-green-500">
                  On target
                </Badge>
              )}
            </div>
          </div>
          <div className="relative">
            <Progress value={ratePercent} max={100} className="h-4" />
            <div
              className="absolute top-0 h-4 w-1 bg-red-500"
              style={{ left: `${targetPercent}%` }}
              title={`Target: ${targetPercent}%`}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0%</span>
            <span>Current: {ratePercent.toFixed(1)}%</span>
            <span>100%</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Badge variant={data?.inventionMetrics?.enforcementMode === 'passive' ? 'secondary' : data?.inventionMetrics?.enforcementMode === 'active' ? 'default' : 'destructive'}>
              {data?.inventionMetrics?.enforcementMode?.toUpperCase()} Mode
            </Badge>
            {(data?.inventionMetrics?.consecutiveNonInventive ?? 0) > 0 && (
              <span className="text-sm text-amber-600">
                {data?.inventionMetrics?.consecutiveNonInventive} consecutive non-inventive
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Populations"
          value={data?.summary?.totalPopulations ?? 0}
          subtitle="Prompt populations"
          icon={<FlaskConical className="h-5 w-5" />}
          color="indigo"
        />
        <StatCard
          title="Total Genomes"
          value={data?.summary?.totalGenomes ?? 0}
          subtitle="Evolved prompts"
          icon={<Dna className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Inventions"
          value={data?.summary?.totalInventions ?? 0}
          subtitle={`${data?.summary?.approvedInventions ?? 0} approved`}
          icon={<Lightbulb className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Avg Fitness"
          value={(data?.summary?.avgFitnessAllPopulations ?? 0).toFixed(3)}
          subtitle="Across all populations"
          icon={<TrendingUp className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Active Session */}
      {data?.activeSession && (
        <Card className="border-indigo-500 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 animate-pulse text-indigo-600" />
              Active Dreaming Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Generations Evolved</p>
                <p className="text-2xl font-bold">{data.activeSession.generationsEvolved}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Genomes Created</p>
                <p className="text-2xl font-bold">{data.activeSession.genomesCreated}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="text-lg font-mono">
                  {new Date(data.activeSession.startedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 9 PromptBreeder Operators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            PromptBreeder Operators
          </CardTitle>
          <CardDescription>
            9 evolutionary operators for prompt optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(OPERATOR_INFO).map(([key, info]) => (
              <div
                key={key}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
              >
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900">
                  {info.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{info.name}</p>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Inventions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recent Inventions
          </CardTitle>
          <CardDescription>
            Novel patterns discovered through twilight dreaming
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.recentInventions ?? []).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No inventions yet. Start a dreaming session to discover novel patterns.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.recentInventions.map((invention) => (
                <div
                  key={invention.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      invention.status === 'approved' ? 'bg-green-100 text-green-600' :
                      invention.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {invention.inventionType.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Novelty: {(invention.noveltyScore * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <Badge variant={invention.status === 'approved' ? 'default' : 'secondary'}>
                    {invention.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.recentSessions ?? []).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No dreaming sessions yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.recentSessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      session.status === 'completed' ? 'bg-green-100 text-green-600' :
                      session.status === 'running' ? 'bg-blue-100 text-blue-600' :
                      session.status === 'failed' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {session.status === 'completed' ? <CheckCircle className="h-4 w-4" /> :
                       session.status === 'running' ? <Activity className="h-4 w-4 animate-pulse" /> :
                       session.status === 'failed' ? <XCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {session.generationsEvolved} generations
                      </p>
                      {session.fitnessImprovement !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Fitness: {session.fitnessImprovement > 0 ? '+' : ''}{(session.fitnessImprovement * 100).toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {session.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config Dialog */}
      <ConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        config={data?.enforcementConfig}
        onSave={async (updates) => {
          try {
            await fetch('/api/admin/cato-twilight/config', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            setConfigDialogOpen(false);
            fetchDashboard();
          } catch (err) {
            setError('Failed to update config');
          }
        }}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

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
    indigo: 'text-indigo-600 bg-indigo-50',
    purple: 'text-purple-600 bg-purple-50',
    amber: 'text-amber-600 bg-amber-50',
    green: 'text-green-600 bg-green-50',
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

function ConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: {
    targetInventionRate: number;
    enforcementEnabled: boolean;
    dreamingEnabled: boolean;
    dreamingSchedule: string;
  };
  onSave: (updates: Record<string, unknown>) => void;
}) {
  const [targetRate, setTargetRate] = useState((config?.targetInventionRate ?? 0.30) * 100);
  const [enforcementEnabled, setEnforcementEnabled] = useState(config?.enforcementEnabled ?? true);
  const [dreamingEnabled, setDreamingEnabled] = useState(config?.dreamingEnabled ?? true);

  useEffect(() => {
    if (config) {
      setTargetRate((config.targetInventionRate ?? 0.30) * 100);
      setEnforcementEnabled(config.enforcementEnabled ?? true);
      setDreamingEnabled(config.dreamingEnabled ?? true);
    }
  }, [config]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Invention Enforcement Config
          </DialogTitle>
          <DialogDescription>
            Configure the 30% invention minimum enforcement
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div>
            <Label className="mb-3 block">Target Invention Rate: {targetRate.toFixed(0)}%</Label>
            <Slider
              value={[targetRate]}
              onValueChange={([v]) => setTargetRate(v)}
              min={20}
              max={50}
              step={5}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Minimum percentage of responses that should be inventive (20-50%)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enforcement Enabled</Label>
              <p className="text-xs text-muted-foreground">Force invention when below target</p>
            </div>
            <Switch checked={enforcementEnabled} onCheckedChange={setEnforcementEnabled} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Twilight Dreaming</Label>
              <p className="text-xs text-muted-foreground">Enable background prompt evolution</p>
            </div>
            <Switch checked={dreamingEnabled} onCheckedChange={setDreamingEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                targetInventionRate: targetRate / 100,
                enforcementEnabled,
                dreamingEnabled,
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
      <Skeleton className="h-40" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
