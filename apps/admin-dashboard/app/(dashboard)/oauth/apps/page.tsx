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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  Search,
  Shield,
  AlertTriangle,
  ExternalLink,
  Eye,
  Ban,
  Check,
  Key,
  Users,
  Activity,
  Settings,
  RefreshCw,
} from 'lucide-react';

interface OAuthApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  appType: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  allowedScopes: string[];
  createdByTenantId?: string;
  createdAt: string;
  lastUsedAt?: string;
  activeAuthorizations?: number;
}

interface OAuthDashboard {
  totalApps: number;
  appsByStatus: Record<string, number>;
  pendingApprovals: OAuthApp[];
  topApps: OAuthApp[];
  totalAuthorizations: number;
  activeAuthorizations: number;
  eventsLast24h: number;
}

async function fetchDashboard(): Promise<OAuthDashboard> {
  const response = await fetch('/api/admin/oauth/dashboard');
  if (!response.ok) throw new Error('Failed to fetch dashboard');
  const data = await response.json();
  return data.data;
}

async function fetchApps(status?: string): Promise<OAuthApp[]> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  const response = await fetch(`/api/admin/oauth/apps?${params}`);
  if (!response.ok) throw new Error('Failed to fetch apps');
  const data = await response.json();
  return data.data;
}

