'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Shield,
  Lock,
  RefreshCw,
  Save,
} from 'lucide-react';

interface EthicsFreeConfig {
  enabled: boolean;
  require_explicit_consent: boolean;
  require_mfa: boolean;
  max_session_duration_minutes: number;
  allowed_domains: string[];
  audit_all_requests: boolean;
  rate_limit_per_hour: number;
}

interface EthicsFreeSession {
  id: string;
  user_id: string;
  user_email: string;
  started_at: string;
  expires_at: string;
  domain: string;
  request_count: number;
  is_active: boolean;
}

async function fetchConfig(): Promise<EthicsFreeConfig> {
  const res = await fetch('/api/admin/ethics-free-reasoning/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

async function fetchSessions(): Promise<EthicsFreeSession[]> {
  const res = await fetch('/api/admin/ethics-free-reasoning/sessions');
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return data.sessions || [];
}

async function updateConfig(config: Partial<EthicsFreeConfig>): Promise<void> {
  const res = await fetch('/api/admin/ethics-free-reasoning/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update config');
}

export default function EthicsFreeReasoningPage() {
  const queryClient = useQueryClient();
  const [editedConfig, setEditedConfig] = useState<Partial<EthicsFreeConfig>>({});

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['ethics-free-config'],
    queryFn: fetchConfig,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['ethics-free-sessions'],
    queryFn: fetchSessions,
  });

  const updateMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ethics-free-config'] });
      toast.success('Configuration saved');
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  const getValue = <K extends keyof EthicsFreeConfig>(key: K): EthicsFreeConfig[K] => {
    return (editedConfig[key] ?? config?.[key]) as EthicsFreeConfig[K];
  };

  const setValue = <K extends keyof EthicsFreeConfig>(key: K, value: EthicsFreeConfig[K]) => {
    setEditedConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate({ ...config, ...editedConfig });
  };

  const activeSessions = sessions.filter(s => s.is_active).length;

  if (configLoading) {
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            Ethics-Free Reasoning
          </h1>
          <p className="text-muted-foreground mt-1">
            Controlled mode for research and specialized domains requiring unrestricted reasoning
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sensitive Feature</AlertTitle>
        <AlertDescription>
          This mode bypasses ethical guardrails. Use only for legitimate research purposes with proper authorization. All requests are audited.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-2xl">
              {getValue('enabled') ? (
                <Badge variant="destructive">Enabled</Badge>
              ) : (
                <Badge className="bg-green-500">Disabled</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Sessions</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{activeSessions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Allowed Domains</CardDescription>
            <CardTitle className="text-3xl">{getValue('allowed_domains')?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rate Limit</CardDescription>
            <CardTitle className="text-3xl">{getValue('rate_limit_per_hour') || 0}/hr</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="domains">Allowed Domains</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Access Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Ethics-Free Mode</Label>
                    <p className="text-sm text-muted-foreground">Allow unrestricted reasoning</p>
                  </div>
                  <Switch
                    checked={getValue('enabled')}
                    onCheckedChange={(v) => setValue('enabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Explicit Consent</Label>
                    <p className="text-sm text-muted-foreground">User must confirm each session</p>
                  </div>
                  <Switch
                    checked={getValue('require_explicit_consent')}
                    onCheckedChange={(v) => setValue('require_explicit_consent', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require MFA</Label>
                    <p className="text-sm text-muted-foreground">Two-factor authentication required</p>
                  </div>
                  <Switch
                    checked={getValue('require_mfa')}
                    onCheckedChange={(v) => setValue('require_mfa', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Session Limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Max Session Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={getValue('max_session_duration_minutes') || 60}
                    onChange={(e) => setValue('max_session_duration_minutes', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit (requests/hour)</Label>
                  <Input
                    type="number"
                    value={getValue('rate_limit_per_hour') || 100}
                    onChange={(e) => setValue('rate_limit_per_hour', parseInt(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Audit All Requests</Label>
                    <p className="text-sm text-muted-foreground">Log every request for review</p>
                  </div>
                  <Switch
                    checked={getValue('audit_all_requests')}
                    onCheckedChange={(v) => setValue('audit_all_requests', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Currently active ethics-free reasoning sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active sessions</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.user_email}</TableCell>
                        <TableCell>{session.domain}</TableCell>
                        <TableCell>{new Date(session.started_at).toLocaleString()}</TableCell>
                        <TableCell>{new Date(session.expires_at).toLocaleString()}</TableCell>
                        <TableCell>{session.request_count}</TableCell>
                        <TableCell>
                          {session.is_active ? (
                            <Badge variant="destructive">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Expired</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Terminate</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Allowed Domains</CardTitle>
              <CardDescription>Domains where ethics-free reasoning is permitted</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(getValue('allowed_domains') || []).map((domain, i) => (
                  <Badge key={i} variant="outline">{domain}</Badge>
                ))}
              </div>
              <Textarea
                placeholder="Enter allowed domains (one per line)..."
                defaultValue={(getValue('allowed_domains') || []).join('\n')}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Examples: medical_research, legal_analysis, security_testing
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
