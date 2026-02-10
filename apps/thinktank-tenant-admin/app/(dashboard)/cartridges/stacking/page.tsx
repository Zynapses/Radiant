'use client';

/**
 * Think Tank Tenant Administration - Cartridge Stacking & Resolution
 *
 * Visualizes the cartridge stacking hierarchy for this tenant, shows the
 * resolved state after all layers merge, and allows reordering tenant
 * cartridge priorities. Wired to OMEGA via EventBridge.
 *
 * Stacking Hierarchy (highest priority first):
 *   1. Soft ROM (brain's own learning)
 *   2. Tenant cartridges — REPLACES matching sections from lower layers
 *   3. Domain cartridges — fills gaps
 *   4. Base cartridges — foundation
 *   5. Firmware — safety floor, min() enforcement
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
  Layers,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Shield,
  Building2,
  Brain,
  Lock,
  FileText,
  ChevronRight,
  Zap,
  GripVertical,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface StackEntry {
  cartridgeId: string;
  name: string;
  displayName: string;
  cartridgeType: string;
  version: string;
  description: string;
  sectionsPresent: string[];
  targets: string[];
  stackPriority: number;
  installationStatus: string;
  installedAt: string;
  totalSizeBytes: number;
  isSystem: boolean;
}

interface HierarchyLayer {
  layer: string;
  description: string;
  editable: boolean;
}

interface ResolvedState {
  firmware: Record<string, unknown>;
  sections: Record<string, { cartridge_id: string; cartridge_name: string; cartridge_type: string; priority: number }>;
  resolutionLog: string[];
  resolvedAt: string;
}

// =============================================================================
// API
// =============================================================================

const API_BASE = '/api/v1/tenant/cartridges';

async function fetchStack() {
  const response = await fetch(`${API_BASE}/stack`);
  if (!response.ok) throw new Error('Failed to fetch stack');
  return response.json();
}

async function fetchResolved() {
  const response = await fetch(`${API_BASE}/resolved`);
  if (!response.ok) throw new Error('Failed to fetch resolved state');
  return response.json();
}

async function triggerResolution() {
  const response = await fetch(`${API_BASE}/resolve`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to trigger resolution');
  return response.json();
}

async function reorderStack(order: Array<{ cartridgeId: string; priority: number }>) {
  const response = await fetch(`${API_BASE}/stack/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  if (!response.ok) throw new Error('Failed to reorder stack');
  return response.json();
}

// =============================================================================
// Component
// =============================================================================

export default function StackingResolutionPage() {
  const [systemStack, setSystemStack] = useState<StackEntry[]>([]);
  const [tenantStack, setTenantStack] = useState<StackEntry[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyLayer[]>([]);
  const [resolved, setResolved] = useState<ResolvedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stackRes, resolvedRes] = await Promise.all([
        fetchStack(),
        fetchResolved(),
      ]);
      setSystemStack(stackRes.stack?.systemStack || []);
      setTenantStack(stackRes.stack?.tenantStack || []);
      setHierarchy(stackRes.hierarchy || []);
      setResolved(resolvedRes.resolved || null);
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

  const handleResolve = async () => {
    try {
      setResolving(true);
      const result = await triggerResolution();
      setResolved(result.resolved || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newStack = [...tenantStack];
    const temp = newStack[index - 1];
    newStack[index - 1] = newStack[index];
    newStack[index] = temp;

    const order = newStack.map((entry, idx) => ({
      cartridgeId: entry.cartridgeId,
      priority: 200 - idx,
    }));

    try {
      await reorderStack(order);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= tenantStack.length - 1) return;
    const newStack = [...tenantStack];
    const temp = newStack[index + 1];
    newStack[index + 1] = newStack[index];
    newStack[index] = temp;

    const order = newStack.map((entry, idx) => ({
      cartridgeId: entry.cartridgeId,
      priority: 200 - idx,
    }));

    try {
      await reorderStack(order);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Layers className="h-8 w-8 text-violet-500" />
            Stacking &amp; Resolution
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize and manage your cartridge stacking hierarchy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleResolve} disabled={resolving}>
            <Zap className={`h-4 w-4 mr-2 ${resolving ? 'animate-pulse' : ''}`} />
            {resolving ? 'Resolving...' : 'Re-resolve Stack'}
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

      {/* Stacking Hierarchy Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Cartridge Stacking Hierarchy
          </CardTitle>
          <CardDescription>
            Higher layers override lower layers. Tenant cartridges REPLACE matching sections.
            Firmware uses min() — safety can only be tightened, never loosened.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {hierarchy.map((layer, idx) => (
              <div key={layer.layer} className="flex items-center gap-3">
                <div className="w-8 text-center text-xs font-mono text-muted-foreground">
                  {idx + 1}
                </div>
                <div
                  className={`flex-1 p-3 rounded-lg border ${
                    layer.editable
                      ? 'border-violet-500/50 bg-violet-500/5'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {layer.editable ? (
                        <Building2 className="h-4 w-4 text-violet-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-500" />
                      )}
                      <span className="font-medium text-sm">{layer.layer}</span>
                      {layer.editable && (
                        <Badge variant="default" className="text-xs">You control this</Badge>
                      )}
                    </div>
                    {idx < hierarchy.length - 1 && (
                      <span className="text-xs text-muted-foreground">overrides ↓</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{layer.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Cartridges (Read-Only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-red-400" />
              System Cartridges
              <Badge variant="outline" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Read-only
              </Badge>
            </CardTitle>
            <CardDescription>
              Platform-wide cartridges managed by administrators. Cannot be modified or removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemStack.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No system cartridges installed
              </p>
            ) : (
              <div className="space-y-2">
                {systemStack.map((entry, idx) => (
                  <div
                    key={entry.cartridgeId}
                    className="p-3 rounded-lg border border-white/10 bg-slate-900/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">
                          P{entry.stackPriority}
                        </span>
                        <span className="font-medium text-sm">{entry.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{entry.cartridgeType}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>v{entry.version}</span>
                      <span>{entry.sectionsPresent.length} sections</span>
                      <span>{entry.targets.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant Cartridges (Reorderable) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-violet-400" />
              Your Tenant Cartridges
              <Badge variant="default" className="text-xs">Reorderable</Badge>
            </CardTitle>
            <CardDescription>
              Drag to reorder. Higher priority cartridges override lower ones for matching sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenantStack.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No tenant cartridges installed. Install cartridges from the Cartridges page.
              </p>
            ) : (
              <div className="space-y-2">
                {tenantStack.map((entry, idx) => (
                  <div
                    key={entry.cartridgeId}
                    className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-mono text-violet-400 w-6">
                          P{entry.stackPriority}
                        </span>
                        <span className="font-medium text-sm">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={idx === tenantStack.length - 1}
                          onClick={() => handleMoveDown(idx)}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>v{entry.version}</span>
                      <Badge variant="outline" className="text-xs">{entry.cartridgeType}</Badge>
                      <span>{entry.sectionsPresent.length} sections</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resolution Result */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            Resolved State
          </CardTitle>
          <CardDescription>
            The effective cartridge configuration after all layers are merged.
            {resolved?.resolvedAt && (
              <span className="ml-2 text-xs">
                Last resolved: {new Date(resolved.resolvedAt).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!resolved ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No resolution data yet.</p>
              <Button onClick={handleResolve} className="mt-3" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Run Resolution
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Section Sources */}
              <div>
                <h4 className="text-sm font-medium mb-2">Section Sources</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(resolved.sections).map(([section, source]) => (
                    <div
                      key={section}
                      className="p-2 rounded border border-white/10 bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-medium">{section}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {source.cartridge_name}
                        <span className="ml-1 text-violet-400">({source.cartridge_type})</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Firmware Contributing Cartridges */}
              {resolved.firmware?.contributing_cartridges && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Firmware Contributors</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(resolved.firmware.contributing_cartridges as string[]).map((id) => (
                      <Badge key={id} variant="outline" className="text-xs font-mono">
                        <Shield className="h-3 w-3 mr-1" />
                        {id.substring(0, 8)}...
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Firmware merges use min() — the most restrictive threshold always wins.
                  </p>
                </div>
              )}

              {/* Resolution Log */}
              {resolved.resolutionLog && resolved.resolutionLog.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Resolution Log</h4>
                  <div className="max-h-48 overflow-y-auto rounded border border-white/10 bg-slate-950 p-3">
                    <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                      {resolved.resolutionLog.join('\n')}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
