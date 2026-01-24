'use client';

/**
 * RADIANT v5.52.5 - Think Tank Admin API Keys Management
 * 
 * Admin UI for managing API keys with interface type separation (API, MCP, A2A).
 * Keys created here are synced to Radiant Admin.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Key,
  Plus,
  Copy,
  MoreVertical,
  RefreshCw,
  Shield,
  Cpu,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Clock,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// ============================================================================
// Types
// ============================================================================

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  interfaceType: 'api' | 'mcp' | 'a2a' | 'all';
  scopes: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  useCount: number;
  createdByApp?: string;
  createdAt: string;
  revokedAt?: string;
}

interface Dashboard {
  summary: Record<string, {
    totalKeys: number;
    activeKeys: number;
    revokedKeys: number;
    totalUses: number;
  }>;
  recentKeys: ApiKey[];
  pendingSyncs: number;
}

// ============================================================================
// Component
// ============================================================================

export default function ApiKeysPage() {
  const [activeTab, setActiveTab] = useState('keys');
  const [interfaceFilter, setInterfaceFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; id: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dashboard
  const { data: dashboard } = useQuery<Dashboard>({
    queryKey: ['api-keys-dashboard'],
    queryFn: () => fetch(`${API_BASE}/api/admin/api-keys/dashboard`).then(r => r.json()),
  });

  // Fetch keys
  const { data: keysData, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ['api-keys', interfaceFilter],
    queryFn: () => {
      const url = interfaceFilter && interfaceFilter !== 'all'
        ? `${API_BASE}/api/admin/api-keys?interface_type=${interfaceFilter}`
        : `${API_BASE}/api/admin/api-keys`;
      return fetch(url).then(r => r.json());
    },
  });

  // Create key mutation
  const createKeyMutation = useMutation({
    mutationFn: (data: any) => fetch(`${API_BASE}/api/admin/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Source-App': 'thinktank_admin' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: (result) => {
      if (result.key) {
        setNewKeyResult({ key: result.key, id: result.id });
        toast({ title: 'API Key Created', description: 'Copy the key now - it will not be shown again!' });
      }
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-dashboard'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Revoke key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: ({ keyId, reason }: { keyId: string; reason?: string }) =>
      fetch(`${API_BASE}/api/admin/api-keys/${keyId}?reason=${encodeURIComponent(reason || '')}`, {
        method: 'DELETE',
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'API Key Revoked' });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  // Restore key mutation
  const restoreKeyMutation = useMutation({
    mutationFn: (keyId: string) => fetch(`${API_BASE}/api/admin/api-keys/${keyId}/restore`, {
      method: 'POST',
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'API Key Restored' });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const getInterfaceIcon = (type: string) => {
    switch (type) {
      case 'api': return <Key className="h-4 w-4" />;
      case 'mcp': return <Cpu className="h-4 w-4" />;
      case 'a2a': return <Users className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getInterfaceColor = (type: string) => {
    switch (type) {
      case 'api': return 'bg-blue-500/10 text-blue-500';
      case 'mcp': return 'bg-purple-500/10 text-purple-500';
      case 'a2a': return 'bg-green-500/10 text-green-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for Think Tank integrations
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <CreateKeyDialog
              onSubmit={(data) => createKeyMutation.mutate(data)}
              isLoading={createKeyMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* New Key Result Dialog */}
      {newKeyResult && (
        <Dialog open={!!newKeyResult} onOpenChange={() => setNewKeyResult(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                API Key Created
              </DialogTitle>
              <DialogDescription>
                Copy this key now. It will not be shown again!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={newKeyResult.key}
                  readOnly
                  className="pr-20 font-mono text-sm"
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(newKeyResult.key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                <AlertTriangle className="h-4 w-4 inline mr-2 text-yellow-500" />
                Store this key securely. You will not be able to see it again.
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => { setNewKeyResult(null); setCreateDialogOpen(false); }}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['api', 'mcp', 'a2a'].map((type) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                {getInterfaceIcon(type)}
                {type.toUpperCase()} Keys
              </CardDescription>
              <CardTitle className="text-2xl">
                {dashboard?.summary[type]?.activeKeys || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {dashboard?.summary[type]?.totalUses || 0} total uses
              </p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Syncs</CardDescription>
            <CardTitle className="text-2xl">{dashboard?.pendingSyncs || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Keys awaiting sync to Radiant Admin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>All keys for this tenant</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={interfaceFilter} onValueChange={setInterfaceFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Interfaces</SelectItem>
                  <SelectItem value="api">API Only</SelectItem>
                  <SelectItem value="mcp">MCP Only</SelectItem>
                  <SelectItem value="a2a">A2A Only</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keysData?.keys?.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{key.name}</p>
                      {key.description && (
                        <p className="text-xs text-muted-foreground">{key.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getInterfaceColor(key.interfaceType)}>
                      {getInterfaceIcon(key.interfaceType)}
                      <span className="ml-1">{key.interfaceType.toUpperCase()}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{key.keyPrefix}</TableCell>
                  <TableCell>
                    {key.isActive ? (
                      <Badge variant="outline" className="text-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-500">
                        <XCircle className="h-3 w-3 mr-1" />
                        Revoked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{key.useCount.toLocaleString()}</TableCell>
                  <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyToClipboard(key.keyPrefix)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Prefix
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {key.isActive ? (
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() => revokeKeyMutation.mutate({ keyId: key.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke Key
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => restoreKeyMutation.mutate(key.id)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore Key
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!keysData?.keys || keysData.keys.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No API keys found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Create Key Dialog Component
// ============================================================================

function CreateKeyDialog({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    interfaceType: 'api' as 'api' | 'mcp' | 'a2a' | 'all',
    scopes: ['chat', 'models'],
    expiresInDays: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      expiresInDays: formData.expiresInDays || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogDescription>
          Create a new API key for Think Tank integrations
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Integration Key"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Used for..."
          />
        </div>

        <div className="space-y-2">
          <Label>Interface Type *</Label>
          <Select
            value={formData.interfaceType}
            onValueChange={(v: any) => setFormData({ ...formData, interfaceType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="api">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API - REST/HTTP endpoints
                </div>
              </SelectItem>
              <SelectItem value="mcp">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  MCP - Model Context Protocol
                </div>
              </SelectItem>
              <SelectItem value="a2a">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  A2A - Agent-to-Agent
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Expires In (Days)</Label>
          <Input
            type="number"
            value={formData.expiresInDays || ''}
            onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 0 })}
            placeholder="Never (leave empty)"
            min={0}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !formData.name}>
          {isLoading ? 'Creating...' : 'Create Key'}
        </Button>
      </DialogFooter>
    </form>
  );
}
