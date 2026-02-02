'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Shield, Key, Globe, FileCheck, AlertTriangle, Plus, 
  RefreshCw, Download, Upload, Trash2, Eye, CheckCircle,
  XCircle, Clock, Lock, Unlock
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface PKIDashboard {
  rootCA: {
    clusterId: string;
    fingerprint: string;
    validUntil: string;
    status: string;
  };
  tenantCAs: {
    total: number;
    active: number;
    expiringSoon: number;
    revoked: number;
  };
  signingKeys: {
    total: number;
    active: number;
    usedToday: number;
  };
  signatures: {
    totalSigned: number;
    signedToday: number;
    verificationsToday: number;
    failedVerifications: number;
  };
  trustedRoots: {
    total: number;
    active: number;
  };
  recentActivity: PKIAuditEntry[];
}

interface TenantCA {
  id: string;
  tenantId: string;
  tenantName: string;
  fingerprint: string;
  algorithm: string;
  validFrom: string;
  validUntil: string;
  status: string;
  signingKeyCount: number;
}

interface TrustedRoot {
  id: string;
  clusterId: string;
  clusterName: string;
  fingerprint: string;
  addedAt: string;
  expiresAt?: string;
  isActive: boolean;
  trustLevel: 'full' | 'limited';
  allowedTenantIds?: string[];
  notes?: string;
}

interface SigningKey {
  id: string;
  tenantId: string;
  tenantName: string;
  keyId: string;
  fingerprint: string;
  algorithm: string;
  purpose: 'author' | 'platform';
  validFrom: string;
  validUntil: string;
  status: string;
  usageCount: number;
  lastUsedAt?: string;
}

interface PKIAuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  performedBy: string;
  performedAt: string;
  success: boolean;
  details?: Record<string, unknown>;
}

// =============================================================================
// Component
// =============================================================================

