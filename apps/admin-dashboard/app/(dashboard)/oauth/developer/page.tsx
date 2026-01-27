'use client';

/**
 * RADIANT v5.52.26 - Developer Portal (PROMPT-41B)
 * 
 * Public-facing portal for third-party developers to register and manage OAuth applications.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { 
  Plus, Key, Globe, Shield, Code, Copy, Eye, EyeOff, 
  RefreshCw, Trash2, ExternalLink, CheckCircle2, Clock, XCircle,
  AlertTriangle, BookOpen, Terminal
} from 'lucide-react';

interface DeveloperApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  appType: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  redirectUris: string[];
  allowedScopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

interface OAuthScope {
  name: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
}

const APP_TYPES = [
  { value: 'web_application', label: 'Web Application', description: 'Server-side app with secure backend' },
  { value: 'single_page_application', label: 'Single Page Application', description: 'Browser-based JavaScript app' },
  { value: 'native_application', label: 'Native Application', description: 'Mobile or desktop app' },
  { value: 'machine_to_machine', label: 'Machine to Machine', description: 'Backend service or CLI tool' },
  { value: 'mcp_server', label: 'MCP Server', description: 'Model Context Protocol server' },
];

const STATUS_BADGES = {
  pending: { variant: 'secondary' as const, icon: Clock, label: 'Pending Review' },
  approved: { variant: 'default' as const, icon: CheckCircle2, label: 'Approved' },
  rejected: { variant: 'destructive' as const, icon: XCircle, label: 'Rejected' },
  suspended: { variant: 'destructive' as const, icon: AlertTriangle, label: 'Suspended' },
};

export default function DeveloperPortalPage() {
  const queryClient = useQueryClient();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [newAppSecret, setNewAppSecret] = useState<string | null>(null);

  // Fetch developer's apps
  const { data: apps = [], isLoading: appsLoading } = useQuery<DeveloperApp[]>({
    queryKey: ['developer-apps'],
    queryFn: async () => {
      const response = await fetch('/api/oauth/developer/apps');
      if (!response.ok) throw new Error('Failed to fetch apps');
      const data = await response.json();
      return data.apps || [];
    },
  });

  // Fetch available scopes
  const { data: scopes = [] } = useQuery<OAuthScope[]>({
    queryKey: ['oauth-scopes'],
    queryFn: async () => {
      const response = await fetch('/api/oauth/scopes');
      if (!response.ok) throw new Error('Failed to fetch scopes');
      const data = await response.json();
      return data.scopes || [];
    },
  });

  // Register new app mutation
  const registerApp = useMutation({
    mutationFn: async (appData: {
      name: string;
      description?: string;
      homepageUrl?: string;
      appType: string;
      redirectUris: string[];
      requestedScopes: string[];
    }) => {
      const response = await fetch('/api/oauth/developer/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData),
      });
      if (!response.ok) throw new Error('Failed to register app');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['developer-apps'] });
      setNewAppSecret(data.clientSecret);
      toast({ title: 'Application Registered', description: 'Your application has been submitted for review.' });
    },
    onError: () => {
      toast({ title: 'Registration Failed', description: 'Failed to register application.', variant: 'destructive' });
    },
  });

  // Delete app mutation
  const deleteApp = useMutation({
    mutationFn: async (appId: string) => {
      const response = await fetch(`/api/oauth/developer/apps/${appId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete app');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-apps'] });
      toast({ title: 'Application Deleted' });
    },
  });

  // Rotate secret mutation
  const rotateSecret = useMutation({
    mutationFn: async (appId: string) => {
      const response = await fetch(`/api/oauth/developer/apps/${appId}/rotate-secret`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to rotate secret');
      return response.json();
    },
    onSuccess: (data) => {
      setNewAppSecret(data.clientSecret);
      toast({ title: 'Secret Rotated', description: 'Your new client secret has been generated.' });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard.` });
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Developer Portal</h1>
          <p className="text-muted-foreground mt-1">
            Build integrations with RADIANT using OAuth 2.0
          </p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register Application
            </Button>
          </DialogTrigger>
          <RegisterAppDialog
            scopes={scopes}
            onSubmit={(data) => {
              registerApp.mutate(data);
              setIsRegisterOpen(false);
            }}
            isLoading={registerApp.isPending}
          />
        </Dialog>
      </div>

      {/* New Secret Alert */}
      {newAppSecret && (
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Client Secret:</strong> This secret will only be shown once. Copy it now!
              <code className="ml-2 px-2 py-1 bg-muted rounded">{newAppSecret}</code>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(newAppSecret, 'Client Secret')}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewAppSecret(null)}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="apps" className="space-y-6">
        <TabsList>
          <TabsTrigger value="apps">My Applications</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="scopes">Available Scopes</TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="apps" className="space-y-4">
          {appsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
          ) : apps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Applications Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Register your first OAuth application to get started.
                </p>
                <Button onClick={() => setIsRegisterOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Register Application
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {apps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  showSecret={showSecret}
                  onToggleSecret={(id) => setShowSecret(showSecret === id ? null : id)}
                  onCopy={copyToClipboard}
                  onRotateSecret={() => rotateSecret.mutate(app.id)}
                  onDelete={() => deleteApp.mutate(app.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">1. Register Your Application</h3>
                <p className="text-muted-foreground text-sm">
                  Click &quot;Register Application&quot; and fill in your app details. Your application will be reviewed before approval.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">2. Configure OAuth Flow</h3>
                <p className="text-muted-foreground text-sm mb-2">
                  Use the Authorization Code flow with PKCE for web and mobile apps:
                </p>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`// Authorization URL
GET /oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=openid profile chat:read&
  state=RANDOM_STATE&
  code_challenge=CODE_CHALLENGE&
  code_challenge_method=S256`}
                </pre>
              </div>

              <div>
                <h3 className="font-medium mb-2">3. Exchange Code for Tokens</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE&
redirect_uri=YOUR_REDIRECT_URI&
client_id=YOUR_CLIENT_ID&
code_verifier=CODE_VERIFIER`}
                </pre>
              </div>

              <div>
                <h3 className="font-medium mb-2">4. Make API Requests</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`GET /api/v2/thinktank/conversations
Authorization: Bearer ACCESS_TOKEN`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                API Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-sm">/oauth/authorize</TableCell>
                    <TableCell>GET/POST</TableCell>
                    <TableCell>Authorization endpoint</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">/oauth/token</TableCell>
                    <TableCell>POST</TableCell>
                    <TableCell>Token endpoint</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">/oauth/revoke</TableCell>
                    <TableCell>POST</TableCell>
                    <TableCell>Token revocation</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">/oauth/userinfo</TableCell>
                    <TableCell>GET</TableCell>
                    <TableCell>User info (OIDC)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">/.well-known/openid-configuration</TableCell>
                    <TableCell>GET</TableCell>
                    <TableCell>OIDC discovery</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">/oauth/jwks.json</TableCell>
                    <TableCell>GET</TableCell>
                    <TableCell>JSON Web Key Set</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scopes Tab */}
        <TabsContent value="scopes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Available OAuth Scopes
              </CardTitle>
              <CardDescription>
                Request only the scopes your application needs. High-risk scopes require approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopes.map((scope) => (
                    <TableRow key={scope.name}>
                      <TableCell className="font-mono text-sm">{scope.name}</TableCell>
                      <TableCell>{scope.description}</TableCell>
                      <TableCell>
                        <Badge variant={
                          scope.riskLevel === 'low' ? 'secondary' :
                          scope.riskLevel === 'medium' ? 'default' : 'destructive'
                        }>
                          {scope.riskLevel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// App Card Component
function AppCard({
  app,
  showSecret,
  onToggleSecret,
  onCopy,
  onRotateSecret,
  onDelete,
}: {
  app: DeveloperApp;
  showSecret: string | null;
  onToggleSecret: (id: string) => void;
  onCopy: (text: string, label: string) => void;
  onRotateSecret: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_BADGES[app.status];
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            {app.name}
            <Badge variant={status.variant}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </CardTitle>
          <CardDescription>{app.description || 'No description'}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRotateSecret}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Rotate Secret
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Client ID</Label>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                {app.clientId}
              </code>
              <Button size="icon" variant="ghost" onClick={() => onCopy(app.clientId, 'Client ID')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">App Type</Label>
            <p className="text-sm">{APP_TYPES.find(t => t.value === app.appType)?.label || app.appType}</p>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Redirect URIs</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {app.redirectUris.map((uri, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {uri}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Scopes</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {app.allowedScopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="text-xs">
                {scope}
              </Badge>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Created {new Date(app.createdAt).toLocaleDateString()}
          {app.lastUsedAt && ` • Last used ${new Date(app.lastUsedAt).toLocaleDateString()}`}
        </div>
      </CardContent>
    </Card>
  );
}

// Register App Dialog Component
function RegisterAppDialog({
  scopes,
  onSubmit,
  isLoading,
}: {
  scopes: OAuthScope[];
  onSubmit: (data: {
    name: string;
    description?: string;
    homepageUrl?: string;
    appType: string;
    redirectUris: string[];
    requestedScopes: string[];
  }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [homepageUrl, setHomepageUrl] = useState('');
  const [appType, setAppType] = useState('web_application');
  const [redirectUris, setRedirectUris] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['openid', 'profile']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      homepageUrl: homepageUrl || undefined,
      appType,
      redirectUris: redirectUris.split('\n').filter(Boolean),
      requestedScopes: selectedScopes,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Register New Application</DialogTitle>
        <DialogDescription>
          Create a new OAuth application to integrate with RADIANT.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Application Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome App"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what your application does..."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="homepageUrl">Homepage URL</Label>
          <Input
            id="homepageUrl"
            type="url"
            value={homepageUrl}
            onChange={(e) => setHomepageUrl(e.target.value)}
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="appType">Application Type *</Label>
          <Select value={appType} onValueChange={setAppType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APP_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div>
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="redirectUris">Redirect URIs * (one per line)</Label>
          <Textarea
            id="redirectUris"
            value={redirectUris}
            onChange={(e) => setRedirectUris(e.target.value)}
            placeholder="https://example.com/callback&#10;http://localhost:3000/callback"
            rows={3}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Requested Scopes</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
            {scopes.map((scope) => (
              <div key={scope.name} className="flex items-start space-x-2">
                <Checkbox
                  id={scope.name}
                  checked={selectedScopes.includes(scope.name)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedScopes([...selectedScopes, scope.name]);
                    } else {
                      setSelectedScopes(selectedScopes.filter(s => s !== scope.name));
                    }
                  }}
                />
                <div className="grid gap-0.5 leading-none">
                  <label
                    htmlFor={scope.name}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {scope.name}
                    {scope.riskLevel === 'high' && (
                      <Badge variant="destructive" className="ml-1 text-[10px]">High Risk</Badge>
                    )}
                  </label>
                  <p className="text-xs text-muted-foreground">{scope.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isLoading || !name || !redirectUris}>
            {isLoading ? 'Registering...' : 'Register Application'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
