'use client';

/**
 * RADIANT Admin Dashboard - Tenant Management Page
 * Complete implementation with no stubs
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2,
  Users,
  Trash2,
  RotateCcw,
  Plus,
  Clock,
  Shield,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  UserPlus,
  Mail,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// TYPES
// ============================================================================

interface TenantSummary {
  id: string;
  name: string;
  displayName: string;
  type: 'organization' | 'individual';
  status: 'active' | 'suspended' | 'pending' | 'pending_deletion' | 'deleted';
  tier: number;
  primaryRegion: string;
  complianceMode: string[];
  retentionDays: number;
  deletionScheduledAt: string | null;
  stripeCustomerId: string | null;
  activeUsers: number;
  suspendedUsers: number;
  invitedUsers: number;
  owners: number;
  admins: number;
  createdAt: string;
  updatedAt: string;
}

interface ListTenantsResult {
  tenants: TenantSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface CreateTenantInput {
  name: string;
  displayName: string;
  type: 'organization' | 'individual';
  tier: number;
  primaryRegion: string;
  complianceMode: string[];
  retentionDays?: number;
  adminEmail: string;
  adminName: string;
  domain?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchTenants(params: {
  status?: string;
  type?: string;
  tier?: number;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: string;
}): Promise<ListTenantsResult> {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const response = await fetch(`/api/admin/tenants?${queryParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch tenants');
  }
  const result = await response.json();
  return result.data;
}

async function createTenant(input: CreateTenantInput): Promise<{ tenant: TenantSummary }> {
  const response = await fetch('/api/admin/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create tenant');
  }
  return response.json();
}

async function softDeleteTenant(tenantId: string, reason: string): Promise<void> {
  const response = await fetch(`/api/admin/tenants/${tenantId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, notifyUsers: true }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete tenant');
  }
}

async function requestRestoreCode(tenantId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenants/${tenantId}/restore/request-code`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to request restore code');
  }
}

async function restoreTenant(tenantId: string, verificationCode: string): Promise<void> {
  const response = await fetch(`/api/admin/tenants/${tenantId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationCode }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to restore tenant');
  }
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; icon: React.ReactNode }> = {
    active: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
    suspended: { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600', icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
    pending: { variant: 'outline', className: '', icon: <Clock className="w-3 h-3 mr-1" /> },
    pending_deletion: { variant: 'destructive', className: 'bg-orange-500 hover:bg-orange-600', icon: <Clock className="w-3 h-3 mr-1" /> },
    deleted: { variant: 'destructive', className: '', icon: <XCircle className="w-3 h-3 mr-1" /> },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.icon}
      {status.replace('_', ' ')}
    </Badge>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const tierNames = ['', 'SEED', 'SPROUT', 'GROWTH', 'SCALE', 'ENTERPRISE'];
  const tierColors = ['', 'bg-gray-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-600'];
  
  return (
    <Badge className={tierColors[tier]}>
      {tierNames[tier]}
    </Badge>
  );
}

function ComplianceBadges({ modes }: { modes: string[] }) {
  if (!modes || modes.length === 0) return <span className="text-muted-foreground">None</span>;
  
  return (
    <div className="flex flex-wrap gap-1">
      {modes.map((mode) => (
        <Badge key={mode} variant="outline" className="text-xs">
          <Shield className="w-3 h-3 mr-1" />
          {mode.toUpperCase()}
        </Badge>
      ))}
    </div>
  );
}

// ============================================================================
// CREATE TENANT DIALOG
// ============================================================================

function CreateTenantDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CreateTenantInput>({
    name: '',
    displayName: '',
    type: 'organization',
    tier: 1,
    primaryRegion: 'us-east-1',
    complianceMode: [],
    adminEmail: '',
    adminName: '',
  });

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Tenant created successfully' });
      onSuccess();
      onOpenChange(false);
      setFormData({
        name: '',
        displayName: '',
        type: 'organization',
        tier: 1,
        primaryRegion: 'us-east-1',
        complianceMode: [],
        adminEmail: '',
        adminName: '',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleComplianceChange = (mode: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      complianceMode: checked 
        ? [...prev.complianceMode, mode]
        : prev.complianceMode.filter(m => m !== mode),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
          <DialogDescription>
            Create a new organization or individual workspace
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Internal Name</Label>
            <Input
              id="name"
              placeholder="acme-corp"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Unique identifier, lowercase</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Acme Corporation"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'organization' | 'individual') => 
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select
              value={String(formData.tier)}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, tier: parseInt(value, 10) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 - SEED</SelectItem>
                <SelectItem value="2">2 - SPROUT</SelectItem>
                <SelectItem value="3">3 - GROWTH</SelectItem>
                <SelectItem value="4">4 - SCALE</SelectItem>
                <SelectItem value="5">5 - ENTERPRISE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryRegion">Primary Region</Label>
            <Select
              value={formData.primaryRegion}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, primaryRegion: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain (Optional)</Label>
            <Input
              id="domain"
              placeholder="acme.com"
              value={formData.domain || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Compliance Frameworks</Label>
            <div className="flex gap-4">
              {['hipaa', 'soc2', 'gdpr'].map((mode) => (
                <div key={mode} className="flex items-center space-x-2">
                  <Checkbox
                    id={mode}
                    checked={formData.complianceMode.includes(mode)}
                    onCheckedChange={(checked) => handleComplianceChange(mode, checked === true)}
                  />
                  <Label htmlFor={mode} className="text-sm font-normal uppercase">
                    {mode}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2 border-t pt-4">
            <h4 className="font-medium mb-3">Initial Admin User</h4>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@acme.com"
              value={formData.adminEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminName">Admin Name</Label>
            <Input
              id="adminName"
              placeholder="John Smith"
              value={formData.adminName}
              onChange={(e) => setFormData(prev => ({ ...prev, adminName: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate(formData)}
            disabled={createMutation.isPending || !formData.name || !formData.displayName || !formData.adminEmail || !formData.adminName}
          >
            {createMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Tenant
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DELETE TENANT DIALOG
// ============================================================================

function DeleteTenantDialog({
  tenant,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenant: TenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');

  const deleteMutation = useMutation({
    mutationFn: () => softDeleteTenant(tenant!.id, reason),
    onSuccess: () => {
      toast({ title: 'Success', description: `Tenant scheduled for deletion in ${tenant!.retentionDays} days` });
      onSuccess();
      onOpenChange(false);
      setReason('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (!tenant) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Tenant?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will schedule <strong>"{tenant.displayName}"</strong> for deletion after{' '}
                <strong>{tenant.retentionDays} days</strong>.
              </p>
              <p>
                The tenant can be restored during this period.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">Affected Users:</p>
                <ul className="text-sm mt-1">
                  <li>• {tenant.activeUsers} active users</li>
                  <li>• {tenant.suspendedUsers} suspended users</li>
                  <li>• {tenant.invitedUsers} pending invitations</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for deletion</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter the reason for deleting this tenant..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending || !reason.trim()}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete Tenant'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// RESTORE TENANT DIALOG
// ============================================================================

function RestoreTenantDialog({
  tenant,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenant: TenantSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const requestCodeMutation = useMutation({
    mutationFn: () => requestRestoreCode(tenant!.id),
    onSuccess: () => {
      toast({ title: 'Code Sent', description: 'Verification code sent to your email' });
      setCodeSent(true);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreTenant(tenant!.id, verificationCode),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Tenant restored successfully' });
      onSuccess();
      onOpenChange(false);
      setVerificationCode('');
      setCodeSent(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setVerificationCode('');
        setCodeSent(false);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore Tenant</DialogTitle>
          <DialogDescription>
            Restore "{tenant.displayName}" from pending deletion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {tenant.deletionScheduledAt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md">
              <p className="text-sm">
                <strong>Scheduled for deletion:</strong>{' '}
                {format(new Date(tenant.deletionScheduledAt), 'PPpp')}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(tenant.deletionScheduledAt), { addSuffix: true })}
              </p>
            </div>
          )}

          {!codeSent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Click below to receive a verification code via email
              </p>
              <Button 
                onClick={() => requestCodeMutation.mutate()}
                disabled={requestCodeMutation.isPending}
              >
                {requestCodeMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground">
                  Check your email for the verification code
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {codeSent && (
            <Button
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending || verificationCode.length !== 6}
            >
              {restoreMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Tenant
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TenantSummary | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<TenantSummary | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    tier: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
  });

  // Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenants', filters, pagination],
    queryFn: () => fetchTenants({
      ...filters,
      tier: filters.tier ? parseInt(filters.tier, 10) : undefined,
      ...pagination,
    }),
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
  }, [queryClient]);

  // Calculate stats
  const activeTenants = data?.tenants.filter(t => t.status === 'active') || [];
  const pendingDeletion = data?.tenants.filter(t => t.status === 'pending_deletion') || [];
  const totalUsers = data?.tenants.reduce((sum, t) => sum + t.activeUsers, 0) || 0;

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Tenants</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <p className="text-muted-foreground">
            Manage organizations and workspaces
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Tenant
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tenants</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? <Skeleton className="h-9 w-16" /> : data?.total || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : activeTenants.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Deletion</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : pendingDeletion.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? <Skeleton className="h-9 w-16" /> : totalUsers}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Pending Deletions Alert */}
      {pendingDeletion.length > 0 && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Clock className="w-5 h-5" />
              Pending Deletions ({pendingDeletion.length})
            </CardTitle>
            <CardDescription>
              These tenants are scheduled for permanent deletion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeletion.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.displayName}</TableCell>
                    <TableCell>{tenant.activeUsers}</TableCell>
                    <TableCell>
                      {tenant.deletionScheduledAt && (
                        <>
                          {format(new Date(tenant.deletionScheduledAt), 'PP')}
                          <span className="text-muted-foreground text-sm ml-2">
                            ({formatDistanceToNow(new Date(tenant.deletionScheduledAt), { addSuffix: true })})
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreTarget(tenant)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending_deletion">Pending Deletion</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.tier}
              onValueChange={(value) => setFilters(prev => ({ ...prev, tier: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Tiers</SelectItem>
                <SelectItem value="1">SEED</SelectItem>
                <SelectItem value="2">SPROUT</SelectItem>
                <SelectItem value="3">GROWTH</SelectItem>
                <SelectItem value="4">SCALE</SelectItem>
                <SelectItem value="5">ENTERPRISE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {tenant.type === 'organization' ? (
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Users className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div>
                            <div>{tenant.displayName}</div>
                            <div className="text-xs text-muted-foreground">{tenant.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{tenant.type}</TableCell>
                      <TableCell><TierBadge tier={tenant.tier} /></TableCell>
                      <TableCell><StatusBadge status={tenant.status} /></TableCell>
                      <TableCell><ComplianceBadges modes={tenant.complianceMode} /></TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{tenant.activeUsers} active</div>
                          {tenant.invitedUsers > 0 && (
                            <div className="text-muted-foreground">{tenant.invitedUsers} invited</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Manage Users
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {tenant.status === 'pending_deletion' ? (
                              <DropdownMenuItem onClick={() => setRestoreTarget(tenant)}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            ) : tenant.status === 'active' || tenant.status === 'suspended' ? (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteTarget(tenant)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.total > pagination.limit && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, data.total)} of {data.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.offset === 0}
                      onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!data.hasMore}
                      onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateTenantDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleRefresh}
      />
      <DeleteTenantDialog
        tenant={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onSuccess={handleRefresh}
      />
      <RestoreTenantDialog
        tenant={restoreTarget}
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
