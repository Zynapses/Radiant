'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Brain,
  Lock,
  Eye,
  Gauge,
  Swords,
} from 'lucide-react';
import Link from 'next/link';

interface SafetyMetrics {
  totalEvaluations: number;
  approved: number;
  blocked: number;
  vetoCount: number;
  cbfViolations: number;
  recoveryEvents: number;
  governanceCheckpoints: number;
}

interface SystemStatus {
  safetyPipeline: 'healthy' | 'degraded' | 'offline';
  precisionGovernor: 'active' | 'emergency';
  cbfEnforcement: 'enforce' | 'warn';
  epistemicRecovery: 'idle' | 'active';
  governancePreset: string;
}

export default function SafetyOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SafetyMetrics | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, statusRes] = await Promise.all([
        fetch('/api/admin/cato/metrics'),
        fetch('/api/admin/cato/system-status'),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics({
          totalEvaluations: data.total_evaluations || 0,
          approved: data.approved || 0,
          blocked: data.blocked || 0,
          vetoCount: data.veto_count || 0,
          cbfViolations: data.cbf_violations || 0,
          recoveryEvents: data.recovery_events || 0,
          governanceCheckpoints: data.governance_checkpoints || 0,
        });
      }
      if (statusRes.ok) setStatus(await statusRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load safety data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const approvalRate = metrics
    ? metrics.totalEvaluations > 0
      ? ((metrics.approved / metrics.totalEvaluations) * 100).toFixed(1)
      : '0'
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Cato Safety Overview
          </h1>
          <p className="text-muted-foreground">
            Genesis Cato Safety Architecture - Real-time monitoring
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Safety Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={status?.safetyPipeline === 'healthy' ? 'default' : 'destructive'}
              className="text-sm"
            >
              {status?.safetyPipeline || 'Unknown'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Precision Governor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={status?.precisionGovernor === 'active' ? 'default' : 'destructive'}
              className="text-sm"
            >
              {status?.precisionGovernor || 'Unknown'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              CBF Enforcement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="text-sm bg-green-600">
              {status?.cbfEnforcement || 'ENFORCE'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Always enforced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Epistemic Recovery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={status?.epistemicRecovery === 'idle' ? 'secondary' : 'default'}
              className="text-sm"
            >
              {status?.epistemicRecovery || 'Idle'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/cato/governance">
          <Card className="cursor-pointer hover:bg-accent transition-colors border-2 border-primary/30">
            <CardHeader>
              <Gauge className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Governance Presets</CardTitle>
              <CardDescription>
                Configure variable friction and checkpoint behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">
                Current: {status?.governancePreset || 'Balanced'}
              </Badge>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cato/war-room">
          <Card className="cursor-pointer hover:bg-accent transition-colors border-2 border-orange-500/30">
            <CardHeader>
              <Swords className="h-8 w-8 text-orange-500 mb-2" />
              <CardTitle>War Room</CardTitle>
              <CardDescription>
                Multi-agent adversarial debate arena
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Council of Rivals</Badge>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Evaluations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalEvaluations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {metrics.approved}
              </div>
              <p className="text-xs text-muted-foreground">{approvalRate}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Blocked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                {metrics.blocked}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Veto Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{metrics.vetoCount}</div>
              <p className="text-xs text-muted-foreground">Unrecoverable</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                CBF Violations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{metrics.cbfViolations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Governance Checks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.governanceCheckpoints}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Five-Layer Security Stack */}
      <Card>
        <CardHeader>
          <CardTitle>Five-Layer Security Stack</CardTitle>
          <CardDescription>
            Genesis Cato implements a comprehensive cognitive immune system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                layer: 'L4',
                name: 'Cognitive',
                desc: 'Active Inference, C-Matrix, Precision Governor',
                color: 'bg-purple-500',
              },
              {
                layer: 'L3',
                name: 'Control',
                desc: 'Control Barrier Functions (CBFs) - NEVER relax',
                color: 'bg-red-500',
              },
              {
                layer: 'L2',
                name: 'Perception',
                desc: 'Semantic Entropy, Redundant Perception, Fracture Detection',
                color: 'bg-yellow-500',
              },
              {
                layer: 'L1',
                name: 'Sensory',
                desc: 'Immediate Veto - hardcoded, no recovery',
                color: 'bg-orange-500',
              },
              {
                layer: 'L0',
                name: 'Recovery',
                desc: 'Epistemic Recovery, Livelock detection, Mood switching',
                color: 'bg-blue-500',
              },
            ].map((layer) => (
              <div
                key={layer.layer}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
              >
                <div
                  className={`w-12 h-12 rounded-lg ${layer.color} flex items-center justify-center text-white font-bold`}
                >
                  {layer.layer}
                </div>
                <div>
                  <p className="font-medium">{layer.name}</p>
                  <p className="text-sm text-muted-foreground">{layer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Immutable Invariants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Immutable Safety Invariants
          </CardTitle>
          <CardDescription>These are HARDCODED and cannot be changed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="font-medium text-green-700">CBF_ENFORCEMENT_MODE</p>
              <p className="text-sm text-muted-foreground">Always ENFORCE - never WARN_ONLY</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="font-medium text-green-700">GAMMA_BOOST_ALLOWED</p>
              <p className="text-sm text-muted-foreground">false - gamma never boosts during recovery</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="font-medium text-green-700">AUTO_MODIFY_DESTRUCTIVE</p>
              <p className="text-sm text-muted-foreground">false - destructive actions require confirmation</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="font-medium text-green-700">AUDIT_ALLOW_UPDATE/DELETE</p>
              <p className="text-sm text-muted-foreground">false - audit trail is append-only</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
