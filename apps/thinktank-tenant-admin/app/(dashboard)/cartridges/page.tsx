'use client';

/**
 * Think Tank Tenant Admin - Cartridge Manager
 * 
 * This page sits BEHIND the service layer. All requests are tenant-isolated.
 * The tenant can only:
 * - View system cartridges (read-only)
 * - Manage their own tenant cartridges
 * 
 * They CANNOT see other tenants' cartridges or modify system cartridges.
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package,
  Upload,
  Download,
  Layers,
  Shield,
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Lock,
  Brain,
  Eye,
  Power,
  PowerOff,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type CartridgeScope = 'system' | 'tenant' | 'user';
type CartridgeStatus = 'draft' | 'validating' | 'ready' | 'importing' | 'active' | 'archived' | 'failed';
type RadiantApp = 'radiant_admin' | 'thinktank_admin' | 'thinktank' | 'curator' | 'service_layer';

interface ClusterCompatibility {
  sourceClusterId: string;
  sourceClusterName: string;
  sourceClusterVersion: string;
  minPlatformVersion: string;
  maxPlatformVersion?: string;
  compatibleApps: RadiantApp[];
  requiredFeatures?: string[];
  environment: 'production' | 'staging' | 'development';
  intendedTenantIds?: string[];
}

interface Cartridge {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: string;
  scope: CartridgeScope;
  status: CartridgeStatus;
  domains: string[];
  hasLoraAdapters: boolean;
  hasCuratorKnowledge: boolean;
  hasGhostCompression: boolean;
  hasDomainExperts: boolean;
  allowUserOverride: boolean;
  isEnabled: boolean;
  fileSizeBytes: number;
  createdAt: string;
  createdBy: string;
  _readOnly?: boolean;
  // PKI & Compatibility (v6.1.0+)
  isSigned?: boolean;
  signedAt?: string;
  compatibility?: ClusterCompatibility;
}

interface CartridgeStackEntry {
  cartridge: Cartridge;
  position: number;
  isEnabled: boolean;
  canDisable: boolean;
  canOverride: boolean;
}

interface CartridgeStack {
  systemStack: CartridgeStackEntry[];
  tenantStack: CartridgeStackEntry[];
  userStack: CartridgeStackEntry[];
}

// =============================================================================
// API (Service Layer)
// =============================================================================

const API_BASE = '/api/v1/tenant';

async function fetchTenantCartridges() {
  const response = await fetch(`${API_BASE}/cartridges?includeSystem=true`);
  if (!response.ok) throw new Error('Failed to fetch cartridges');
  return response.json();
}

async function fetchCartridgeStack() {
  const response = await fetch(`${API_BASE}/cartridges/stack`);
  if (!response.ok) throw new Error('Failed to fetch stack');
  return response.json();
}

async function createCartridge(data: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/cartridges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create cartridge');
  }
  return response.json();
}

async function activateCartridge(id: string) {
  const response = await fetch(`${API_BASE}/cartridges/${id}/activate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to activate cartridge');
  return response.json();
}

async function deactivateCartridge(id: string) {
  const response = await fetch(`${API_BASE}/cartridges/${id}/deactivate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to deactivate cartridge');
  return response.json();
}

async function deleteCartridge(id: string) {
  const response = await fetch(`${API_BASE}/cartridges/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete cartridge');
  return response.json();
}

// =============================================================================
// Component
// =============================================================================

export default function TenantCartridgeManagerPage() {
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [systemCartridges, setSystemCartridges] = useState<Cartridge[]>([]);
  const [stack, setStack] = useState<CartridgeStack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('tenant');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cartridgeRes, stackRes] = await Promise.all([
        fetchTenantCartridges(),
        fetchCartridgeStack(),
      ]);

      setCartridges(cartridgeRes.cartridges || []);
      setSystemCartridges(cartridgeRes.systemCartridges || []);
      setStack(stackRes.stack || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActivate = async (id: string) => {
    try {
      await activateCartridge(id);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateCartridge(id);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this cartridge?')) return;
    try {
      await deleteCartridge(id);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading && cartridges.length === 0) {
    return <PageSkeleton />;
  }

  const activeCartridges = cartridges.filter(c => c.status === 'active');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="h-8 w-8 text-indigo-600" />
            Cartridge Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization&apos;s AI cartridges
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Cartridge
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Your Cartridges"
          value={cartridges.length}
          subtitle="Organization-specific"
          icon={<Building2 className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Active"
          value={activeCartridges.length}
          subtitle="Currently in use"
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          title="System Cartridges"
          value={systemCartridges.length}
          subtitle="Platform-wide (read-only)"
          icon={<Shield className="h-5 w-5" />}
          color="red"
        />
        <StatCard
          title="With AI Features"
          value={cartridges.filter(c => c.hasLoraAdapters || c.hasCuratorKnowledge).length}
          subtitle="LoRA or Curator"
          icon={<Brain className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Stack Visualization */}
      {stack && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Your Cartridge Stack
            </CardTitle>
            <CardDescription>
              System cartridges (inherited) → Your organization cartridges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              {/* System Stack (Read-Only) */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-red-600" />
                  <span className="font-medium">System (Inherited)</span>
                  <Badge variant="outline" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Read-only
                  </Badge>
                </div>
                <div className="space-y-2">
                  {!stack.systemStack || stack.systemStack.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No system cartridges</p>
                  ) : (
                    stack.systemStack.map((entry, idx) => (
                      <div
                        key={entry.cartridge.id}
                        className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {entry.cartridge.name}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            View Only
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          v{entry.cartridge.version} • {entry.cartridge.domains.length} domains
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center">
                <div className="w-8 h-0.5 bg-gray-300" />
                <div className="text-gray-400">→</div>
                <div className="w-8 h-0.5 bg-gray-300" />
              </div>

              {/* Tenant Stack (Manageable) */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Your Organization</span>
                  <Badge variant="default" className="text-xs">Manageable</Badge>
                </div>
                <div className="space-y-2">
                  {stack.tenantStack.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No organization cartridges yet
                    </p>
                  ) : (
                    stack.tenantStack.map((entry, idx) => (
                      <div
                        key={entry.cartridge.id}
                        className="p-3 rounded-lg border bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {entry.cartridge.name}
                            </span>
                            <StatusBadge status={entry.cartridge.status} />
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.cartridge.status === 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeactivate(entry.cartridge.id)}
                              >
                                <PowerOff className="h-3 w-3 mr-1" />
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleActivate(entry.cartridge.id)}
                              >
                                <Power className="h-3 w-3 mr-1" />
                                Activate
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          v{entry.cartridge.version} • {entry.cartridge.domains.length} domains
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tenant">
            <Building2 className="h-4 w-4 mr-2" />
            Your Cartridges ({cartridges.length})
          </TabsTrigger>
          <TabsTrigger value="system">
            <Shield className="h-4 w-4 mr-2" />
            System Cartridges ({systemCartridges.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenant" className="mt-4">
          {cartridges.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No cartridges yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first organization cartridge to customize AI behavior
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Cartridge
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cartridges.map((cartridge) => (
                <CartridgeCard
                  key={cartridge.id}
                  cartridge={cartridge}
                  onActivate={() => handleActivate(cartridge.id)}
                  onDeactivate={() => handleDeactivate(cartridge.id)}
                  onDelete={() => handleDelete(cartridge.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <Alert className="mb-4">
            <Lock className="h-4 w-4" />
            <AlertTitle>System Cartridges (Read-Only)</AlertTitle>
            <AlertDescription>
              These cartridges are managed by platform administrators and apply to all organizations.
              You cannot modify or disable them.
            </AlertDescription>
          </Alert>
          {systemCartridges.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No system cartridges</h3>
                <p className="text-muted-foreground">
                  Platform administrators have not deployed any system cartridges
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {systemCartridges.map((cartridge) => (
                <CartridgeCard
                  key={cartridge.id}
                  cartridge={cartridge}
                  readOnly
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <CreateCartridgeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => {
          setCreateDialogOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'purple' | 'amber';
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colors = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    red: 'text-red-600 bg-red-100',
    purple: 'text-purple-600 bg-purple-100',
    amber: 'text-amber-600 bg-amber-100',
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

function StatusBadge({ status }: { status: CartridgeStatus }) {
  const config: Record<CartridgeStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'outline' },
    validating: { label: 'Validating', variant: 'secondary' },
    ready: { label: 'Ready', variant: 'secondary' },
    importing: { label: 'Importing', variant: 'secondary' },
    active: { label: 'Active', variant: 'default' },
    archived: { label: 'Archived', variant: 'outline' },
    failed: { label: 'Failed', variant: 'destructive' },
  };

  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

interface CartridgeCardProps {
  cartridge: Cartridge;
  readOnly?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
}

function CartridgeCard({
  cartridge,
  readOnly,
  onActivate,
  onDeactivate,
  onDelete,
}: CartridgeCardProps) {
  return (
    <Card className={readOnly ? 'bg-gray-50 dark:bg-gray-900' : ''}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">{cartridge.name}</h3>
              <StatusBadge status={cartridge.status} />
              {readOnly && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Read-only
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {cartridge.description || 'No description'}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>v{cartridge.version}</span>
              <span>{cartridge.domains.length} domains</span>
              {cartridge.hasLoraAdapters && (
                <Badge variant="outline" className="text-xs">LoRA</Badge>
              )}
              {cartridge.hasCuratorKnowledge && (
                <Badge variant="outline" className="text-xs">Curator</Badge>
              )}
              {cartridge.hasGhostCompression && (
                <Badge variant="outline" className="text-xs">Ghost</Badge>
              )}
            </div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {cartridge.status === 'active' ? (
                <Button size="sm" variant="outline" onClick={onDeactivate}>
                  <PowerOff className="h-4 w-4 mr-1" />
                  Deactivate
                </Button>
              ) : cartridge.status === 'ready' ? (
                <Button size="sm" onClick={onActivate}>
                  <Power className="h-4 w-4 mr-1" />
                  Activate
                </Button>
              ) : null}
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CreateCartridgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function CreateCartridgeDialog({ open, onOpenChange, onCreated }: CreateCartridgeDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domains, setDomains] = useState('');
  const [includeLoRA, setIncludeLoRA] = useState(false);
  const [includeCurator, setIncludeCurator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name || !domains) {
      setError('Name and domains are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createCartridge({
        name,
        description,
        domains: domains.split(',').map(d => d.trim()).filter(Boolean),
        includeLoraAdapters: includeLoRA,
        includeCuratorKnowledge: includeCurator,
      });
      setName('');
      setDescription('');
      setDomains('');
      setIncludeLoRA(false);
      setIncludeCurator(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Cartridge</DialogTitle>
          <DialogDescription>
            Create a new cartridge for your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Cartridge"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domains">Domains (comma-separated)</Label>
            <Input
              id="domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="legal, finance, healthcare"
            />
          </div>

          <div className="space-y-2">
            <Label>Features</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lora"
                  checked={includeLoRA}
                  onCheckedChange={(checked) => setIncludeLoRA(checked === true)}
                />
                <label htmlFor="lora" className="text-sm">
                  Include LoRA Adapters
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="curator"
                  checked={includeCurator}
                  onCheckedChange={(checked) => setIncludeCurator(checked === true)}
                />
                <label htmlFor="curator" className="text-sm">
                  Include Curator Knowledge
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
