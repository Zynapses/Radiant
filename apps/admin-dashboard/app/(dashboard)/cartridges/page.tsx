'use client';

/**
 * RADIANT Cartridge Manager
 * Dashboard for managing portable AI brains (.RADz files)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package,
  Upload,
  Download,
  Layers,
  Shield,
  Users,
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  FileArchive,
  Brain,
  Database,
  Ghost,
  Network,
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
  userId?: string;
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
  effectiveCartridge?: {
    domains: string[];
    cortexVersions: Record<string, string>;
    loraAdapters: string[];
    goldenRulesCount: number;
    safetyMatrixEntriesCount: number;
  };
}

// =============================================================================
// Component
// =============================================================================

export default function CartridgeManagerPage() {
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [stack, setStack] = useState<CartridgeStack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const fetchCartridges = useCallback(async () => {
    try {
      setLoading(true);
      const [cartridgeRes, stackRes] = await Promise.all([
        fetch('/api/admin/cartridges'),
        fetch('/api/admin/cartridges/stack'),
      ]);

      if (cartridgeRes.ok) {
        const data = await cartridgeRes.json();
        setCartridges(data.cartridges || []);
      }

      if (stackRes.ok) {
        const data = await stackRes.json();
        setStack(data.stack || null);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCartridges();
  }, [fetchCartridges]);

  const toggleCartridge = async (cartridgeId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/cartridges/${cartridgeId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle cartridge');
      }

      fetchCartridges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    }
  };

  const archiveCartridge = async (cartridgeId: string) => {
    if (!confirm('Are you sure you want to archive this cartridge?')) return;

    try {
      const response = await fetch(`/api/admin/cartridges/${cartridgeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to archive cartridge');
      }

      fetchCartridges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  if (loading && cartridges.length === 0) {
    return <PageSkeleton />;
  }

  const systemCartridges = cartridges.filter(c => c.scope === 'system');
  const tenantCartridges = cartridges.filter(c => c.scope === 'tenant');
  const userCartridges = cartridges.filter(c => c.scope === 'user');

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
            Portable AI Brains (.RADz files)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchCartridges} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setImportDialogOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
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
          title="Total Cartridges"
          value={cartridges.length}
          subtitle={`${systemCartridges.length} system, ${tenantCartridges.length} tenant, ${userCartridges.length} user`}
          icon={<Package className="h-5 w-5" />}
          color="indigo"
        />
        <StatCard
          title="Active Cartridges"
          value={cartridges.filter(c => c.status === 'active').length}
          subtitle="Currently in use"
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          title="With LoRA Adapters"
          value={cartridges.filter(c => c.hasLoraAdapters).length}
          subtitle="Fine-tuned models"
          icon={<Brain className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="With Curator Knowledge"
          value={cartridges.filter(c => c.hasCuratorKnowledge).length}
          subtitle="Safety rules & ontology"
          icon={<Shield className="h-5 w-5" />}
          color="amber"
        />
      </div>

      {/* Stack Visualization */}
      {stack && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Cartridge Stack
            </CardTitle>
            <CardDescription>
              Resolution order: System (platform) → Tenant (organization) → User (personal)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {/* System Stack */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-red-600" />
                  <span className="font-medium">System Stack</span>
                  <Badge variant="destructive">Platform-wide</Badge>
                </div>
                <div className="space-y-2">
                  {!stack.systemStack || stack.systemStack.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No system cartridges</p>
                  ) : (
                    stack.systemStack.map((entry, idx) => (
                      <StackEntryCard key={entry.cartridge.id} entry={entry} index={idx} />
                    ))
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center">
                <div className="w-6 h-0.5 bg-gray-300" />
                <div className="text-gray-400">→</div>
                <div className="w-6 h-0.5 bg-gray-300" />
              </div>

              {/* Tenant Stack */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Tenant Stack</span>
                  <Badge variant="secondary">Cannot disable</Badge>
                </div>
                <div className="space-y-2">
                  {stack.tenantStack.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tenant cartridges</p>
                  ) : (
                    stack.tenantStack.map((entry, idx) => (
                      <StackEntryCard key={entry.cartridge.id} entry={entry} index={idx} />
                    ))
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center">
                <div className="w-6 h-0.5 bg-gray-300" />
                <div className="text-gray-400">→</div>
                <div className="w-6 h-0.5 bg-gray-300" />
              </div>

              {/* User Stack */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="font-medium">User Stack</span>
                  <Badge variant="outline">Can toggle</Badge>
                </div>
                <div className="space-y-2">
                  {stack.userStack.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No user cartridges</p>
                  ) : (
                    stack.userStack.map((entry, idx) => (
                      <StackEntryCard
                        key={entry.cartridge.id}
                        entry={entry}
                        index={idx}
                        onToggle={(enabled) => toggleCartridge(entry.cartridge.id, enabled)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Effective Summary */}
            {stack.effectiveCartridge && (
              <div className="mt-6 pt-4 border-t">
                <div className="text-sm font-medium mb-2">Effective Configuration</div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Domains:</span>
                    <span className="ml-2 font-mono">{stack.effectiveCartridge.domains.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LoRA Adapters:</span>
                    <span className="ml-2 font-mono">{stack.effectiveCartridge.loraAdapters.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Golden Rules:</span>
                    <span className="ml-2 font-mono">{stack.effectiveCartridge.goldenRulesCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Safety Matrix:</span>
                    <span className="ml-2 font-mono">{stack.effectiveCartridge.safetyMatrixEntriesCount}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cartridge List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({cartridges.length})
          </TabsTrigger>
          <TabsTrigger value="tenant">
            <Building2 className="h-4 w-4 mr-1" />
            Tenant ({tenantCartridges.length})
          </TabsTrigger>
          <TabsTrigger value="user">
            <Users className="h-4 w-4 mr-1" />
            User ({userCartridges.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <CartridgeList
            cartridges={cartridges}
            onToggle={toggleCartridge}
            onArchive={archiveCartridge}
          />
        </TabsContent>
        <TabsContent value="tenant" className="mt-4">
          <CartridgeList
            cartridges={tenantCartridges}
            onToggle={toggleCartridge}
            onArchive={archiveCartridge}
          />
        </TabsContent>
        <TabsContent value="user" className="mt-4">
          <CartridgeList
            cartridges={userCartridges}
            onToggle={toggleCartridge}
            onArchive={archiveCartridge}
          />
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={async (options) => {
          try {
            const response = await fetch('/api/admin/cartridges/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options),
            });

            if (!response.ok) throw new Error('Export failed');

            const data = await response.json();
            window.open(data.downloadUrl, '_blank');
            setExportDialogOpen(false);
            fetchCartridges();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
          }
        }}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={async (options) => {
          try {
            const response = await fetch('/api/admin/cartridges/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options),
            });

            if (!response.ok) throw new Error('Import failed');

            setImportDialogOpen(false);
            fetchCartridges();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
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
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-600 bg-indigo-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    amber: 'text-amber-600 bg-amber-50',
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

function StackEntryCard({
  entry,
  index,
  onToggle,
}: {
  entry: CartridgeStackEntry;
  index: number;
  onToggle?: (enabled: boolean) => void;
}) {
  const { cartridge, isEnabled, canDisable } = entry;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        isEnabled ? 'bg-white' : 'bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
        <div>
          <span className="font-medium text-sm">{cartridge.name}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{cartridge.version}</Badge>
            {cartridge.hasLoraAdapters && <Brain className="h-3 w-3 text-purple-500" />}
            {cartridge.hasCuratorKnowledge && <Shield className="h-3 w-3 text-amber-500" />}
            {cartridge.hasGhostCompression && <Ghost className="h-3 w-3 text-blue-500" />}
          </div>
        </div>
      </div>
      {canDisable && onToggle && (
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggle}
        />
      )}
    </div>
  );
}

function CartridgeList({
  cartridges,
  onToggle,
  onArchive,
}: {
  cartridges: Cartridge[];
  onToggle: (id: string, enabled: boolean) => void;
  onArchive: (id: string) => void;
}) {
  const statusConfig: Record<CartridgeStatus, { icon: React.ReactNode; color: string }> = {
    draft: { icon: <Clock className="h-4 w-4" />, color: 'text-gray-500' },
    validating: { icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: 'text-blue-500' },
    ready: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
    importing: { icon: <Upload className="h-4 w-4 animate-pulse" />, color: 'text-blue-500' },
    active: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
    archived: { icon: <Archive className="h-4 w-4" />, color: 'text-gray-400' },
    failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (cartridges.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No cartridges found</p>
        <p className="text-sm mt-1">Export or import a cartridge to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cartridges.map((cartridge) => {
        const status = statusConfig[cartridge.status];
        return (
          <Card key={cartridge.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${cartridge.scope === 'tenant' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    {cartridge.scope === 'tenant' ? (
                      <Building2 className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Users className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cartridge.name}</span>
                      <Badge variant="outline">{cartridge.version}</Badge>
                      <div className={status.color}>{status.icon}</div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span>{cartridge.domains.length} domains</span>
                      <span>•</span>
                      <span>{formatSize(cartridge.fileSizeBytes)}</span>
                      {cartridge.hasLoraAdapters && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Brain className="h-3 w-3" /> LoRA
                          </span>
                        </>
                      )}
                      {cartridge.hasCuratorKnowledge && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" /> Curator
                          </span>
                        </>
                      )}
                      {cartridge.hasGhostCompression && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Ghost className="h-3 w-3" /> Ghost
                          </span>
                        </>
                      )}
                      {cartridge.hasDomainExperts && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Network className="h-3 w-3" /> Experts
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {cartridge.scope === 'user' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`toggle-${cartridge.id}`} className="text-sm">
                        {cartridge.isEnabled ? 'Enabled' : 'Disabled'}
                      </Label>
                      <Switch
                        id={`toggle-${cartridge.id}`}
                        checked={cartridge.isEnabled}
                        onCheckedChange={(checked) => onToggle(cartridge.id, checked)}
                      />
                    </div>
                  )}
                  {cartridge.scope === 'tenant' && (
                    <Badge variant="secondary">Always Active</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onArchive(cartridge.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ExportDialog({
  open,
  onOpenChange,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: {
    scope: CartridgeScope;
    domains: string[];
    includeLora: boolean;
    includeCurator: boolean;
    includeGhost: boolean;
    includeDomainExperts: boolean;
  }) => void;
}) {
  const [scope, setScope] = useState<CartridgeScope>('tenant');
  const [includeLora, setIncludeLora] = useState(true);
  const [includeCurator, setIncludeCurator] = useState(true);
  const [includeGhost, setIncludeGhost] = useState(false);
  const [includeDomainExperts, setIncludeDomainExperts] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Cartridge
          </DialogTitle>
          <DialogDescription>
            Export a portable AI brain as a .RADz file
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as CartridgeScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant">Tenant (organization-wide)</SelectItem>
                <SelectItem value="user">User (personal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Include Components</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lora"
                  checked={includeLora}
                  onCheckedChange={(c) => setIncludeLora(!!c)}
                />
                <Label htmlFor="lora" className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  LoRA Adapters
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="curator"
                  checked={includeCurator}
                  onCheckedChange={(c) => setIncludeCurator(!!c)}
                />
                <Label htmlFor="curator" className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  Curator Knowledge
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ghost"
                  checked={includeGhost}
                  onCheckedChange={(c) => setIncludeGhost(!!c)}
                />
                <Label htmlFor="ghost" className="flex items-center gap-2">
                  <Ghost className="h-4 w-4 text-blue-500" />
                  Ghost Compression
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="experts"
                  checked={includeDomainExperts}
                  onCheckedChange={(c) => setIncludeDomainExperts(!!c)}
                />
                <Label htmlFor="experts" className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-green-500" />
                  Domain Expert Networks
                </Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onExport({
                scope,
                domains: ['all'],
                includeLora,
                includeCurator,
                includeGhost,
                includeDomainExperts,
              })
            }
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (options: {
    scope: CartridgeScope;
    fileKey: string;
    mergeStrategy: 'replace' | 'merge';
    activateImmediately: boolean;
  }) => void;
}) {
  const [scope, setScope] = useState<CartridgeScope>('tenant');
  const [fileKey, setFileKey] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState<'replace' | 'merge'>('replace');
  const [activateImmediately, setActivateImmediately] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Cartridge
          </DialogTitle>
          <DialogDescription>
            Import a portable AI brain from a .RADz file
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as CartridgeScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant">Tenant (organization-wide)</SelectItem>
                <SelectItem value="user">User (personal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File Key (S3)</Label>
            <Input
              value={fileKey}
              onChange={(e) => setFileKey(e.target.value)}
              placeholder="uploads/cartridge.radz"
            />
            <p className="text-xs text-muted-foreground">
              Upload the .RADz file first, then enter the S3 key
            </p>
          </div>

          <div className="space-y-2">
            <Label>Merge Strategy</Label>
            <Select value={mergeStrategy} onValueChange={(v) => setMergeStrategy(v as 'replace' | 'merge')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace existing</SelectItem>
                <SelectItem value="merge">Merge with existing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="activate"
              checked={activateImmediately}
              onCheckedChange={(c) => setActivateImmediately(!!c)}
            />
            <Label htmlFor="activate">Activate immediately after import</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onImport({
                scope,
                fileKey,
                mergeStrategy,
                activateImmediately,
              })
            }
            disabled={!fileKey}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
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
      <Skeleton className="h-48" />
    </div>
  );
}
