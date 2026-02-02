'use client';

/**
 * RADIANT Admin Dashboard: System Cartridge Registry
 * v6.1.0: Domain experts as system cartridges with full audit trail
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { 
  Brain, 
  Package, 
  Activity, 
  Shield, 
  Clock, 
  Upload,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  History,
  ThermometerSun,
  ThermometerSnowflake,
  Flame,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileArchive,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import type {
  SystemCartridgeDashboard,
  SystemCartridgeEntry,
  SystemCartridgeAuditEntry,
  TenantCartridgeVisibility,
  CartridgeCategory,
  CartridgeThermalState,
} from '@radiant/shared';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// =============================================================================
// API Functions
// =============================================================================

const API_BASE = '/api/admin/system-cartridges';

async function fetchDashboard(): Promise<SystemCartridgeDashboard> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function fetchCartridges(params?: {
  category?: CartridgeCategory;
  thermalState?: CartridgeThermalState;
}): Promise<{ cartridges: SystemCartridgeEntry[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.thermalState) query.set('thermalState', params.thermalState);
  
  const res = await fetch(`${API_BASE}?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch cartridges');
  return res.json();
}

async function fetchAuditLog(): Promise<{ auditLog: SystemCartridgeAuditEntry[] }> {
  const res = await fetch(`${API_BASE}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

async function fetchTenantVisibility(): Promise<{ visibility: TenantCartridgeVisibility[] }> {
  const res = await fetch(`${API_BASE}/tenant/visibility`);
  if (!res.ok) throw new Error('Failed to fetch visibility');
  return res.json();
}

async function updateVisibility(
  cartridgeId: string,
  isVisible: boolean,
  reason?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/tenant/visibility`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartridgeId, isVisible, reason }),
  });
  if (!res.ok) throw new Error('Failed to update visibility');
}

async function registerCartridge(data: {
  name: string;
  description?: string;
  category: CartridgeCategory;
  domainId?: string;
  reason?: string;
}): Promise<SystemCartridgeEntry> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, registeredVia: 'curator' }),
  });
  if (!res.ok) throw new Error('Failed to register cartridge');
  return res.json();
}

async function deleteCartridge(cartridgeId: string, reason?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${cartridgeId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to delete cartridge');
}

// =============================================================================
// Components
// =============================================================================

function ThermalStateIcon({ state }: { state: CartridgeThermalState }) {
  switch (state) {
    case 'hot':
      return <Flame className="h-4 w-4 text-red-500" />;
    case 'warm':
      return <ThermometerSun className="h-4 w-4 text-orange-500" />;
    case 'warming':
      return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    case 'cold':
    default:
      return <ThermometerSnowflake className="h-4 w-4 text-blue-500" />;
  }
}

function ThermalStateBadge({ state }: { state: CartridgeThermalState }) {
  const colors = {
    hot: 'bg-red-100 text-red-800 border-red-200',
    warm: 'bg-orange-100 text-orange-800 border-orange-200',
    warming: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cold: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <Badge variant="outline" className={colors[state]}>
      <ThermalStateIcon state={state} />
      <span className="ml-1 capitalize">{state}</span>
    </Badge>
  );
}

function CategoryBadge({ category }: { category: CartridgeCategory }) {
  if (category === 'domain_expert') {
    return (
      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
        <Brain className="h-3 w-3 mr-1" />
        Domain Expert
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
      <Package className="h-3 w-3 mr-1" />
      General
    </Badge>
  );
}

function SummaryCards({ dashboard }: { dashboard: SystemCartridgeDashboard }) {
  const { summary } = dashboard;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total System Cartridges</CardTitle>
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Thermal Distribution</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            <span className="text-sm">{summary.thermalStates.hot} hot</span>
            <ThermometerSun className="h-4 w-4 text-orange-500 ml-2" />
            <span className="text-sm">{summary.thermalStates.warm} warm</span>
            <ThermometerSnowflake className="h-4 w-4 text-blue-500 ml-2" />
            <span className="text-sm">{summary.thermalStates.cold} cold</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Recent Audit Actions</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.recentAuditActions}</div>
          <p className="text-xs text-muted-foreground">In the last 24 hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tenants with Hidden</CardTitle>
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{dashboard.tenantsWithHiddenCartridges}</div>
          <p className="text-xs text-muted-foreground">Tenants hiding cartridges</p>
        </CardContent>
      </Card>
    </div>
  );
}

function CartridgeTable({
  cartridges,
  onDelete,
  onViewAudit,
  isSuperAdmin,
}: {
  cartridges: SystemCartridgeEntry[];
  onDelete: (id: string) => void;
  onViewAudit: (id: string) => void;
  isSuperAdmin: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Thermal State</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Inferences</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cartridges.map((cartridge) => (
          <TableRow key={cartridge.id}>
            <TableCell className="font-medium">{cartridge.name}</TableCell>
            <TableCell>
              <CategoryBadge category={cartridge.category} />
            </TableCell>
            <TableCell>
              {cartridge.domainDisplayName || cartridge.domainId || '-'}
            </TableCell>
            <TableCell>
              <ThermalStateBadge state={cartridge.thermalState} />
            </TableCell>
            <TableCell>{cartridge.version}</TableCell>
            <TableCell>{cartridge.inferenceCount.toLocaleString()}</TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground">
                {new Date(cartridge.registeredAt).toLocaleDateString()}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewAudit(cartridge.id)}
                >
                  <History className="h-4 w-4" />
                </Button>
                {isSuperAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onDelete(cartridge.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AuditLogTable({ auditLog }: { auditLog: SystemCartridgeAuditEntry[] }) {
  const actionColors: Record<string, string> = {
    created: 'bg-green-100 text-green-800',
    updated: 'bg-blue-100 text-blue-800',
    deleted: 'bg-red-100 text-red-800',
    enabled: 'bg-emerald-100 text-emerald-800',
    disabled: 'bg-amber-100 text-amber-800',
    thermal_state_changed: 'bg-orange-100 text-orange-800',
    version_upgraded: 'bg-purple-100 text-purple-800',
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Cartridge ID</TableHead>
          <TableHead>Performed By</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Compliance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditLog.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-xs">
              {new Date(entry.performedAt).toLocaleString()}
            </TableCell>
            <TableCell>
              <Badge className={actionColors[entry.action] || 'bg-gray-100'}>
                {entry.action.replace(/_/g, ' ')}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {entry.cartridgeId.slice(0, 8)}...
            </TableCell>
            <TableCell>
              {entry.performedByEmail || entry.performedBy.slice(0, 8)}
            </TableCell>
            <TableCell className="max-w-[200px] truncate">
              {entry.reason || '-'}
            </TableCell>
            <TableCell>
              {entry.complianceFlags?.map((flag) => (
                <Badge key={flag} variant="outline" className="mr-1 text-xs">
                  {flag}
                </Badge>
              ))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function VisibilityTable({
  visibility,
  onToggle,
}: {
  visibility: TenantCartridgeVisibility[];
  onToggle: (cartridgeId: string, isVisible: boolean) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cartridge ID</TableHead>
          <TableHead>Visible</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Changed</TableHead>
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibility.map((v) => (
          <TableRow key={v.cartridgeId}>
            <TableCell className="font-mono text-xs">
              {v.cartridgeId.slice(0, 8)}...
            </TableCell>
            <TableCell>
              <Switch
                checked={v.isVisible}
                onCheckedChange={(checked) => onToggle(v.cartridgeId, checked)}
              />
            </TableCell>
            <TableCell>
              {v.isVisible ? (
                <Badge className="bg-green-100 text-green-800">
                  <Eye className="h-3 w-3 mr-1" />
                  Visible
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hidden
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {v.disabledAt
                ? new Date(v.disabledAt).toLocaleString()
                : v.enabledAt
                ? new Date(v.enabledAt).toLocaleString()
                : '-'}
            </TableCell>
            <TableCell className="max-w-[200px] truncate">
              {v.disabledReason || '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RegisterCartridgeDialog({
  open,
  onOpenChange,
  onRegister,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: (data: {
    name: string;
    description?: string;
    category: CartridgeCategory;
    domainId?: string;
    reason?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CartridgeCategory>('general');
  const [domainId, setDomainId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onRegister({
        name,
        description: description || undefined,
        category,
        domainId: category === 'domain_expert' ? domainId : undefined,
        reason: reason || undefined,
      });
      onOpenChange(false);
      setName('');
      setDescription('');
      setCategory('general');
      setDomainId('');
      setReason('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Register System Cartridge</DialogTitle>
          <DialogDescription>
            Create a new system cartridge. This will be available to all tenants by default.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Medical Domain Expert"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specialized neural networks for medical domain..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as CartridgeCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="domain_expert">Domain Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {category === 'domain_expert' && (
            <div className="grid gap-2">
              <Label htmlFor="domainId">Domain ID</Label>
              <Input
                id="domainId"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                placeholder="medical_cardiology"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reason">Audit Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Initial registration for production deployment"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function SystemCartridgesPage() {
  const [dashboard, setDashboard] = useState<SystemCartridgeDashboard | null>(null);
  const [cartridges, setCartridges] = useState<SystemCartridgeEntry[]>([]);
  const [auditLog, setAuditLog] = useState<SystemCartridgeAuditEntry[]>([]);
  const [visibility, setVisibility] = useState<TenantCartridgeVisibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CartridgeCategory | ''>('');
  const [thermalFilter, setThermalFilter] = useState<CartridgeThermalState | ''>('');

  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, cartridgesData, auditData, visibilityData] = await Promise.all([
        fetchDashboard(),
        fetchCartridges({
          category: categoryFilter || undefined,
          thermalState: thermalFilter || undefined,
        }),
        fetchAuditLog(),
        fetchTenantVisibility(),
      ]);
      setDashboard(dashboardData);
      setCartridges(cartridgesData.cartridges);
      setAuditLog(auditData.auditLog);
      setVisibility(visibilityData.visibility);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, thermalFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegister = async (data: {
    name: string;
    description?: string;
    category: CartridgeCategory;
    domainId?: string;
    reason?: string;
  }) => {
    await registerCartridge(data);
    loadData();
  };

  const handleDelete = async (cartridgeId: string) => {
    if (!confirm('Are you sure you want to delete this system cartridge?')) return;
    await deleteCartridge(cartridgeId, 'Admin deletion');
    loadData();
  };

  const handleToggleVisibility = async (cartridgeId: string, isVisible: boolean) => {
    await updateVisibility(cartridgeId, isVisible, isVisible ? 'Re-enabled' : 'Disabled by admin');
    loadData();
  };

  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditDialogCartridgeId, setAuditDialogCartridgeId] = useState<string | null>(null);
  const [cartridgeAuditLog, setCartridgeAuditLog] = useState<SystemCartridgeAuditEntry[]>([]);

  const handleViewAudit = async (cartridgeId: string) => {
    setAuditDialogCartridgeId(cartridgeId);
    try {
      const res = await fetch(`${API_BASE}/${cartridgeId}/audit`);
      if (res.ok) {
        const data = await res.json();
        setCartridgeAuditLog(data.auditLog || []);
      }
    } catch (err) {
      console.error('Failed to fetch cartridge audit log:', err);
      setCartridgeAuditLog([]);
    }
    setAuditDialogOpen(true);
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Cartridge Registry</h1>
          <p className="text-muted-foreground">
            Manage domain expert cartridges with full audit trail and compliance tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isSuperAdmin && (
            <Button onClick={() => setRegisterDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Register Cartridge
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {dashboard && <SummaryCards dashboard={dashboard} />}

      <Tabs defaultValue="cartridges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cartridges">
            <Package className="h-4 w-4 mr-2" />
            Cartridges
          </TabsTrigger>
          <TabsTrigger value="visibility">
            <Eye className="h-4 w-4 mr-2" />
            Tenant Visibility
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Shield className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cartridges" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Cartridges</CardTitle>
                  <CardDescription>
                    Domain expert and general cartridges available system-wide
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={categoryFilter}
                    onValueChange={(v) => setCategoryFilter(v as CartridgeCategory | '')}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      <SelectItem value="domain_expert">Domain Expert</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={thermalFilter}
                    onValueChange={(v) => setThermalFilter(v as CartridgeThermalState | '')}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All States</SelectItem>
                      <SelectItem value="hot">Hot</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="warming">Warming</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CartridgeTable
                cartridges={cartridges}
                onDelete={handleDelete}
                onViewAudit={handleViewAudit}
                isSuperAdmin={isSuperAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Visibility</CardTitle>
              <CardDescription>
                Control which system cartridges are visible to your tenant&apos;s users.
                Hidden cartridges are completely invisible to users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VisibilityTable
                visibility={visibility}
                onToggle={handleToggleVisibility}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                Complete audit trail of all system cartridge operations.
                Required for HIPAA, SOC2, and GDPR compliance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogTable auditLog={auditLog} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RegisterCartridgeDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        onRegister={handleRegister}
      />

      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cartridge Audit History</DialogTitle>
            <DialogDescription>
              Audit trail for cartridge {auditDialogCartridgeId?.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {cartridgeAuditLog.length > 0 ? (
              <AuditLogTable auditLog={cartridgeAuditLog} />
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No audit entries found for this cartridge.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
