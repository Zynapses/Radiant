'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Settings, Clock, GitBranch, MessageSquare, Brain,
  Share2, Bell, Loader2, Save, RefreshCw, Eye
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

async function fetchUserSettings() {
  const res = await fetch(`${API_BASE}/api/admin/collaboration-settings/user`);
  if (!res.ok) throw new Error('Failed to fetch user settings');
  const { data } = await res.json();
  return data;
}

async function fetchEffectiveSettings() {
  const res = await fetch(`${API_BASE}/api/admin/collaboration-settings/effective`);
  if (!res.ok) throw new Error('Failed to fetch effective settings');
  const { data } = await res.json();
  return data;
}

async function updateUserSettings(settings: any) {
  const res = await fetch(`${API_BASE}/api/admin/collaboration-settings/user`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  const { data } = await res.json();
  return data;
}

export default function UserCollaborationSettingsPage() {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});

  const { data: userSettings, isLoading: loadingUser } = useQuery({
    queryKey: ['user-collaboration-settings'],
    queryFn: fetchUserSettings,
  });

  const { data: effectiveSettings, isLoading: loadingEffective } = useQuery({
    queryKey: ['effective-collaboration-settings'],
    queryFn: fetchEffectiveSettings,
  });

  const updateMutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-collaboration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['effective-collaboration-settings'] });
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
    return userSettings?.[field];
  };

  const saveChanges = () => {
    if (Object.keys(pendingChanges).length > 0) {
      updateMutation.mutate(pendingChanges);
    }
  };

  const isLoading = loadingUser || loadingEffective;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            My Collaboration Settings
          </h1>
          <p className="text-muted-foreground">
            Personalize your collaboration experience
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['user-collaboration-settings'] });
              queryClient.invalidateQueries({ queryKey: ['effective-collaboration-settings'] });
            }}
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

      {/* Effective Settings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Your Effective Settings
          </CardTitle>
          <CardDescription>
            These are your final settings based on tenant policies and your preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <EffectiveBadge label="Collaborative Chat" enabled={effectiveSettings?.enable_collaborative_chat} />
            <EffectiveBadge label="AI Facilitator" enabled={effectiveSettings?.enable_ai_facilitator} />
            <EffectiveBadge label="Branch & Merge" enabled={effectiveSettings?.enable_branch_merge} />
            <EffectiveBadge label="Playback" enabled={effectiveSettings?.enable_time_shifted_playback} />
            <EffectiveBadge label="AI Roundtable" enabled={effectiveSettings?.enable_ai_roundtable} />
            <EffectiveBadge label="Knowledge Graph" enabled={effectiveSettings?.enable_knowledge_graph} />
            <EffectiveBadge label="Guest Invites" enabled={effectiveSettings?.can_invite_guests} />
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">Feature Preferences</TabsTrigger>
          <TabsTrigger value="facilitator">AI Facilitator</TabsTrigger>
          <TabsTrigger value="defaults">Session Defaults</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Preferences</CardTitle>
              <CardDescription>
                Override tenant defaults for features (where allowed by your admin)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set to &quot;Use Tenant Default&quot; to inherit the organization setting, or override with your preference.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FeatureOverride
                  label="AI Facilitator"
                  description="AI moderator for discussions"
                  value={getValue('enable_ai_facilitator')}
                  onChange={(v) => handleChange('enable_ai_facilitator', v)}
                />
                <FeatureOverride
                  label="Branch & Merge"
                  description="Fork conversations"
                  value={getValue('enable_branch_merge')}
                  onChange={(v) => handleChange('enable_branch_merge', v)}
                />
                <FeatureOverride
                  label="Time-Shifted Playback"
                  description="Session recordings"
                  value={getValue('enable_time_shifted_playback')}
                  onChange={(v) => handleChange('enable_time_shifted_playback', v)}
                />
                <FeatureOverride
                  label="AI Roundtable"
                  description="Multi-model debate"
                  value={getValue('enable_ai_roundtable')}
                  onChange={(v) => handleChange('enable_ai_roundtable', v)}
                />
                <FeatureOverride
                  label="Knowledge Graph"
                  description="Visual knowledge"
                  value={getValue('enable_knowledge_graph')}
                  onChange={(v) => handleChange('enable_knowledge_graph', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Facilitator Tab */}
        <TabsContent value="facilitator">
          <Card>
            <CardHeader>
              <CardTitle>AI Facilitator Preferences</CardTitle>
              <CardDescription>Customize how the AI facilitator behaves in your sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Preferred Persona</Label>
                <Select
                  value={getValue('preferred_facilitator_persona') || ''}
                  onValueChange={(v) => handleChange('preferred_facilitator_persona', v || null)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Use tenant default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use tenant default</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                    <SelectItem value="socratic">Socratic</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <h4 className="font-medium">Facilitator Behaviors</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Summarize</Label>
                    <p className="text-sm text-muted-foreground">Generate periodic summaries</p>
                  </div>
                  <Switch
                    checked={getValue('facilitator_auto_summarize') ?? true}
                    onCheckedChange={(v) => handleChange('facilitator_auto_summarize', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Action Items</Label>
                    <p className="text-sm text-muted-foreground">Extract tasks automatically</p>
                  </div>
                  <Switch
                    checked={getValue('facilitator_auto_action_items') ?? true}
                    onCheckedChange={(v) => handleChange('facilitator_auto_action_items', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ensure Participation</Label>
                    <p className="text-sm text-muted-foreground">Prompt quiet participants</p>
                  </div>
                  <Switch
                    checked={getValue('facilitator_ensure_participation') ?? true}
                    onCheckedChange={(v) => handleChange('facilitator_ensure_participation', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Keep On Topic</Label>
                    <p className="text-sm text-muted-foreground">Redirect off-topic discussions</p>
                  </div>
                  <Switch
                    checked={getValue('facilitator_keep_on_topic') ?? true}
                    onCheckedChange={(v) => handleChange('facilitator_keep_on_topic', v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session Defaults Tab */}
        <TabsContent value="defaults">
          <Card>
            <CardHeader>
              <CardTitle>Session Defaults</CardTitle>
              <CardDescription>Default settings for new sessions you create</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Session Name Template</Label>
                <Input
                  value={getValue('default_session_name_template') || 'Session {date}'}
                  onChange={(e) => handleChange('default_session_name_template', e.target.value)}
                  className="mt-1"
                  placeholder="Session {date}"
                />
                <p className="text-xs text-muted-foreground mt-1">Use {'{date}'} for current date</p>
              </div>
              <div>
                <Label>Default Access Type</Label>
                <Select
                  value={getValue('default_session_access_type') || 'invite'}
                  onValueChange={(v) => handleChange('default_session_access_type', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invite">Invite Only</SelectItem>
                    <SelectItem value="link">Anyone with Link</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Participant Permission</Label>
                <Select
                  value={getValue('default_participant_permission') || 'editor'}
                  onValueChange={(v) => handleChange('default_participant_permission', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="commenter">Commenter</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <h4 className="font-medium">Recording Defaults</h4>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Start Recording</Label>
                  <p className="text-sm text-muted-foreground">Start recording when session begins</p>
                </div>
                <Switch
                  checked={getValue('auto_start_recording') ?? false}
                  onCheckedChange={(v) => handleChange('auto_start_recording', v)}
                />
              </div>
              <div>
                <Label>Default Recording Type</Label>
                <Select
                  value={getValue('default_recording_type') || 'full'}
                  onValueChange={(v) => handleChange('default_recording_type', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Recording</SelectItem>
                    <SelectItem value="highlights">Highlights Only</SelectItem>
                    <SelectItem value="summary">AI Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control what collaboration events notify you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NotificationToggle
                label="Guest Joins"
                description="When a guest joins your session"
                checked={getValue('notify_on_guest_join') ?? true}
                onChange={(v) => handleChange('notify_on_guest_join', v)}
              />
              <NotificationToggle
                label="Branch Created"
                description="When someone creates a branch"
                checked={getValue('notify_on_branch_created') ?? true}
                onChange={(v) => handleChange('notify_on_branch_created', v)}
              />
              <NotificationToggle
                label="Merge Request"
                description="When a merge request is submitted"
                checked={getValue('notify_on_merge_request') ?? true}
                onChange={(v) => handleChange('notify_on_merge_request', v)}
              />
              <NotificationToggle
                label="Roundtable Complete"
                description="When an AI roundtable finishes"
                checked={getValue('notify_on_roundtable_complete') ?? true}
                onChange={(v) => handleChange('notify_on_roundtable_complete', v)}
              />
              <NotificationToggle
                label="Annotations"
                description="When someone adds an async annotation"
                checked={getValue('notify_on_annotation') ?? true}
                onChange={(v) => handleChange('notify_on_annotation', v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize the collaboration interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Knowledge Graph Sidebar</Label>
                  <p className="text-sm text-muted-foreground">Display graph in sidebar by default</p>
                </div>
                <Switch
                  checked={getValue('show_knowledge_graph_sidebar') ?? true}
                  onCheckedChange={(v) => handleChange('show_knowledge_graph_sidebar', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Participant Avatars</Label>
                  <p className="text-sm text-muted-foreground">Display avatars in chat</p>
                </div>
                <Switch
                  checked={getValue('show_participant_avatars') ?? true}
                  onCheckedChange={(v) => handleChange('show_participant_avatars', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Collapse Participants Sidebar</Label>
                  <p className="text-sm text-muted-foreground">Start with sidebar collapsed</p>
                </div>
                <Switch
                  checked={getValue('collapsed_participants_sidebar') ?? false}
                  onCheckedChange={(v) => handleChange('collapsed_participants_sidebar', v)}
                />
              </div>
              <div>
                <Label>Preferred View</Label>
                <Select
                  value={getValue('preferred_view') || 'chat'}
                  onValueChange={(v) => handleChange('preferred_view', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="branches">Branches</SelectItem>
                    <SelectItem value="roundtable">AI Roundtable</SelectItem>
                    <SelectItem value="knowledge">Knowledge Graph</SelectItem>
                    <SelectItem value="playback">Playback</SelectItem>
                  </SelectContent>
                </Select>
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

function EffectiveBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Badge variant={enabled ? 'default' : 'secondary'}>
      {enabled ? '✓' : '✗'} {label}
    </Badge>
  );
}

function FeatureOverride({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div className="p-4 border rounded-lg">
      <Label className="font-medium">{label}</Label>
      <p className="text-sm text-muted-foreground mb-2">{description}</p>
      <Select
        value={value === null || value === undefined ? 'default' : value ? 'on' : 'off'}
        onValueChange={(v) => onChange(v === 'default' ? null : v === 'on')}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Use Tenant Default</SelectItem>
          <SelectItem value="on">Enable</SelectItem>
          <SelectItem value="off">Disable</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
