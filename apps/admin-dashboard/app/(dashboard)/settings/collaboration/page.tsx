'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Settings, Shield, Clock, GitBranch, MessageSquare, Brain,
  Share2, Bell, Loader2, Save, RefreshCw, TrendingUp, UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/api/admin/collaboration-settings/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  const { data } = await res.json();
  return data;
}

async function updateTenantSettings(settings: any) {
  const res = await fetch(`${API_BASE}/api/admin/collaboration-settings/tenant`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  const { data } = await res.json();
  return data;
}

export default function CollaborationSettingsPage() {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['collaboration-settings-dashboard'],
    queryFn: fetchDashboard,
  });

  const updateMutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaboration-settings-dashboard'] });
      setPendingChanges({});
      toast.success('Settings saved successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  const handleChange = (field: string, value: any) => {
    setPendingChanges(prev => ({ ...prev, [field]: value }));
  };

  const getValue = (field: string) => {
    if (pendingChanges[field] !== undefined) return pendingChanges[field];
    return dashboard?.tenantSettings?.[field];
  };

  const saveChanges = () => {
    if (Object.keys(pendingChanges).length > 0) {
      updateMutation.mutate(pendingChanges);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load collaboration settings
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Collaboration Settings
          </h1>
          <p className="text-muted-foreground">
            Configure collaboration features for your tenant
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['collaboration-settings-dashboard'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={saveChanges}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{stats.activeSessions || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Guests</p>
                <p className="text-2xl font-bold">{stats.totalGuests || 0}</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Converted Guests</p>
                <p className="text-2xl font-bold">{stats.convertedGuests || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-violet-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{stats.conversionRate || 0}%</p>
              </div>
              <Share2 className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="guest-access">Guest Access</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="overrides">User Overrides</TabsTrigger>
          <TabsTrigger value="viral">Viral Growth</TabsTrigger>
        </TabsList>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Collaboration Features</CardTitle>
              <CardDescription>Enable or disable collaboration features for your tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FeatureToggle
                  icon={<MessageSquare className="h-5 w-5" />}
                  label="Collaborative Chat"
                  description="Enable real-time collaborative sessions"
                  checked={getValue('enable_collaborative_chat') ?? true}
                  onChange={(v) => handleChange('enable_collaborative_chat', v)}
                />
                <FeatureToggle
                  icon={<Users className="h-5 w-5" />}
                  label="Intra-Tenant Chat"
                  description="Allow users within your tenant to collaborate"
                  checked={getValue('enable_intra_tenant_chat') ?? true}
                  onChange={(v) => handleChange('enable_intra_tenant_chat', v)}
                />
                <FeatureToggle
                  icon={<UserPlus className="h-5 w-5" />}
                  label="Guest Access"
                  description="Allow guests from outside your organization"
                  checked={getValue('enable_guest_access') ?? true}
                  onChange={(v) => handleChange('enable_guest_access', v)}
                />
                <FeatureToggle
                  icon={<Brain className="h-5 w-5" />}
                  label="AI Facilitator"
                  description="AI moderator that guides discussions"
                  checked={getValue('enable_ai_facilitator') ?? true}
                  onChange={(v) => handleChange('enable_ai_facilitator', v)}
                />
                <FeatureToggle
                  icon={<GitBranch className="h-5 w-5" />}
                  label="Branch & Merge"
                  description="Fork conversations to explore alternatives"
                  checked={getValue('enable_branch_merge') ?? true}
                  onChange={(v) => handleChange('enable_branch_merge', v)}
                />
                <FeatureToggle
                  icon={<Clock className="h-5 w-5" />}
                  label="Time-Shifted Playback"
                  description="Record and replay sessions asynchronously"
                  checked={getValue('enable_time_shifted_playback') ?? true}
                  onChange={(v) => handleChange('enable_time_shifted_playback', v)}
                />
                <FeatureToggle
                  icon={<Users className="h-5 w-5" />}
                  label="AI Roundtable"
                  description="Multi-model debate and synthesis"
                  checked={getValue('enable_ai_roundtable') ?? true}
                  onChange={(v) => handleChange('enable_ai_roundtable', v)}
                />
                <FeatureToggle
                  icon={<Share2 className="h-5 w-5" />}
                  label="Knowledge Graph"
                  description="Visual collective understanding"
                  checked={getValue('enable_knowledge_graph') ?? true}
                  onChange={(v) => handleChange('enable_knowledge_graph', v)}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">AI Facilitator Defaults</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Default Persona</Label>
                    <Select
                      value={getValue('default_facilitator_persona') || 'professional'}
                      onValueChange={(v) => handleChange('default_facilitator_persona', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                        <SelectItem value="socratic">Socratic</SelectItem>
                        <SelectItem value="coach">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Intervention Frequency</Label>
                    <Select
                      value={getValue('facilitator_intervention_frequency') || 'moderate'}
                      onValueChange={(v) => handleChange('facilitator_intervention_frequency', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guest Access Tab */}
        <TabsContent value="guest-access">
          <Card>
            <CardHeader>
              <CardTitle>Guest Access Settings</CardTitle>
              <CardDescription>Configure cross-tenant guest collaboration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Max Guests Per Session</Label>
                  <Input
                    type="number"
                    value={getValue('max_guests_per_session') || 10}
                    onChange={(e) => handleChange('max_guests_per_session', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Guest Sessions Per Month</Label>
                  <Input
                    type="number"
                    value={getValue('max_guest_sessions_per_month') || 100}
                    onChange={(e) => handleChange('max_guest_sessions_per_month', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Default Guest Permission</Label>
                  <Select
                    value={getValue('default_guest_permission') || 'commenter'}
                    onValueChange={(v) => handleChange('default_guest_permission', v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer - Read only</SelectItem>
                      <SelectItem value="commenter">Commenter - Can add comments</SelectItem>
                      <SelectItem value="editor">Editor - Full participation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Invite Link Expiry (hours)</Label>
                  <Input
                    type="number"
                    value={getValue('guest_invite_expiry_hours') || 168}
                    onChange={(e) => handleChange('guest_invite_expiry_hours', parseInt(e.target.value))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">168 hours = 7 days</p>
                </div>
              </div>

              <Separator />

              <FeatureToggle
                icon={<Shield className="h-5 w-5" />}
                label="Require Guest Email"
                description="Guests must provide email to join sessions"
                checked={getValue('require_guest_email') ?? false}
                onChange={(v) => handleChange('require_guest_email', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Limits Tab */}
        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Session & Storage Limits</CardTitle>
              <CardDescription>Configure resource limits for collaboration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Max Sessions Per User</Label>
                  <Input
                    type="number"
                    value={getValue('max_sessions_per_user') || 50}
                    onChange={(e) => handleChange('max_sessions_per_user', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Participants Per Session</Label>
                  <Input
                    type="number"
                    value={getValue('max_participants_per_session') || 50}
                    onChange={(e) => handleChange('max_participants_per_session', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Branches Per Session</Label>
                  <Input
                    type="number"
                    value={getValue('max_branches_per_session') || 10}
                    onChange={(e) => handleChange('max_branches_per_session', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Recordings Per Session</Label>
                  <Input
                    type="number"
                    value={getValue('max_recordings_per_session') || 5}
                    onChange={(e) => handleChange('max_recordings_per_session', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Roundtables Per Session</Label>
                  <Input
                    type="number"
                    value={getValue('max_roundtables_per_session') || 3}
                    onChange={(e) => handleChange('max_roundtables_per_session', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Attachment Size (MB)</Label>
                  <Input
                    type="number"
                    value={getValue('max_attachment_size_mb') || 100}
                    onChange={(e) => handleChange('max_attachment_size_mb', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-medium">Retention Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Attachment Retention (days)</Label>
                  <Input
                    type="number"
                    value={getValue('attachment_retention_days') || 90}
                    onChange={(e) => handleChange('attachment_retention_days', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Recording Retention (days)</Label>
                  <Input
                    type="number"
                    value={getValue('recording_retention_days') || 365}
                    onChange={(e) => handleChange('recording_retention_days', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Overrides Tab */}
        <TabsContent value="overrides">
          <Card>
            <CardHeader>
              <CardTitle>User Override Permissions</CardTitle>
              <CardDescription>Control which settings users can override at the personal level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When enabled, users can turn these features on/off for themselves (but only if the tenant has the feature enabled).
              </p>
              <div className="grid grid-cols-2 gap-6">
                <FeatureToggle
                  icon={<Brain className="h-5 w-5" />}
                  label="Allow AI Facilitator Override"
                  description="Users can enable/disable AI facilitator for themselves"
                  checked={getValue('allow_user_override_facilitator') ?? true}
                  onChange={(v) => handleChange('allow_user_override_facilitator', v)}
                />
                <FeatureToggle
                  icon={<GitBranch className="h-5 w-5" />}
                  label="Allow Branch & Merge Override"
                  description="Users can enable/disable branching for themselves"
                  checked={getValue('allow_user_override_branch_merge') ?? true}
                  onChange={(v) => handleChange('allow_user_override_branch_merge', v)}
                />
                <FeatureToggle
                  icon={<Clock className="h-5 w-5" />}
                  label="Allow Playback Override"
                  description="Users can enable/disable time-shifted playback"
                  checked={getValue('allow_user_override_playback') ?? true}
                  onChange={(v) => handleChange('allow_user_override_playback', v)}
                />
                <FeatureToggle
                  icon={<Users className="h-5 w-5" />}
                  label="Allow Roundtable Override"
                  description="Users can enable/disable AI roundtable"
                  checked={getValue('allow_user_override_roundtable') ?? true}
                  onChange={(v) => handleChange('allow_user_override_roundtable', v)}
                />
                <FeatureToggle
                  icon={<Share2 className="h-5 w-5" />}
                  label="Allow Knowledge Graph Override"
                  description="Users can enable/disable knowledge graph"
                  checked={getValue('allow_user_override_knowledge_graph') ?? true}
                  onChange={(v) => handleChange('allow_user_override_knowledge_graph', v)}
                />
                <FeatureToggle
                  icon={<UserPlus className="h-5 w-5" />}
                  label="Allow Guest Invites"
                  description="Users can invite guests (if disabled, only admins can)"
                  checked={getValue('allow_user_override_guest_invite') ?? true}
                  onChange={(v) => handleChange('allow_user_override_guest_invite', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Viral Growth Tab */}
        <TabsContent value="viral">
          <Card>
            <CardHeader>
              <CardTitle>Viral Growth Settings</CardTitle>
              <CardDescription>Configure guest conversion incentives and tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FeatureToggle
                icon={<TrendingUp className="h-5 w-5" />}
                label="Enable Viral Tracking"
                description="Track guest-to-paid conversion funnel"
                checked={getValue('enable_viral_tracking') ?? true}
                onChange={(v) => handleChange('enable_viral_tracking', v)}
              />

              <Separator />

              <h4 className="font-medium">Conversion Incentives</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Guest Conversion Bonus (credits)</Label>
                  <Input
                    type="number"
                    value={getValue('guest_conversion_incentive_credits') || 100}
                    onChange={(e) => handleChange('guest_conversion_incentive_credits', parseInt(e.target.value))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Credits given to guest when they convert to paid</p>
                </div>
                <div>
                  <Label>Referrer Bonus (credits)</Label>
                  <Input
                    type="number"
                    value={getValue('referrer_bonus_credits') || 50}
                    onChange={(e) => handleChange('referrer_bonus_credits', parseInt(e.target.value))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Credits given to user who invited the converted guest</p>
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Viral Growth Metrics</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Guests Invited</p>
                    <p className="text-xl font-bold">{stats.totalGuests || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Converted to Paid</p>
                    <p className="text-xl font-bold">{stats.convertedGuests || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conversion Rate</p>
                    <p className="text-xl font-bold">{stats.conversionRate || 0}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pending Changes Banner */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
          <span>You have unsaved changes</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPendingChanges({})}
          >
            Discard
          </Button>
          <Button
            size="sm"
            onClick={saveChanges}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function FeatureToggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <Label className="font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
