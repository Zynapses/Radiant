'use client';

/**
 * RADIANT v5.52.28 - Security Settings Page (PROMPT-41B)
 * 
 * User security settings including MFA, session, and API key management.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  Key, 
  Clock, 
  AlertTriangle,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Trash2,
  Plus,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  MoreVertical,
  LogOut,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { MFASettingsSection } from '@/components/mfa';

// ============================================================================
// Types
// ============================================================================

interface Session {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
  isActive: boolean;
}

interface PersonalApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  useCount: number;
  createdAt: string;
}

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = '/api/user';

async function fetchSessions(): Promise<{ sessions: Session[] }> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

async function revokeSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to revoke session');
}

async function revokeAllSessions(): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to revoke all sessions');
}

async function fetchPersonalApiKeys(): Promise<{ keys: PersonalApiKey[] }> {
  const res = await fetch(`${API_BASE}/api-keys`);
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json();
}

async function createPersonalApiKey(data: {
  name: string;
  description?: string;
  scopes: string[];
  expiresInDays?: number;
}): Promise<{ key: string; id: string }> {
  const res = await fetch(`${API_BASE}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create API key');
  return res.json();
}

async function revokePersonalApiKey(keyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api-keys/${keyId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to revoke API key');
}

// ============================================================================
// Main Component
// ============================================================================

export default function SecuritySettingsPage() {
  const [activeTab, setActiveTab] = useState('mfa');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">
          Manage your account security and authentication settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mfa" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Two-Factor Auth
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mfa" className="mt-6">
          <MFASettingsSection />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <SessionsSection />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Sessions Section
// ============================================================================

function SessionsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: fetchSessions,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast({ title: 'Session revoked successfully' });
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
    onError: () => {
      toast({ title: 'Failed to revoke session', variant: 'destructive' });
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => {
      toast({ title: 'All other sessions revoked' });
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
    onError: () => {
      toast({ title: 'Failed to revoke sessions', variant: 'destructive' });
    },
  });

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="h-5 w-5" />;
      case 'tablet': return <Tablet className="h-5 w-5" />;
      case 'desktop': return <Monitor className="h-5 w-5" />;
      default: return <Globe className="h-5 w-5" />;
    }
  };

  const formatLastActivity = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const sessions = data?.sessions || [];
  const otherSessions = sessions.filter(s => !s.isCurrent);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Manage your active login sessions across devices
          </CardDescription>
        </div>
        {otherSessions.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out All Others
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of all other sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will sign you out of all sessions except your current one. 
                  You may need to sign in again on those devices.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => revokeAllMutation.mutate()}
                  disabled={revokeAllMutation.isPending}
                >
                  Sign Out All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p>Failed to load sessions</p>
            <Button 
              variant="link" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['user-sessions'] })}
            >
              Try again
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active sessions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  session.isCurrent ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${session.isCurrent ? 'bg-primary/10' : 'bg-muted'}`}>
                    {getDeviceIcon(session.deviceType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{session.browser} on {session.os}</span>
                      {session.isCurrent && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>{session.ipAddress}</span>
                      {session.location && (
                        <>
                          <span>•</span>
                          <span>{session.location}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Last active {formatLastActivity(session.lastActivityAt)}</span>
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSessionMutation.mutate(session.id)}
                    disabled={revokeSessionMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// API Keys Section
// ============================================================================

function ApiKeysSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; id: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['personal-api-keys'],
    queryFn: fetchPersonalApiKeys,
  });

  const createKeyMutation = useMutation({
    mutationFn: createPersonalApiKey,
    onSuccess: (result) => {
      setNewKeyResult(result);
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['personal-api-keys'] });
      toast({ title: 'API Key Created', description: 'Copy the key now - it will not be shown again!' });
    },
    onError: () => {
      toast({ title: 'Failed to create API key', variant: 'destructive' });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: revokePersonalApiKey,
    onSuccess: () => {
      toast({ title: 'API key revoked' });
      queryClient.invalidateQueries({ queryKey: ['personal-api-keys'] });
    },
    onError: () => {
      toast({ title: 'Failed to revoke API key', variant: 'destructive' });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const keys = data?.keys || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Personal API Keys</CardTitle>
            <CardDescription>
              Create and manage API keys for programmatic access to your account
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateKeyForm
                onSubmit={(data) => createKeyMutation.mutate(data)}
                isLoading={createKeyMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p>Failed to load API keys</p>
              <Button 
                variant="link" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['personal-api-keys'] })}
              >
                Try again
              </Button>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys yet</p>
              <p className="text-sm mt-1">Create an API key to access RADIANT programmatically</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{apiKey.name}</p>
                        {apiKey.description && (
                          <p className="text-xs text-muted-foreground">{apiKey.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{apiKey.keyPrefix}...</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                        {apiKey.scopes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{apiKey.scopes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {apiKey.isActive ? (
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
                    <TableCell className="text-muted-foreground">
                      {apiKey.lastUsedAt
                        ? new Date(apiKey.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {apiKey.expiresAt
                        ? new Date(apiKey.expiresAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copyToClipboard(apiKey.keyPrefix)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Prefix
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {apiKey.isActive && (
                            <DropdownMenuItem
                              className="text-red-500"
                              onClick={() => revokeKeyMutation.mutate(apiKey.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Revoke Key
                            </DropdownMenuItem>
                          )}
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
              <Button onClick={() => setNewKeyResult(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ============================================================================
// Create Key Form
// ============================================================================

function CreateKeyForm({ onSubmit, isLoading }: { 
  onSubmit: (data: { name: string; description?: string; scopes: string[]; expiresInDays?: number }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scopes: ['read'] as string[],
    expiresInDays: 0,
  });

  const availableScopes = [
    { value: 'read', label: 'Read', description: 'Read access to your data' },
    { value: 'write', label: 'Write', description: 'Create and modify data' },
    { value: 'chat', label: 'Chat', description: 'Access chat and AI features' },
    { value: 'models', label: 'Models', description: 'Query available AI models' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      description: formData.description || undefined,
      expiresInDays: formData.expiresInDays || undefined,
    });
  };

  const toggleScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogDescription>
          Create a new personal API key for programmatic access
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My API Key"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description..."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Scopes *</Label>
          <div className="grid grid-cols-2 gap-2">
            {availableScopes.map((scope) => (
              <div
                key={scope.value}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.scopes.includes(scope.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleScope(scope.value)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    formData.scopes.includes(scope.value)
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground'
                  }`}>
                    {formData.scopes.includes(scope.value) && (
                      <CheckCircle className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="font-medium text-sm">{scope.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{scope.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Expiration</Label>
          <Select
            value={String(formData.expiresInDays)}
            onValueChange={(v) => setFormData({ ...formData, expiresInDays: parseInt(v, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Never expires</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !formData.name || formData.scopes.length === 0}>
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Key'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
