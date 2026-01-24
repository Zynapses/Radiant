'use client';

/**
 * RADIANT v5.52.5 - API Keys Management
 * 
 * Admin UI for managing API keys with interface type separation (API, MCP, A2A).
 * Keys created here are synced to Think Tank Admin.
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
import { Switch } from '@/components/ui/switch';
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
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Settings,
  Clock,
} from 'lucide-react';

const API_BASE = '/api/admin/api-keys';

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
  a2aAgentId?: string;
  a2aAgentType?: string;
  mcpAllowedTools?: string[];
  createdByApp?: string;
  createdAt: string;
  revokedAt?: string;
  revokedReason?: string;
  tags?: string[];
}

interface A2AAgent {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  agentVersion?: string;
  status: 'active' | 'suspended' | 'revoked' | 'pending';
  supportedOperations: string[];
  totalRequests: number;
  lastHeartbeatAt?: string;
  lastRequestAt?: string;
  createdAt: string;
}

interface InterfacePolicy {
  id: string;
  interfaceType: string;
  requireAuthentication: boolean;
  requireMtls: boolean;
  globalRateLimitPerMinute?: number;
  a2aRequireRegistration?: boolean;
  a2aMaxConcurrentConnections?: number;
  mcpMaxToolsPerRequest?: number;
  isEnabled: boolean;
  isGlobal: boolean;
}

interface Dashboard {
  summary: Record<string, {
    totalKeys: number;
    activeKeys: number;
    revokedKeys: number;
    expiredKeys: number;
    totalUses: number;
    lastUsedAt?: string;
  }>;
  recentKeys: ApiKey[];
  a2aAgentsSummary: Array<{ agent_type: string; total_agents: number; active_agents: number; total_requests: number }>;
  pendingSyncs: number;
}

// ============================================================================
// Component
// ============================================================================

export default function ApiKeysPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [interfaceFilter, setInterfaceFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; id: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<Dashboard>({
    queryKey: ['api-keys-dashboard'],
    queryFn: () => fetch(`${API_BASE}/dashboard`).then(r => r.json()),
  });

  // Fetch keys
  const { data: keysData, isLoading: keysLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ['api-keys', interfaceFilter],
    queryFn: () => {
      const url = interfaceFilter && interfaceFilter !== 'all'
        ? `${API_BASE}?interface_type=${interfaceFilter}`
        : API_BASE;
      return fetch(url).then(r => r.json());
    },
  });

  // Fetch A2A agents
  const { data: agentsData } = useQuery<{ agents: A2AAgent[] }>({
    queryKey: ['a2a-agents'],
    queryFn: () => fetch(`${API_BASE}/agents`).then(r => r.json()),
  });

  // Fetch policies
  const { data: policiesData } = useQuery<{ policies: InterfacePolicy[] }>({
    queryKey: ['interface-policies'],
    queryFn: () => fetch(`${API_BASE}/policies`).then(r => r.json()),
  });

  // Create key mutation
  const createKeyMutation = useMutation({
    mutationFn: (data: any) => fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Source-App': 'radiant_admin' },
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
      fetch(`${API_BASE}/${keyId}?reason=${encodeURIComponent(reason || '')}`, {
        method: 'DELETE',
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'API Key Revoked' });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  // Restore key mutation
  const restoreKeyMutation = useMutation({
    mutationFn: (keyId: string) => fetch(`${API_BASE}/${keyId}/restore`, {
      method: 'POST',
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'API Key Restored' });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  // Update agent status mutation
  const updateAgentStatusMutation = useMutation({
    mutationFn: ({ agentId, status }: { agentId: string; status: string }) =>
      fetch(`${API_BASE}/agents/${agentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: 'Agent Status Updated' });
      queryClient.invalidateQueries({ queryKey: ['a2a-agents'] });
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

  const totalKeys = dashboard?.summary ? Object.values(dashboard.summary).reduce((sum, s) => sum + s.totalKeys, 0) : 0;
  const activeKeys = dashboard?.summary ? Object.values(dashboard.summary).reduce((sum, s) => sum + s.activeKeys, 0) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for different interfaces (API, MCP, A2A)
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
              onSubmit={(data) => {
                createKeyMutation.mutate(data);
              }}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="a2a-agents">A2A Agents</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Keys</CardDescription>
                <CardTitle className="text-3xl">{totalKeys}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {activeKeys} active
                </p>
              </CardContent>
            </Card>

            {['api', 'mcp', 'a2a'].map((type) => (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    {getInterfaceIcon(type)}
                    {type.toUpperCase()} Keys
                  </CardDescription>
                  <CardTitle className="text-3xl">
                    {dashboard?.summary[type]?.totalKeys || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {dashboard?.summary[type]?.activeKeys || 0} active,{' '}
                    {dashboard?.summary[type]?.totalUses || 0} uses
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Keys */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Keys</CardTitle>
              <CardDescription>Recently created API keys</CardDescription>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.recentKeys?.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <Badge className={getInterfaceColor(key.interfaceType)}>
                          {key.interfaceType.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{key.keyPrefix}</TableCell>
                      <TableCell>
                        {key.isActive ? (
                          <Badge variant="outline" className="text-green-500">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell>{key.useCount}</TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* A2A Summary */}
          {dashboard?.a2aAgentsSummary && dashboard.a2aAgentsSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>A2A Agents Summary</CardTitle>
                <CardDescription>Registered agent types and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dashboard.a2aAgentsSummary.map((summary) => (
                    <div key={summary.agent_type} className="p-4 border rounded-lg">
                      <h4 className="font-medium">{summary.agent_type}</h4>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p>{summary.active_agents} / {summary.total_agents} active</p>
                        <p>{summary.total_requests.toLocaleString()} total requests</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex justify-between items-center">
            <Select value={interfaceFilter} onValueChange={setInterfaceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by interface" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interfaces</SelectItem>
                <SelectItem value="api">API Only</SelectItem>
                <SelectItem value="mcp">MCP Only</SelectItem>
                <SelectItem value="a2a">A2A Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Interface</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Expires</TableHead>
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
                        <div className="flex flex-wrap gap-1">
                          {key.scopes?.slice(0, 2).map((scope) => (
                            <Badge key={scope} variant="secondary" className="text-xs">
                              {scope}
                            </Badge>
                          ))}
                          {key.scopes?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{key.scopes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
                      <TableCell>
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {key.expiresAt ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {new Date(key.expiresAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
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
                              <DropdownMenuItem
                                onClick={() => restoreKeyMutation.mutate(key.id)}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore Key
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A2A Agents Tab */}
        <TabsContent value="a2a-agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered A2A Agents</CardTitle>
              <CardDescription>
                External agents authorized for Agent-to-Agent communication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Operations</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Last Heartbeat</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentsData?.agents?.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{agent.agentName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{agent.agentId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.agentType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            agent.status === 'active'
                              ? 'text-green-500'
                              : agent.status === 'suspended'
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          }
                        >
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.supportedOperations?.slice(0, 2).map((op) => (
                            <Badge key={op} variant="secondary" className="text-xs">
                              {op}
                            </Badge>
                          ))}
                          {agent.supportedOperations?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{agent.supportedOperations.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{agent.totalRequests.toLocaleString()}</TableCell>
                      <TableCell>
                        {agent.lastHeartbeatAt
                          ? new Date(agent.lastHeartbeatAt).toLocaleString()
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
                            {agent.status === 'active' ? (
                              <DropdownMenuItem
                                onClick={() => updateAgentStatusMutation.mutate({ agentId: agent.id, status: 'suspended' })}
                              >
                                Suspend Agent
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => updateAgentStatusMutation.mutate({ agentId: agent.id, status: 'active' })}
                              >
                                Activate Agent
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-500"
                              onClick={() => updateAgentStatusMutation.mutate({ agentId: agent.id, status: 'revoked' })}
                            >
                              Revoke Agent
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interface Access Policies</CardTitle>
              <CardDescription>
                Configure authentication and rate limiting per interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {policiesData?.policies?.map((policy) => (
                <div key={policy.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {getInterfaceIcon(policy.interfaceType)}
                      <h4 className="font-semibold">{policy.interfaceType.toUpperCase()} Interface</h4>
                      {policy.isGlobal && (
                        <Badge variant="secondary">Global Default</Badge>
                      )}
                    </div>
                    <Switch checked={policy.isEnabled} />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Authentication</p>
                      <p className="font-medium">
                        {policy.requireAuthentication ? 'Required' : 'Optional'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">mTLS</p>
                      <p className="font-medium">
                        {policy.requireMtls ? 'Required' : 'Not Required'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rate Limit</p>
                      <p className="font-medium">
                        {policy.globalRateLimitPerMinute
                          ? `${policy.globalRateLimitPerMinute}/min`
                          : 'Unlimited'}
                      </p>
                    </div>
                    {policy.interfaceType === 'a2a' && (
                      <div>
                        <p className="text-muted-foreground">Max Connections</p>
                        <p className="font-medium">
                          {policy.a2aMaxConcurrentConnections || 100}
                        </p>
                      </div>
                    )}
                    {policy.interfaceType === 'mcp' && (
                      <div>
                        <p className="text-muted-foreground">Max Tools/Request</p>
                        <p className="font-medium">
                          {policy.mcpMaxToolsPerRequest || 50}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
    a2aAgentId: '',
    a2aAgentType: '',
    mcpAllowedTools: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      expiresInDays: formData.expiresInDays || undefined,
      a2aAgentId: formData.a2aAgentId || undefined,
      a2aAgentType: formData.a2aAgentType || undefined,
      mcpAllowedTools: formData.mcpAllowedTools.length > 0 ? formData.mcpAllowedTools : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogDescription>
          Create a new API key for accessing RADIANT services
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Production API Key"
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
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  All Interfaces
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

        {formData.interfaceType === 'a2a' && (
          <>
            <div className="space-y-2">
              <Label>Agent ID</Label>
              <Input
                value={formData.a2aAgentId}
                onChange={(e) => setFormData({ ...formData, a2aAgentId: e.target.value })}
                placeholder="agent-123"
              />
            </div>
            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Input
                value={formData.a2aAgentType}
                onChange={(e) => setFormData({ ...formData, a2aAgentType: e.target.value })}
                placeholder="orchestrator, worker, etc."
              />
            </div>
          </>
        )}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !formData.name}>
          {isLoading ? 'Creating...' : 'Create Key'}
        </Button>
      </DialogFooter>
    </form>
  );
}
