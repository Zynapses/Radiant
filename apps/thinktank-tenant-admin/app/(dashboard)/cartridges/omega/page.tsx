'use client';

/**
 * Think Tank Tenant Administration - OMEGA Brain Status
 *
 * Shows the current state of the tenant's OMEGA quantum brain instance,
 * cartridge sync status, and allows triggering a manual cartridge reload.
 *
 * @version 1.0.0
 * @since RADIANT v7.52.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Brain,
  RefreshCw,
  Zap,
  Activity,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Cpu,
  Database,
  Gauge,
  RotateCcw,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface OmegaBrainStatus {
  brainId: string;
  hilbertDimension: number;
  dopamine: number;
  totalCycles: number;
  loadedFirmwareId: string | null;
  helixRuleCount: number;
  cartridgeBootStatus: string;
  cartridgeBootDurationMs: number;
  firmwareEnforcementCount: number;
  softRomVersion: string | null;
  knowledgeFactCount: number;
  lastUpdated: string;
}

interface CartridgeSyncStatus {
  lastResolved: string | null;
  brainLastUpdated: string;
  isStale: boolean;
  message: string;
}

// =============================================================================
// API
// =============================================================================

const API_BASE = '/api/v1/tenant/cartridges';

async function fetchOmegaStatus() {
  const response = await fetch(`${API_BASE}/omega/status`);
  if (!response.ok) throw new Error('Failed to fetch OMEGA status');
  return response.json();
}

async function triggerOmegaReload() {
  const response = await fetch(`${API_BASE}/omega/reload`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to trigger reload');
  return response.json();
}

// =============================================================================
// Component
// =============================================================================

export default function OmegaBrainStatusPage() {
  const [omega, setOmega] = useState<OmegaBrainStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<CartridgeSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadMessage, setReloadMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchOmegaStatus();
      setOmega(result.omega || null);
      setSyncStatus(result.cartridgeSync || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReload = async () => {
    try {
      setReloading(true);
      setReloadMessage(null);
      const result = await triggerOmegaReload();
      setReloadMessage(result.message || 'Reload triggered successfully.');
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reload failed');
    } finally {
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-80" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-violet-500" />
            OMEGA Brain Status
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your tenant&apos;s OMEGA quantum brain and cartridge synchronization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleReload}
            disabled={reloading}
            variant={syncStatus?.isStale ? 'default' : 'outline'}
          >
            <RotateCcw className={`h-4 w-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
            {reloading ? 'Reloading...' : 'Reload Brain from Cartridges'}
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

      {reloadMessage && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Reload Triggered</AlertTitle>
          <AlertDescription>{reloadMessage}</AlertDescription>
        </Alert>
      )}

      {/* No Brain Instance */}
      {!omega && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No OMEGA Brain Instance</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No OMEGA brain instance has been initialized for your tenant yet.
              The brain will automatically start on the first AI request.
            </p>
          </CardContent>
        </Card>
      )}

      {omega && (
        <>
          {/* Sync Status Banner */}
          {syncStatus && (
            <Alert variant={syncStatus.isStale ? 'destructive' : 'default'}>
              {syncStatus.isStale ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {syncStatus.isStale ? 'Cartridge Stack Out of Sync' : 'Brain Synchronized'}
              </AlertTitle>
              <AlertDescription>
                {syncStatus.message}
                {syncStatus.lastResolved && (
                  <span className="block text-xs mt-1">
                    Last resolution: {new Date(syncStatus.lastResolved).toLocaleString()}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Hilbert Dimension"
              value={omega.hilbertDimension}
              subtitle="Quantum state space size"
              icon={<Cpu className="h-5 w-5" />}
              color="violet"
            />
            <StatCard
              title="Total Cycles"
              value={omega.totalCycles.toLocaleString()}
              subtitle="Inference cycles completed"
              icon={<Activity className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              title="Helix Rules"
              value={omega.helixRuleCount}
              subtitle="Active safety rules"
              icon={<Shield className="h-5 w-5" />}
              color="red"
            />
            <StatCard
              title="Knowledge Facts"
              value={omega.knowledgeFactCount.toLocaleString()}
              subtitle="Loaded from cartridges"
              icon={<Database className="h-5 w-5" />}
              color="green"
            />
          </div>

          {/* Brain Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Brain State */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-violet-400" />
                  Brain State
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <DetailRow label="Brain ID" value={omega.brainId} mono />
                  <DetailRow
                    label="Dopamine Level"
                    value={
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            style={{ width: `${Math.min(omega.dopamine * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono">{(omega.dopamine * 100).toFixed(1)}%</span>
                      </div>
                    }
                  />
                  <DetailRow
                    label="Loaded Firmware"
                    value={omega.loadedFirmwareId
                      ? <span className="font-mono text-xs">{omega.loadedFirmwareId.substring(0, 16)}...</span>
                      : <span className="text-muted-foreground">None</span>
                    }
                  />
                  <DetailRow
                    label="Soft ROM Version"
                    value={omega.softRomVersion || 'None'}
                  />
                  <DetailRow
                    label="Firmware Enforcements"
                    value={omega.firmwareEnforcementCount.toLocaleString()}
                  />
                  <DetailRow
                    label="Last Updated"
                    value={new Date(omega.lastUpdated).toLocaleString()}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Cartridge Boot Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-amber-400" />
                  Cartridge Boot Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <DetailRow
                    label="Boot Status"
                    value={
                      <Badge
                        variant={omega.cartridgeBootStatus === 'booted' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {omega.cartridgeBootStatus === 'booted' ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : omega.cartridgeBootStatus === 'failed' ? (
                          <XCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {omega.cartridgeBootStatus}
                      </Badge>
                    }
                  />
                  <DetailRow
                    label="Boot Duration"
                    value={`${omega.cartridgeBootDurationMs}ms`}
                  />
                  <DetailRow
                    label="Helix Safety Rules"
                    value={
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-red-400" />
                        {omega.helixRuleCount} active rules
                      </span>
                    }
                  />
                  <DetailRow
                    label="Knowledge Facts"
                    value={`${omega.knowledgeFactCount} facts loaded`}
                  />
                </div>

                <div className="mt-6 p-3 rounded-lg bg-slate-900/50 border border-white/10">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Cartridge Boot Sequence (8 Steps)
                  </h4>
                  <div className="space-y-1">
                    {[
                      'Load resolved cartridge state',
                      'Apply firmware (min() enforcement)',
                      'Load Q-Node weights',
                      'Initialize Helix Kernel rules',
                      'Apply Soft ROM deltas',
                      'Load knowledge facts',
                      'Initialize Ambition chemicals',
                      'Validate & finalize',
                    ].map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </span>
                        {omega.cartridgeBootStatus === 'booted' ? (
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <div className="h-3 w-3 rounded-full border border-white/20 flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'violet' | 'blue' | 'red' | 'green' | 'amber';
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colors = {
    violet: 'text-violet-500 bg-violet-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    red: 'text-red-500 bg-red-500/10',
    green: 'text-green-500 bg-green-500/10',
    amber: 'text-amber-500 bg-amber-500/10',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
