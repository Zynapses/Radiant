'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { 
  Key, Shield, AlertTriangle, Clock, Plus, RotateCcw, Trash2, 
  Eye, EyeOff, RefreshCw, Lock, Database, Webhook, Settings
} from 'lucide-react';

interface VaultSecret {
  id: string;
  key: string;
  category: 'api_key' | 'database' | 'oauth' | 'encryption' | 'webhook' | 'custom';
  description: string;
  version: number;
  accessCount: number;
  lastAccessedAt?: string;
  isActive: boolean;
  expiresAt?: string;
  rotationSchedule?: string;
  lastRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultDashboard {
  totalSecrets: number;
  byCategory: Record<string, number>;
  expiringSoon: number;
  recentlyAccessed: number;
  recentAccess: Array<{
    id: string;
    secretKey: string;
    accessedBy: string;
    accessType: string;
    success: boolean;
    timestamp: string;
  }>;
  cartridgesWithMissingSecrets: Array<{
    cartridgeId: string;
    cartridgeName: string;
    missingSecrets: string[];
  }>;
}

const categoryIcons: Record<string, React.ReactNode> = {
  api_key: <Key className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  oauth: <Shield className="h-4 w-4" />,
  encryption: <Lock className="h-4 w-4" />,
  webhook: <Webhook className="h-4 w-4" />,
  custom: <Settings className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  api_key: 'bg-blue-100 text-blue-800',
  database: 'bg-green-100 text-green-800',
  oauth: 'bg-purple-100 text-purple-800',
  encryption: 'bg-yellow-100 text-yellow-800',
  webhook: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-800',
};

export default function VaultPage() {
  const [dashboard, setDashboard] = useState<VaultDashboard | null>(null);
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<VaultSecret | null>(null);
  const [newSecret, setNewSecret] = useState({
    key: '',
    value: '',
    category: 'api_key' as const,
    description: '',
    expiresAt: '',
  });
  const [rotateValue, setRotateValue] = useState('');
  const [rotateReason, setRotateReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, secretsRes] = await Promise.all([
        fetch('/api/admin/vault/dashboard'),
        fetch('/api/admin/vault/secrets'),
      ]);
      
      if (dashRes.ok) {
        setDashboard(await dashRes.json());
      }
      if (secretsRes.ok) {
        const data = await secretsRes.json();
        setSecrets(data.secrets || []);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load vault data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSecret = async () => {
    try {
      const res = await fetch('/api/admin/vault/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSecret),
      });
      
      if (res.ok) {
        toast({ title: 'Success', description: 'Secret created successfully' });
        setShowAddDialog(false);
        setNewSecret({ key: '', value: '', category: 'api_key', description: '', expiresAt: '' });
        fetchData();
      } else {
        throw new Error('Failed to create secret');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create secret', variant: 'destructive' });
    }
  };

  const handleRotateSecret = async () => {
    if (!selectedSecret) return;
    
    try {
      const res = await fetch(`/api/admin/vault/secrets/${encodeURIComponent(selectedSecret.key)}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newValue: rotateValue, reason: rotateReason }),
      });
      
      if (res.ok) {
        toast({ title: 'Success', description: 'Secret rotated successfully' });
        setShowRotateDialog(false);
        setRotateValue('');
        setRotateReason('');
        setSelectedSecret(null);
        fetchData();
      } else {
        throw new Error('Failed to rotate secret');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to rotate secret', variant: 'destructive' });
    }
  };

  const handleDeleteSecret = async (key: string) => {
    if (!confirm(`Are you sure you want to delete secret ${key}?`)) return;
    
    try {
      const res = await fetch(`/api/admin/vault/secrets/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        toast({ title: 'Success', description: 'Secret deleted successfully' });
        fetchData();
      } else {
        throw new Error('Failed to delete secret');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete secret', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Genesis Vault</h1>
          <p className="text-muted-foreground">
            Keyhole Pattern - Manage secrets for cartridges without exposing credentials
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Secret
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Secret</DialogTitle>
                <DialogDescription>
                  Store a new secret in the Genesis Vault. Secrets are encrypted with KMS.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key">Secret Key</Label>
                  <Input
                    id="key"
                    placeholder="e.g., STRIPE_API_KEY"
                    value={newSecret.key}
                    onChange={(e) => setNewSecret({ ...newSecret, key: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="value">Secret Value</Label>
                  <Input
                    id="value"
                    type="password"
                    placeholder="Enter secret value"
                    value={newSecret.value}
                    onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newSecret.category}
                    onValueChange={(v) => setNewSecret({ ...newSecret, category: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="oauth">OAuth</SelectItem>
                      <SelectItem value="encryption">Encryption</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What is this secret used for?"
                    value={newSecret.description}
                    onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expires At (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={newSecret.expiresAt}
                    onChange={(e) => setNewSecret({ ...newSecret, expiresAt: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleAddSecret} disabled={!newSecret.key || !newSecret.value}>
                  Add Secret
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Secrets</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalSecrets || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.expiringSoon || 0}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recently Accessed</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.recentlyAccessed || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Secrets</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.cartridgesWithMissingSecrets?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Cartridges affected</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="secrets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="secrets">Secrets</TabsTrigger>
          <TabsTrigger value="access">Access Log</TabsTrigger>
          <TabsTrigger value="missing">Missing Secrets</TabsTrigger>
        </TabsList>

        <TabsContent value="secrets">
          <Card>
            <CardHeader>
              <CardTitle>Stored Secrets</CardTitle>
              <CardDescription>
                Manage encrypted secrets in the Genesis Vault
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Access Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Accessed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell className="font-mono">{secret.key}</TableCell>
                      <TableCell>
                        <Badge className={categoryColors[secret.category]}>
                          <span className="mr-1">{categoryIcons[secret.category]}</span>
                          {secret.category.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>v{secret.version}</TableCell>
                      <TableCell>{secret.accessCount}</TableCell>
                      <TableCell>
                        {secret.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700">Inactive</Badge>
                        )}
                        {secret.expiresAt && new Date(secret.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                          <Badge variant="outline" className="ml-1 bg-orange-50 text-orange-700">Expiring</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {secret.lastAccessedAt 
                          ? new Date(secret.lastAccessedAt).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSecret(secret);
                            setShowRotateDialog(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSecret(secret.key)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {secrets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No secrets stored. Click Add Secret to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Recent Access Log</CardTitle>
              <CardDescription>
                Audit trail of secret access in the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Secret</TableHead>
                    <TableHead>Accessed By</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.recentAccess?.map((access) => (
                    <TableRow key={access.id}>
                      <TableCell className="font-mono">{access.secretKey}</TableCell>
                      <TableCell>{access.accessedBy}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{access.accessType}</Badge>
                      </TableCell>
                      <TableCell>
                        {access.success ? (
                          <Badge className="bg-green-100 text-green-800">Success</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(access.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard?.recentAccess || dashboard.recentAccess.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No recent access logs
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing">
          <Card>
            <CardHeader>
              <CardTitle>Cartridges with Missing Secrets</CardTitle>
              <CardDescription>
                Cartridges that require secrets not yet stored in the vault
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.cartridgesWithMissingSecrets?.length ? (
                <div className="space-y-4">
                  {dashboard.cartridgesWithMissingSecrets.map((item) => (
                    <div key={item.cartridgeId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{item.cartridgeName}</h4>
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {item.missingSecrets.length} missing
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.missingSecrets.map((key) => (
                          <Badge key={key} variant="secondary" className="font-mono">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  All cartridge secret requirements are satisfied
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rotate Dialog */}
      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Secret</DialogTitle>
            <DialogDescription>
              Rotate &quot;{selectedSecret?.key}&quot; to a new value. The old value will be stored in history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newValue">New Value</Label>
              <Input
                id="newValue"
                type="password"
                placeholder="Enter new secret value"
                value={rotateValue}
                onChange={(e) => setRotateValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Why is this secret being rotated?"
                value={rotateReason}
                onChange={(e) => setRotateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotateDialog(false)}>Cancel</Button>
            <Button onClick={handleRotateSecret} disabled={!rotateValue || !rotateReason}>
              Rotate Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