export default function OAuthAppsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionDialog, setActionDialog] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'view' | null;
    app: OAuthApp | null;
  }>({ type: null, app: null });
  const [actionReason, setActionReason] = useState('');

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['oauth-dashboard'],
    queryFn: fetchDashboard,
  });

  const { data: apps = [], isLoading: appsLoading } = useQuery({
    queryKey: ['oauth-apps', statusFilter],
    queryFn: () => fetchApps(statusFilter),
  });

  const appActionMutation = useMutation({
    mutationFn: async ({ appId, action, reason }: { appId: string; action: string; reason?: string }) => {
      const response = await fetch(`/api/admin/oauth/apps/${appId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error(`Failed to ${action} app`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] });
      queryClient.invalidateQueries({ queryKey: ['oauth-dashboard'] });
      setActionDialog({ type: null, app: null });
      setActionReason('');
    },
  });

  function getStatusBadge(status: OAuthApp['status']) {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'suspended':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"><Ban className="h-3 w-3 mr-1" />Suspended</Badge>;
    }
  }

  function getAppTypeBadge(appType: string) {
    const colors: Record<string, string> = {
      web_application: 'bg-blue-100 text-blue-800',
      native_application: 'bg-purple-100 text-purple-800',
      single_page_application: 'bg-cyan-100 text-cyan-800',
      machine_to_machine: 'bg-orange-100 text-orange-800',
      mcp_server: 'bg-green-100 text-green-800',
    };
    return (
      <Badge variant="outline" className={colors[appType] || ''}>
        {appType.replace(/_/g, ' ')}
      </Badge>
    );
  }

  function getRiskBadge(scopes: string[]) {
    const highRiskScopes = ['chat:write', 'knowledge:write', 'files:write', 'agents:execute', 'chat:delete'];
    const hasHighRisk = scopes.some(s => highRiskScopes.includes(s));
    if (hasHighRisk) {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />High Risk</Badge>;
    }
    return <Badge variant="secondary"><Shield className="h-3 w-3 mr-1" />Standard</Badge>;
  }

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.clientId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = dashboard?.appsByStatus?.pending || 0;

  if (dashboardLoading) {
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
          <h1 className="text-3xl font-bold">OAuth Applications</h1>
          <p className="text-muted-foreground">
            Manage third-party applications that access RADIANT APIs
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {pendingCount} Pending Review
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="apps">
            <Key className="h-4 w-4 mr-2" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="authorizations">
            <Users className="h-4 w-4 mr-2" />
            Authorizations
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.totalApps || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.appsByStatus?.approved || 0} approved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting approval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Authorizations</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.activeAuthorizations || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.totalAuthorizations || 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Events (24h)</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.eventsLast24h || 0}</div>
                <p className="text-xs text-muted-foreground">
                  OAuth events
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pending Approvals */}
          {(dashboard?.pendingApprovals?.length || 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Pending Approvals
                </CardTitle>
                <CardDescription>
                  These applications are waiting for admin review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.pendingApprovals.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {app.logoUrl ? (
                              <img src={app.logoUrl} alt="" className="h-8 w-8 rounded" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-sm font-medium">
                                {app.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{app.name}</div>
                              <div className="text-xs text-muted-foreground">{app.clientId.slice(0, 20)}...</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getAppTypeBadge(app.appType)}</TableCell>
                        <TableCell>{getRiskBadge(app.allowedScopes)}</TableCell>
                        <TableCell>{new Date(app.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => setActionDialog({ type: 'approve', app })}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setActionDialog({ type: 'reject', app })}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Top Apps */}
          <Card>
            <CardHeader>
              <CardTitle>Top Applications</CardTitle>
              <CardDescription>
                Most used OAuth applications by authorization count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Active Authorizations</TableHead>
                    <TableHead>Last Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.topApps?.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div className="font-medium">{app.name}</div>
                      </TableCell>
                      <TableCell>{getAppTypeBadge(app.appType)}</TableCell>
                      <TableCell>{app.activeAuthorizations || 0}</TableCell>
                      <TableCell>
                        {app.lastUsedAt ? new Date(app.lastUsedAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or client ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Apps Table */}
          <Card>
            <CardContent className="pt-6">
              {appsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Authorizations</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {app.logoUrl ? (
                              <img src={app.logoUrl} alt="" className="h-10 w-10 rounded-lg" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center font-medium">
                                {app.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{app.name}</div>
                              <div className="text-sm text-muted-foreground">{app.clientId.slice(0, 20)}...</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getAppTypeBadge(app.appType)}</TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell>{getRiskBadge(app.allowedScopes)}</TableCell>
                        <TableCell>{app.activeAuthorizations || 0}</TableCell>
                        <TableCell>{new Date(app.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setActionDialog({ type: 'view', app })}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {app.homepageUrl && (
                                <DropdownMenuItem asChild>
                                  <a href={app.homepageUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Visit Homepage
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {app.status === 'pending' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({ type: 'approve', app })}
                                    className="text-green-600"
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setActionDialog({ type: 'reject', app })}
                                    className="text-red-600"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {app.status === 'approved' && (
                                <DropdownMenuItem
                                  onClick={() => setActionDialog({ type: 'suspend', app })}
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend
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
        </TabsContent>

        <TabsContent value="authorizations">
          <Card>
            <CardHeader>
              <CardTitle>User Authorizations</CardTitle>
              <CardDescription>
                View and manage user consent for OAuth applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                User authorizations can be viewed and revoked from this panel.
                Search by user or application to find specific authorizations.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>OAuth Settings</CardTitle>
              <CardDescription>
                Configure OAuth provider settings for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Access Token TTL</Label>
                  <Input type="number" defaultValue={3600} />
                  <p className="text-xs text-muted-foreground">Seconds (default: 3600 = 1 hour)</p>
                </div>
                <div className="space-y-2">
                  <Label>Default Refresh Token TTL</Label>
                  <Input type="number" defaultValue={2592000} />
                  <p className="text-xs text-muted-foreground">Seconds (default: 2592000 = 30 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog
        open={actionDialog.type !== null}
        onOpenChange={() => {
          setActionDialog({ type: null, app: null });
          setActionReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && 'Approve Application'}
              {actionDialog.type === 'reject' && 'Reject Application'}
              {actionDialog.type === 'suspend' && 'Suspend Application'}
              {actionDialog.type === 'view' && actionDialog.app?.name}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'approve' && `Allow "${actionDialog.app?.name}" to request user authorizations.`}
              {actionDialog.type === 'reject' && `Reject "${actionDialog.app?.name}". The developer will be notified.`}
              {actionDialog.type === 'suspend' && `Suspend "${actionDialog.app?.name}" and revoke all active tokens.`}
              {actionDialog.type === 'view' && `Client ID: ${actionDialog.app?.clientId}`}
            </DialogDescription>
          </DialogHeader>

          {actionDialog.app && actionDialog.type === 'view' && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{actionDialog.app.description || 'No description'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">App Type</Label>
                <p>{actionDialog.app.appType.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Allowed Scopes</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {actionDialog.app.allowedScopes.map((scope) => (
                    <Badge key={scope} variant="secondary">{scope}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(actionDialog.type === 'reject' || actionDialog.type === 'suspend') && (
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Provide a reason..."
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog({ type: null, app: null });
                setActionReason('');
              }}
            >
              {actionDialog.type === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {actionDialog.type !== 'view' && (
              <Button
                variant={actionDialog.type === 'approve' ? 'default' : 'destructive'}
                onClick={() => {
                  if (actionDialog.app && actionDialog.type) {
                    appActionMutation.mutate({
                      appId: actionDialog.app.id,
                      action: actionDialog.type,
                      reason: actionReason,
                    });
                  }
                }}
                disabled={appActionMutation.isPending}
              >
                {appActionMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {actionDialog.type === 'approve' && 'Approve'}
                {actionDialog.type === 'reject' && 'Reject'}
                {actionDialog.type === 'suspend' && 'Suspend'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
