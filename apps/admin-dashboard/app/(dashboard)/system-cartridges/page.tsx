'use client';

/**
 * RADIANT System Cartridge Registry
 * Admin dashboard for managing domain expert cartridges with compliance audit trail
 * 
 * v6.1.0: Domain experts as system cartridges
 * - System-wide registry with full audit trail
 * - Tenant visibility toggles (default enabled)
 * - Thermal state management
 * - HIPAA/SOC2/GDPR compliance
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  Upload,
  Brain,
  Shield,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Thermometer,
  History,
  AlertTriangle,
  CheckCircle,
  Clock,
  Flame,
  Snowflake,
  Sun,
  FileUp,
  Users,
  Building2,
  Activity,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// =============================================================================
// Types
// =============================================================================

type CartridgeCategory = 'general' | 'domain_expert';
type CartridgeThermalState = 'cold' | 'warming' | 'warm' | 'hot';
type AuditAction = 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled' | 'thermal_state_changed' | 'version_upgraded';

interface SystemCartridge {
  id: string;
  name: string;
  description?: string;
  version: string;
  category: CartridgeCategory;
  domainId?: string;
  domainDisplayName?: string;
  thermalState: CartridgeThermalState;
  thermalStateChangedAt?: string;
  inferenceCount: number;
  lastInferenceAt?: string;
  registeredAt: string;
  registeredBy: string;
  registeredVia: 'radz_import' | 'curator';
  complianceReviewedAt?: string;
  complianceNotes?: string;
}

interface AuditEntry {
  id: string;
  cartridgeId: string;
  action: AuditAction;
  performedBy: string;
  performedByEmail?: string;
  performedAt: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;
  complianceFlags?: string[];
}

interface TenantVisibility {
  cartridgeId: string;
  cartridgeName: string;
  isVisible: boolean;
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
}

interface DashboardSummary {
  totalSystemCartridges: number;
  totalDomainExperts: number;
  totalGeneralCartridges: number;
  thermalStates: {
    cold: number;
    warming: number;
    warm: number;
    hot: number;
  };
  recentAuditActions: number;
  tenantsWithHiddenCartridges: number;
}

// =============================================================================
// API Functions
// =============================================================================

const API_BASE = '/api/admin/system-cartridges';

async function fetchDashboard(): Promise<{ summary: DashboardSummary; cartridges: SystemCartridge[]; recentAudit: AuditEntry[] }> {
  const response = await fetch(`${API_BASE}/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch dashboard');
  return response.json();
}

async function fetchCartridges(filters?: { category?: CartridgeCategory; thermalState?: CartridgeThermalState }): Promise<{ cartridges: SystemCartridge[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.thermalState) params.set('thermalState', filters.thermalState);
  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch cartridges');
  return response.json();
}

async function fetchAuditLog(cartridgeId?: string): Promise<AuditEntry[]> {
  const url = cartridgeId ? `${API_BASE}/${cartridgeId}/audit` : `${API_BASE}/audit`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch audit log');
  const data = await response.json();
  return data.entries || [];
}

async function fetchTenantVisibility(): Promise<TenantVisibility[]> {
  const response = await fetch(`${API_BASE}/tenant/visibility`);
  if (!response.ok) throw new Error('Failed to fetch visibility');
  return response.json();
}

async function updateTenantVisibility(cartridgeId: string, isVisible: boolean, reason?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tenant/visibility`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartridgeId, isVisible, reason }),
  });
  if (!response.ok) throw new Error('Failed to update visibility');
}

async function deleteCartridge(cartridgeId: string, reason: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${cartridgeId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error('Failed to delete cartridge');
}

// =============================================================================
// Helper Components
// =============================================================================

function ThermalBadge({ state }: { state: CartridgeThermalState }) {
  const config = {
    cold: { icon: Snowflake, color: 'bg-blue-100 text-blue-800', label: 'Cold' },
    warming: { icon: Sun, color: 'bg-yellow-100 text-yellow-800', label: 'Warming' },
    warm: { icon: Thermometer, color: 'bg-orange-100 text-orange-800', label: 'Warm' },
    hot: { icon: Flame, color: 'bg-red-100 text-red-800', label: 'Hot' },
  };
  const { icon: Icon, color, label } = config[state];
  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: CartridgeCategory }) {
  if (category === 'domain_expert') {
    return (
      <Badge variant="outline" className="bg-purple-100 text-purple-800 gap-1">
        <Brain className="h-3 w-3" />
        Domain Expert
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-100 text-gray-800 gap-1">
      <Package className="h-3 w-3" />
      General
    </Badge>
  );
}

function AuditActionBadge({ action }: { action: AuditAction }) {
  const config: Record<AuditAction, { color: string; label: string }> = {
    created: { color: 'bg-green-100 text-green-800', label: 'Created' },
    updated: { color: 'bg-blue-100 text-blue-800', label: 'Updated' },
    deleted: { color: 'bg-red-100 text-red-800', label: 'Deleted' },
    enabled: { color: 'bg-emerald-100 text-emerald-800', label: 'Enabled' },
    disabled: { color: 'bg-amber-100 text-amber-800', label: 'Disabled' },
    thermal_state_changed: { color: 'bg-orange-100 text-orange-800', label: 'Thermal Change' },
    version_upgraded: { color: 'bg-indigo-100 text-indigo-800', label: 'Upgraded' },
  };
  const { color, label } = config[action];
  return <Badge variant="outline" className={color}>{label}</Badge>;
}

function ComplianceBadges({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null;
  return (
    <div className="flex gap-1">
      {flags.map(flag => (
        <Badge key={flag} variant="outline" className="bg-slate-100 text-slate-700 text-xs">
          <Shield className="h-2 w-2 mr-1" />
          {flag}
        </Badge>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SystemCartridgesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cartridges, setCartridges] = useState<SystemCartridge[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [tenantVisibility, setTenantVisibility] = useState<TenantVisibility[]>([]);
  const [activeTab, setActiveTab] = useState('cartridges');
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CartridgeCategory | 'all'>('all');
  const [thermalFilter, setThermalFilter] = useState<CartridgeThermalState | 'all'>('all');
  
  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cartridgeToDelete, setCartridgeToDelete] = useState<SystemCartridge | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [visibilityCartridge, setVisibilityCartridge] = useState<TenantVisibility | null>(null);
  const [visibilityReason, setVisibilityReason] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDashboard();
      setSummary(data.summary);
      setCartridges(data.cartridges);
      setAuditLog(data.recentAudit);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadCartridges = useCallback(async () => {
    try {
      const filters: { category?: CartridgeCategory; thermalState?: CartridgeThermalState } = {};
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      if (thermalFilter !== 'all') filters.thermalState = thermalFilter;
      const data = await fetchCartridges(filters);
      setCartridges(data.cartridges);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load cartridges',
        variant: 'destructive',
      });
    }
  }, [categoryFilter, thermalFilter, toast]);

  const loadTenantVisibility = useCallback(async () => {
    try {
      const data = await fetchTenantVisibility();
      setTenantVisibility(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load visibility settings',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadAuditLog = useCallback(async () => {
    try {
      const entries = await fetchAuditLog();
      setAuditLog(entries);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load audit log',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === 'cartridges') {
      loadCartridges();
    } else if (activeTab === 'visibility') {
      loadTenantVisibility();
    } else if (activeTab === 'audit') {
      loadAuditLog();
    }
  }, [activeTab, loadCartridges, loadTenantVisibility, loadAuditLog]);

  const handleDelete = async () => {
    if (!cartridgeToDelete || !deleteReason.trim()) return;
    try {
      await deleteCartridge(cartridgeToDelete.id, deleteReason);
      toast({
        title: 'Cartridge Deleted',
        description: `${cartridgeToDelete.name} has been archived`,
      });
      setDeleteDialogOpen(false);
      setCartridgeToDelete(null);
      setDeleteReason('');
      loadDashboard();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete cartridge',
        variant: 'destructive',
      });
    }
  };

  const handleVisibilityToggle = async () => {
    if (!visibilityCartridge) return;
    try {
      await updateTenantVisibility(
        visibilityCartridge.cartridgeId,
        !visibilityCartridge.isVisible,
        visibilityReason
      );
      toast({
        title: 'Visibility Updated',
        description: `${visibilityCartridge.cartridgeName} is now ${!visibilityCartridge.isVisible ? 'visible' : 'hidden'}`,
      });
      setVisibilityDialogOpen(false);
      setVisibilityCartridge(null);
      setVisibilityReason('');
      loadTenantVisibility();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update visibility',
        variant: 'destructive',
      });
    }
  };

  if (loading && !summary) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
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
          <h1 className="text-3xl font-bold tracking-tight">System Cartridge Registry</h1>
          <p className="text-muted-foreground">
            Manage domain expert cartridges with compliance audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Import RADz
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Cartridges</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalSystemCartridges}</div>
              <p className="text-xs text-muted-foreground">
                {summary.totalDomainExperts} domain experts, {summary.totalGeneralCartridges} general
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Thermal Distribution</CardTitle>
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-red-100">
                  <Flame className="h-3 w-3 mr-1" /> {summary.thermalStates.hot}
                </Badge>
                <Badge variant="outline" className="bg-orange-100">
                  <Thermometer className="h-3 w-3 mr-1" /> {summary.thermalStates.warm}
                </Badge>
                <Badge variant="outline" className="bg-blue-100">
                  <Snowflake className="h-3 w-3 mr-1" /> {summary.thermalStates.cold}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recent Audit Actions</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.recentAuditActions}</div>
              <p className="text-xs text-muted-foreground">In the last 24 hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hidden by Tenants</CardTitle>
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.tenantsWithHiddenCartridges}</div>
              <p className="text-xs text-muted-foreground">Tenants with hidden cartridges</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compliance Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Compliance Tracking Active</AlertTitle>
        <AlertDescription>
          All actions are logged for HIPAA, SOC2, and GDPR compliance. Audit logs are retained for 7 years.
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cartridges" className="gap-2">
            <Package className="h-4 w-4" />
            Cartridges
          </TabsTrigger>
          <TabsTrigger value="visibility" className="gap-2">
            <Eye className="h-4 w-4" />
            Tenant Visibility
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Cartridges Tab */}
        <TabsContent value="cartridges" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as CartridgeCategory | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="domain_expert">Domain Expert</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={thermalFilter}
              onValueChange={(v) => setThermalFilter(v as CartridgeThermalState | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Thermal State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="warming">Warming</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cartridges Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Thermal</TableHead>
                  <TableHead>Inferences</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartridges.map(cartridge => (
                  <TableRow key={cartridge.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{cartridge.name}</div>
                        <div className="text-sm text-muted-foreground">v{cartridge.version}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={cartridge.category} />
                    </TableCell>
                    <TableCell>
                      {cartridge.domainDisplayName || cartridge.domainId || '-'}
                    </TableCell>
                    <TableCell>
                      <ThermalBadge state={cartridge.thermalState} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {cartridge.inferenceCount.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(cartridge.registeredAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        via {cartridge.registeredVia}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCartridgeToDelete(cartridge);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cartridges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No system cartridges found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tenant Visibility Tab */}
        <TabsContent value="visibility" className="space-y-4">
          <Alert>
            <Building2 className="h-4 w-4" />
            <AlertTitle>Tenant Visibility Settings</AlertTitle>
            <AlertDescription>
              Toggle visibility of system cartridges for your tenant. Hidden cartridges are completely invisible to users.
            </AlertDescription>
          </Alert>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cartridge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Changed</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantVisibility.map(item => (
                  <TableRow key={item.cartridgeId}>
                    <TableCell className="font-medium">{item.cartridgeName}</TableCell>
                    <TableCell>
                      {item.isVisible ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 gap-1">
                          <Eye className="h-3 w-3" />
                          Visible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 gap-1">
                          <EyeOff className="h-3 w-3" />
                          Hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.disabledAt ? new Date(item.disabledAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.disabledReason || '-'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.isVisible}
                        onCheckedChange={() => {
                          setVisibilityCartridge(item);
                          setVisibilityDialogOpen(true);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {tenantVisibility.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      All system cartridges are visible by default
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Complete history of all system cartridge operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cartridge</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {new Date(entry.performedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <AuditActionBadge action={entry.action} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.cartridgeId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {entry.performedByEmail || entry.performedBy}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.reason || '-'}
                      </TableCell>
                      <TableCell>
                        <ComplianceBadges flags={entry.complianceFlags} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {auditLog.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No audit entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete System Cartridge
            </DialogTitle>
            <DialogDescription>
              This will archive &quot;{cartridgeToDelete?.name}&quot;. A reason is required for audit compliance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for deletion</label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Enter reason for compliance audit..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!deleteReason.trim()}
            >
              Delete Cartridge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visibility Toggle Dialog */}
      <Dialog open={visibilityDialogOpen} onOpenChange={setVisibilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {visibilityCartridge?.isVisible ? (
                <>
                  <EyeOff className="h-5 w-5" />
                  Hide Cartridge
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  Show Cartridge
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {visibilityCartridge?.isVisible
                ? `Hide "${visibilityCartridge?.cartridgeName}" from all users in your tenant.`
                : `Make "${visibilityCartridge?.cartridgeName}" visible to users in your tenant.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional for audit)</label>
              <Textarea
                value={visibilityReason}
                onChange={(e) => setVisibilityReason(e.target.value)}
                placeholder="Enter reason for audit trail..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisibilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVisibilityToggle}>
              {visibilityCartridge?.isVisible ? 'Hide' : 'Show'} Cartridge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
