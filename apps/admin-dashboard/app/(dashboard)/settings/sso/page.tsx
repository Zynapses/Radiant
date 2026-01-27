'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api/client';
import {
  Plus,
  RefreshCw,
  MoreVertical,
  Shield,
  Key,
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Edit,
  Play,
  Pause,
  TestTube,
} from 'lucide-react';
import type { TenantSsoConnection, SsoProtocol, CreateSsoConnectionRequest } from '@radiant/shared';

export default function SsoConnectionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<TenantSsoConnection | null>(null);
  const [formData, setFormData] = useState<Partial<CreateSsoConnectionRequest>>({
    protocol: 'saml',
    defaultRole: 'standard_user',
    allowJitProvisioning: true,
    syncUserAttributes: ['email', 'name'],
  });

  const { data: connections, isLoading, refetch } = useQuery({
    queryKey: ['sso-connections'],
    queryFn: async () => {
      const response = await api.get<{ data: TenantSsoConnection[] }>('/api/admin/sso-connections');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSsoConnectionRequest) => {
      await api.post('/api/admin/sso-connections', data);
    },
    onSuccess: () => {
      toast({ title: 'SSO connection created successfully' });
      setShowCreateDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['sso-connections'] });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to create SSO connection', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TenantSsoConnection> }) => {
      await api.put(`/api/admin/sso-connections/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: 'SSO connection updated successfully' });
      setShowEditDialog(false);
      setSelectedConnection(null);
      queryClient.invalidateQueries({ queryKey: ['sso-connections'] });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to update SSO connection', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/sso-connections/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'SSO connection deleted' });
      queryClient.invalidateQueries({ queryKey: ['sso-connections'] });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to delete SSO connection', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enable }: { id: string; enable: boolean }) => {
      await api.post(`/api/admin/sso-connections/${id}/${enable ? 'enable' : 'disable'}`);
    },
    onSuccess: (_, { enable }) => {
      toast({ title: `SSO connection ${enable ? 'enabled' : 'disabled'}` });
      queryClient.invalidateQueries({ queryKey: ['sso-connections'] });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to toggle SSO connection', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ success: boolean; message: string; details?: Record<string, unknown> }>(
        `/api/admin/sso-connections/${id}/test`
      );
      return response;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: 'Connection test successful', description: result.message });
      } else {
        toast({ title: 'Connection test failed', description: result.message, variant: 'destructive' });
      }
    },
    onError: (error) => {
      toast({ 
        title: 'Connection test failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      protocol: 'saml',
      defaultRole: 'standard_user',
      allowJitProvisioning: true,
      syncUserAttributes: ['email', 'name'],
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.tenantId || !formData.protocol) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData as CreateSsoConnectionRequest);
  };

  const handleEdit = (connection: TenantSsoConnection) => {
    setSelectedConnection(connection);
    setFormData({
      name: connection.name,
      tenantId: connection.tenantId,
      protocol: connection.protocol,
      idpEntityId: connection.idpEntityId,
      idpSsoUrl: connection.idpSsoUrl,
      oidcIssuerUrl: connection.oidcIssuerUrl,
      oidcClientId: connection.oidcClientId,
      enforcedDomains: connection.enforcedDomains,
      defaultRole: connection.defaultRole,
      allowJitProvisioning: connection.allowJitProvisioning,
      syncUserAttributes: connection.syncUserAttributes,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedConnection) return;
    updateMutation.mutate({ id: selectedConnection.id, data: formData });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SSO Connections</h1>
          <p className="text-muted-foreground">
            Configure enterprise SAML 2.0 and OIDC single sign-on connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create SSO Connection</DialogTitle>
                <DialogDescription>
                  Configure a new SAML or OIDC identity provider connection
                </DialogDescription>
              </DialogHeader>
              <SsoConnectionForm 
                formData={formData} 
                setFormData={setFormData} 
                isNew={true}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  Create Connection
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connections Table */}
      {!isLoading && connections && (
        <Card>
          <CardHeader>
            <CardTitle>Configured Connections</CardTitle>
            <CardDescription>
              {connections.length} SSO connection{connections.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No SSO Connections</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by adding your first identity provider connection
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Connection
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enforced Domains</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {connection.protocol === 'saml' ? (
                            <Key className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Globe className="h-4 w-4 text-green-500" />
                          )}
                          <div>
                            <p className="font-medium">{connection.name}</p>
                            {connection.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {connection.protocol.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {connection.tenantId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {connection.isEnabled ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {connection.enforcedDomains?.length ? (
                          <span className="text-sm">
                            {connection.enforcedDomains.slice(0, 2).join(', ')}
                            {connection.enforcedDomains.length > 2 && (
                              <span className="text-muted-foreground">
                                {' '}+{connection.enforcedDomains.length - 2} more
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{connection.useCount || 0} logins</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => testMutation.mutate(connection.id)}>
                              <TestTube className="h-4 w-4 mr-2" />
                              Test Connection
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(connection)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => toggleMutation.mutate({ 
                                id: connection.id, 
                                enable: !connection.isEnabled 
                              })}
                            >
                              {connection.isEnabled ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Enable
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this SSO connection?')) {
                                  deleteMutation.mutate(connection.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit SSO Connection</DialogTitle>
            <DialogDescription>
              Update the configuration for {selectedConnection?.name}
            </DialogDescription>
          </DialogHeader>
          <SsoConnectionForm 
            formData={formData} 
            setFormData={setFormData} 
            isNew={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedConnection(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SsoConnectionFormProps {
  formData: Partial<CreateSsoConnectionRequest>;
  setFormData: (data: Partial<CreateSsoConnectionRequest> | ((prev: Partial<CreateSsoConnectionRequest>) => Partial<CreateSsoConnectionRequest>)) => void;
  isNew: boolean;
}

function SsoConnectionForm({ formData, setFormData, isNew }: SsoConnectionFormProps) {
  return (
    <div className="space-y-6 py-4">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Basic Information</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Connection Name *</Label>
            <Input
              placeholder="e.g., Okta Production"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          {isNew && (
            <div className="space-y-2">
              <Label>Tenant ID *</Label>
              <Input
                placeholder="UUID of the tenant"
                value={formData.tenantId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))}
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Protocol *</Label>
          <Select
            value={formData.protocol || 'saml'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, protocol: value as SsoProtocol }))}
            disabled={!isNew}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saml">SAML 2.0</SelectItem>
              <SelectItem value="oidc">OpenID Connect (OIDC)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SAML Configuration */}
      {formData.protocol === 'saml' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">SAML Configuration</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>IdP Entity ID *</Label>
              <Input
                placeholder="e.g., http://www.okta.com/exk123..."
                value={formData.idpEntityId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, idpEntityId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>IdP SSO URL *</Label>
              <Input
                placeholder="e.g., https://yourorg.okta.com/app/..."
                value={formData.idpSsoUrl || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, idpSsoUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>IdP X.509 Certificate {isNew && '*'}</Label>
              <Textarea
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={4}
                value={formData.idpCertificate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, idpCertificate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Paste the full PEM-encoded certificate</p>
            </div>
          </div>
        </div>
      )}

      {/* OIDC Configuration */}
      {formData.protocol === 'oidc' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">OIDC Configuration</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Issuer URL *</Label>
              <Input
                placeholder="e.g., https://yourorg.okta.com"
                value={formData.oidcIssuerUrl || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, oidcIssuerUrl: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Client ID *</Label>
                <Input
                  placeholder="Client ID from IdP"
                  value={formData.oidcClientId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, oidcClientId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Client Secret {isNew && '*'}</Label>
                <Input
                  type="password"
                  placeholder="Client secret from IdP"
                  value={formData.oidcClientSecret || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, oidcClientSecret: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Domain Enforcement */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Domain Enforcement</h4>
        <div className="space-y-2">
          <Label>Enforced Domains</Label>
          <Input
            placeholder="e.g., example.com, corp.example.com"
            value={formData.enforcedDomains?.join(', ') || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              enforcedDomains: e.target.value.split(',').map(d => d.trim()).filter(Boolean)
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Users with these email domains will be forced to use this SSO connection
          </p>
        </div>
      </div>

      {/* User Provisioning */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">User Provisioning</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Default Role</Label>
            <Select
              value={formData.defaultRole || 'standard_user'}
              onValueChange={(value) => setFormData(prev => ({ ...prev, defaultRole: value as 'standard_user' | 'tenant_admin' | 'tenant_owner' }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard_user">Standard User</SelectItem>
                <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                <SelectItem value="tenant_owner">Tenant Owner</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Role assigned to new users from this IdP</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Just-In-Time Provisioning</Label>
              <p className="text-xs text-muted-foreground">Automatically create users on first login</p>
            </div>
            <Switch
              checked={formData.allowJitProvisioning ?? true}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowJitProvisioning: checked }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