export default function PKIManagementPage() {
  const [dashboard, setDashboard] = useState<PKIDashboard | null>(null);
  const [tenantCAs, setTenantCAs] = useState<TenantCA[]>([]);
  const [trustedRoots, setTrustedRoots] = useState<TrustedRoot[]>([]);
  const [signingKeys, setSigningKeys] = useState<SigningKey[]>([]);
  const [auditLog, setAuditLog] = useState<PKIAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Dialog states
  const [showAddTrust, setShowAddTrust] = useState(false);
  const [showGenerateCA, setShowGenerateCA] = useState(false);
  const [showExportRoot, setShowExportRoot] = useState(false);
  const [exportedRoot, setExportedRoot] = useState<string>('');

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'tenant-cas') loadTenantCAs();
    if (activeTab === 'federation') loadTrustedRoots();
    if (activeTab === 'signing-keys') loadSigningKeys();
    if (activeTab === 'audit') loadAuditLog();
  }, [activeTab]);

  async function loadDashboard() {
    try {
      const res = await fetch('/api/admin/pki/dashboard');
      if (res.ok) {
        setDashboard(await res.json());
      }
    } catch (error) {
      console.error('Failed to load PKI dashboard', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTenantCAs() {
    try {
      const res = await fetch('/api/admin/pki/tenant-cas');
      if (res.ok) {
        const data = await res.json();
        setTenantCAs(data.tenantCAs || []);
      }
    } catch (error) {
      console.error('Failed to load tenant CAs', error);
    }
  }

  async function loadTrustedRoots() {
    try {
      const res = await fetch('/api/admin/pki/trusted-roots');
      if (res.ok) {
        const data = await res.json();
        setTrustedRoots(data.trustedRoots || []);
      }
    } catch (error) {
      console.error('Failed to load trusted roots', error);
    }
  }

  async function loadSigningKeys() {
    try {
      const res = await fetch('/api/admin/pki/signing-keys');
      if (res.ok) {
        const data = await res.json();
        setSigningKeys(data.signingKeys || []);
      }
    } catch (error) {
      console.error('Failed to load signing keys', error);
    }
  }

  async function loadAuditLog() {
    try {
      const res = await fetch('/api/admin/pki/audit?limit=100');
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.auditLog || []);
      }
    } catch (error) {
      console.error('Failed to load audit log', error);
    }
  }

  async function exportRootCA() {
    try {
      const res = await fetch('/api/admin/pki/root-ca/export');
      if (res.ok) {
        const data = await res.json();
        setExportedRoot(JSON.stringify(data, null, 2));
        setShowExportRoot(true);
      } else {
        toast.error('Failed to export Root CA');
      }
    } catch (error) {
      toast.error('Failed to export Root CA');
    }
  }

  async function removeTrustedRoot(id: string) {
    if (!confirm('Are you sure you want to remove this trusted root? Cartridges from this cluster will no longer be trusted.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/pki/trusted-roots/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Trusted root removed');
        loadTrustedRoots();
      } else {
        toast.error('Failed to remove trusted root');
      }
    } catch (error) {
      toast.error('Failed to remove trusted root');
    }
  }

  async function toggleTrustedRoot(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/admin/pki/trusted-roots/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? 'Trust enabled' : 'Trust disabled');
        loadTrustedRoots();
      }
    } catch (error) {
      toast.error('Failed to update trusted root');
    }
  }

  async function rotateSigningKey(keyId: string) {
    if (!confirm('Are you sure you want to rotate this signing key? The old key will be revoked.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/pki/signing-keys/${keyId}/rotate`, { method: 'POST' });
      if (res.ok) {
        toast.success('Signing key rotated');
        loadSigningKeys();
      } else {
        toast.error('Failed to rotate signing key');
      }
    } catch (error) {
      toast.error('Failed to rotate signing key');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading PKI dashboard...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">PKI Management</h1>
          <p className="text-muted-foreground">
            Manage certificates, signing keys, and federation trust
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportRootCA}>
            <Download className="w-4 h-4 mr-2" />
            Export Root CA
          </Button>
          <Button onClick={() => setShowAddTrust(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Trusted Root
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenant-cas">Tenant CAs</TabsTrigger>
          <TabsTrigger value="signing-keys">Signing Keys</TabsTrigger>
          <TabsTrigger value="federation">Federation</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Root CA Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Root CA
              </CardTitle>
              <CardDescription>Radiant Platform Root Certificate Authority</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.rootCA?.fingerprint !== 'NOT_INITIALIZED' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Cluster ID</Label>
                    <p className="font-mono text-sm">{dashboard?.rootCA?.clusterId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fingerprint</Label>
                    <p className="font-mono text-sm truncate">{dashboard?.rootCA?.fingerprint?.substring(0, 16)}...</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valid Until</Label>
                    <p className="text-sm">{new Date(dashboard?.rootCA?.validUntil || '').toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant="default" className="bg-green-500">Active</Badge>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Root CA not initialized. Run Genesis initialization to create the Root CA.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tenant CAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.tenantCAs?.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.tenantCAs?.expiringSoon || 0} expiring soon
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Signing Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.signingKeys?.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.signingKeys?.usedToday || 0} used today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Signatures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.signatures?.totalSigned || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.signatures?.signedToday || 0} today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Federation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.trustedRoots?.active || 0}</div>
                <p className="text-xs text-muted-foreground">trusted clusters</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(dashboard?.recentActivity || []).slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {entry.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-medium">{entry.action}</span>
                      <Badge variant="outline">{entry.targetType}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(entry.performedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                {(!dashboard?.recentActivity || dashboard.recentActivity.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenant CAs Tab */}
        <TabsContent value="tenant-cas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tenant Certificate Authorities</h2>
            <Button onClick={() => setShowGenerateCA(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Generate Tenant CA
            </Button>
          </div>

          <div className="grid gap-4">
            {tenantCAs.map((ca) => (
              <Card key={ca.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        <span className="font-semibold">{ca.tenantName}</span>
                        <Badge variant={ca.status === 'active' ? 'default' : 'destructive'}>
                          {ca.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {ca.fingerprint?.substring(0, 32)}...
                      </p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Algorithm: {ca.algorithm}</span>
                        <span>Keys: {ca.signingKeyCount}</span>
                        <span>Expires: {new Date(ca.validUntil).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {ca.status === 'active' && (
                        <Button variant="destructive" size="sm">
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {tenantCAs.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tenant CAs found. Generate one for a tenant to enable cartridge signing.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Signing Keys Tab */}
        <TabsContent value="signing-keys" className="space-y-4">
          <h2 className="text-xl font-semibold">Signing Keys</h2>

          <div className="grid gap-4">
            {signingKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span className="font-semibold">{key.tenantName}</span>
                        <Badge variant="outline">{key.purpose}</Badge>
                        <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                          {key.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {key.fingerprint?.substring(0, 32)}...
                      </p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Usage: {key.usageCount} signatures</span>
                        <span>Algorithm: {key.algorithm}</span>
                        <span>Expires: {new Date(key.validUntil).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {key.status === 'active' && (
                      <Button variant="outline" size="sm" onClick={() => rotateSigningKey(key.id)}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Rotate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {signingKeys.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No signing keys found.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Federation Tab */}
        <TabsContent value="federation" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Federation Trust</h2>
              <p className="text-sm text-muted-foreground">
                Trust cartridges signed by other Radiant clusters
              </p>
            </div>
            <Button onClick={() => setShowAddTrust(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Trusted Root
            </Button>
          </div>

          <div className="grid gap-4">
            {trustedRoots.map((root) => (
              <Card key={root.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <span className="font-semibold">{root.clusterName}</span>
                        <Badge variant={root.isActive ? 'default' : 'secondary'}>
                          {root.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline">{root.trustLevel}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Cluster ID: {root.clusterId}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        Fingerprint: {root.fingerprint?.substring(0, 32)}...
                      </p>
                      {root.notes && (
                        <p className="text-sm text-muted-foreground">{root.notes}</p>
                      )}
                      {root.trustLevel === 'limited' && root.allowedTenantIds && (
                        <p className="text-sm text-muted-foreground">
                          Limited to {root.allowedTenantIds.length} tenants
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={root.isActive}
                        onCheckedChange={(checked) => toggleTrustedRoot(root.id, checked)}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeTrustedRoot(root.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {trustedRoots.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No trusted roots configured.</p>
                  <p className="text-sm">Add a trusted root to accept cartridges from other Radiant clusters.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <h2 className="text-xl font-semibold">PKI Audit Log</h2>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      {entry.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.action}</span>
                          <Badge variant="outline">{entry.targetType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          by {entry.performedBy}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(entry.performedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                {auditLog.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No audit entries</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Trusted Root Dialog */}
      <AddTrustedRootDialog 
        open={showAddTrust} 
        onOpenChange={setShowAddTrust}
        onSuccess={() => {
          loadTrustedRoots();
          loadDashboard();
        }}
      />

      {/* Generate Tenant CA Dialog */}
      <GenerateTenantCADialog
        open={showGenerateCA}
        onOpenChange={setShowGenerateCA}
        onSuccess={() => {
          loadTenantCAs();
          loadDashboard();
        }}
      />

      {/* Export Root CA Dialog */}
      <Dialog open={showExportRoot} onOpenChange={setShowExportRoot}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export Root CA for Federation</DialogTitle>
            <DialogDescription>
              Share this with another Radiant cluster to enable federation trust
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={exportedRoot}
            readOnly
            className="font-mono text-xs h-64"
          />
          <DialogFooter>
            <Button onClick={() => {
              navigator.clipboard.writeText(exportedRoot);
              toast.success('Copied to clipboard');
            }}>
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Add Trusted Root Dialog
// =============================================================================

function AddTrustedRootDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [clusterId, setClusterId] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [trustLevel, setTrustLevel] = useState<'full' | 'limited'>('full');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!clusterId || !clusterName || !publicKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/pki/trusted-roots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId,
          clusterName,
          publicKey,
          trustLevel,
          notes,
        }),
      });

      if (res.ok) {
        toast.success('Trusted root added successfully');
        onOpenChange(false);
        onSuccess();
        // Reset form
        setClusterId('');
        setClusterName('');
        setPublicKey('');
        setNotes('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add trusted root');
      }
    } catch (error) {
      toast.error('Failed to add trusted root');
    } finally {
      setLoading(false);
    }
  }

  function handlePasteExport() {
    navigator.clipboard.readText().then((text) => {
      try {
        const data = JSON.parse(text);
        if (data.rootCA) {
          setClusterId(data.rootCA.clusterId || '');
          setClusterName(data.rootCA.clusterName || '');
          setPublicKey(data.rootCA.publicKey || '');
          toast.success('Parsed exported Root CA data');
        }
      } catch {
        toast.error('Invalid export format');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Trusted Root CA</DialogTitle>
          <DialogDescription>
            Add a Root CA from another Radiant cluster to enable federation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" onClick={handlePasteExport} className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            Paste Exported Root CA
          </Button>

          <div className="space-y-2">
            <Label>Cluster ID *</Label>
            <Input 
              value={clusterId} 
              onChange={(e) => setClusterId(e.target.value)}
              placeholder="e.g., us-gov-west-1-prod"
            />
          </div>

          <div className="space-y-2">
            <Label>Cluster Name *</Label>
            <Input 
              value={clusterName} 
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="e.g., Radiant Defense"
            />
          </div>

          <div className="space-y-2">
            <Label>Public Key (PEM) *</Label>
            <Textarea 
              value={publicKey} 
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="-----BEGIN PUBLIC KEY-----"
              className="font-mono text-xs h-24"
            />
          </div>

          <div className="space-y-2">
            <Label>Trust Level</Label>
            <Select value={trustLevel} onValueChange={(v) => setTrustLevel(v as 'full' | 'limited')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full - Trust all tenants</SelectItem>
                <SelectItem value="limited">Limited - Specific tenants only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this trust relationship"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding...' : 'Add Trusted Root'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Generate Tenant CA Dialog
// =============================================================================

function GenerateTenantCADialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [validityYears, setValidityYears] = useState('5');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!tenantId || !tenantName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/pki/tenant-cas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          tenantName,
          validityDays: parseInt(validityYears) * 365,
        }),
      });

      if (res.ok) {
        toast.success('Tenant CA generated successfully');
        onOpenChange(false);
        onSuccess();
        setTenantId('');
        setTenantName('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to generate tenant CA');
      }
    } catch (error) {
      toast.error('Failed to generate tenant CA');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Tenant CA</DialogTitle>
          <DialogDescription>
            Create a new Certificate Authority for a tenant to enable cartridge signing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tenant ID *</Label>
            <Input 
              value={tenantId} 
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="UUID of the tenant"
            />
          </div>

          <div className="space-y-2">
            <Label>Tenant Name *</Label>
            <Input 
              value={tenantName} 
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="e.g., Acme Corporation"
            />
          </div>

          <div className="space-y-2">
            <Label>Validity (Years)</Label>
            <Select value={validityYears} onValueChange={setValidityYears}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 year</SelectItem>
                <SelectItem value="2">2 years</SelectItem>
                <SelectItem value="5">5 years</SelectItem>
                <SelectItem value="10">10 years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Generating...' : 'Generate CA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
