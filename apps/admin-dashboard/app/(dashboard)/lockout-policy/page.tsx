'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield,
  ShieldCheck,
  Lock,
  Clock,
  Save,
  RotateCcw,
  AlertTriangle,
  Timer,
  Users,
  Bell,
  Settings,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface LockoutPolicy {
  tenantId: string | null;
  duration1st: number;
  duration2nd: number;
  duration3rd: number;
  permanentAfter: number;
  offenseWindowDays: number;
  permanentWindowDays: number;
  selfServiceEnabled: boolean;
  selfServiceMaxOffense: number;
  selfServiceMethod: string;
  autoUnlockEnabled: boolean;
  notifyUserOnLock: boolean;
  notifyAdminOnPermanent: boolean;
}

const DEFAULT_POLICY: LockoutPolicy = {
  tenantId: null,
  duration1st: 30,
  duration2nd: 120,
  duration3rd: 1440,
  permanentAfter: 4,
  offenseWindowDays: 7,
  permanentWindowDays: 30,
  selfServiceEnabled: false,
  selfServiceMaxOffense: 2,
  selfServiceMethod: 'email',
  autoUnlockEnabled: true,
  notifyUserOnLock: true,
  notifyAdminOnPermanent: true,
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hr`;
  return `${(minutes / 1440).toFixed(minutes % 1440 === 0 ? 0 : 1)} day`;
}

// ============================================================================
// Main Page
// ============================================================================

export default function LockoutPolicyPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LockoutPolicy>(DEFAULT_POLICY);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: policyData, isLoading } = useQuery<{ policy: LockoutPolicy | null }>({
    queryKey: ['ridps-lockout-policy'],
    queryFn: () => api.get('/admin/intrusion-detection/lockout-policy'),
  });

  const { data: lockedData } = useQuery<{ lockedAccounts: Array<{ userId: string; isPermanent: boolean }> }>({
    queryKey: ['ridps-locked-accounts'],
    queryFn: () => api.get('/admin/intrusion-detection/locked-accounts'),
    refetchInterval: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<LockoutPolicy>) =>
      api.put('/admin/intrusion-detection/lockout-policy', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ridps-lockout-policy'] });
      setHasChanges(false);
    },
  });

  // Sync form when policy loads
  useEffect(() => {
    if (policyData?.policy) {
      setForm(policyData.policy);
      setHasChanges(false);
    }
  }, [policyData]);

  const policy = policyData?.policy || DEFAULT_POLICY;
  const lockedAccounts = lockedData?.lockedAccounts || [];
  const permanentCount = lockedAccounts.filter(a => a.isPermanent).length;
  const timedCount = lockedAccounts.length - permanentCount;

  const updateField = <K extends keyof LockoutPolicy>(key: K, value: LockoutPolicy[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetForm = () => {
    setForm(policyData?.policy || DEFAULT_POLICY);
    setHasChanges(false);
  };

  const handleSave = () => {
    saveMutation.mutate({
      duration1st: form.duration1st,
      duration2nd: form.duration2nd,
      duration3rd: form.duration3rd,
      permanentAfter: form.permanentAfter,
      offenseWindowDays: form.offenseWindowDays,
      permanentWindowDays: form.permanentWindowDays,
      selfServiceEnabled: form.selfServiceEnabled,
      selfServiceMaxOffense: form.selfServiceMaxOffense,
      selfServiceMethod: form.selfServiceMethod,
      autoUnlockEnabled: form.autoUnlockEnabled,
      notifyUserOnLock: form.notifyUserOnLock,
      notifyAdminOnPermanent: form.notifyAdminOnPermanent,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lock className="h-8 w-8 text-red-600" />
            Lockout Policy
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure progressive account lockout durations, auto-unlock behavior, and notification settings.
            Changes apply to all future lockouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/intrusion-detection">
            <Button variant="outline" size="sm">
              <ShieldCheck className="h-4 w-4 mr-1" /> Intrusion Detection
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          {hasChanges && (
            <>
              <Button variant="outline" size="sm" onClick={resetForm}>
                <RotateCcw className="h-4 w-4 mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currently Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockedAccounts.length}</div>
            <div className="flex gap-2 mt-1">
              {timedCount > 0 && <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">{timedCount} timed</Badge>}
              {permanentCount > 0 && <Badge variant="destructive">{permanentCount} permanent</Badge>}
              {lockedAccounts.length === 0 && <span className="text-sm text-muted-foreground">No locked accounts</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Auto-Unlock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policy.autoUnlockEnabled ? 'Enabled' : 'Disabled'}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {policy.autoUnlockEnabled
                ? 'Timed lockouts auto-expire on schedule'
                : 'All lockouts require manual admin review'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Permanent Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policy.permanentAfter} offenses</div>
            <p className="text-sm text-muted-foreground mt-1">
              Within {policy.permanentWindowDays} days triggers permanent lock
            </p>
          </CardContent>
        </Card>
      </div>

      {saveMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <ShieldCheck className="h-4 w-4" /> Policy saved successfully. Changes apply to all future lockouts.
        </div>
      )}

      {saveMutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4" /> Failed to save policy. Please try again.
        </div>
      )}

      {/* Progressive Lockout Durations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" /> Progressive Lockout Durations
          </CardTitle>
          <CardDescription>
            Each subsequent offense within the offense window results in a longer lockout.
            Durations are in <strong>minutes</strong>. After the permanent threshold, the account is locked until an admin reviews it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Visual timeline */}
          <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lockout Escalation Timeline</span>
            </div>
            <div className="flex items-center gap-0">
              {[
                { label: '1st', value: form.duration1st, color: 'bg-yellow-400' },
                { label: '2nd', value: form.duration2nd, color: 'bg-orange-400' },
                { label: '3rd', value: form.duration3rd, color: 'bg-red-400' },
                { label: `${form.permanentAfter}th+`, value: null, color: 'bg-red-700' },
              ].map((step, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`h-2 ${step.color} ${i === 0 ? 'rounded-l-full' : ''} ${step.value === null ? 'rounded-r-full' : ''}`} />
                  <div className="mt-2">
                    <div className="text-xs font-medium">{step.label} offense</div>
                    <div className="text-xs text-muted-foreground">
                      {step.value !== null ? formatDuration(step.value) : 'PERMANENT'}
                    </div>
                  </div>
                  {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-auto mt-1" />}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="duration1st">1st Offense (minutes)</Label>
              <Input
                id="duration1st"
                type="number"
                min={1}
                max={43200}
                value={form.duration1st}
                onChange={e => updateField('duration1st', parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">Default: 30 min</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration2nd">2nd Offense (minutes)</Label>
              <Input
                id="duration2nd"
                type="number"
                min={1}
                max={43200}
                value={form.duration2nd}
                onChange={e => updateField('duration2nd', parseInt(e.target.value) || 120)}
              />
              <p className="text-xs text-muted-foreground">Default: 120 min (2 hr)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration3rd">3rd Offense (minutes)</Label>
              <Input
                id="duration3rd"
                type="number"
                min={1}
                max={43200}
                value={form.duration3rd}
                onChange={e => updateField('duration3rd', parseInt(e.target.value) || 1440)}
              />
              <p className="text-xs text-muted-foreground">Default: 1440 min (24 hr)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permanentAfter">Permanent After (# offenses)</Label>
              <Input
                id="permanentAfter"
                type="number"
                min={2}
                max={20}
                value={form.permanentAfter}
                onChange={e => updateField('permanentAfter', parseInt(e.target.value) || 4)}
              />
              <p className="text-xs text-muted-foreground">Default: 4 offenses</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offense Windows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Offense Windows
          </CardTitle>
          <CardDescription>
            How far back to look when counting offenses. Offenses outside the window are not counted toward escalation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offenseWindowDays">Offense Window (days)</Label>
              <Input
                id="offenseWindowDays"
                type="number"
                min={1}
                max={365}
                value={form.offenseWindowDays}
                onChange={e => updateField('offenseWindowDays', parseInt(e.target.value) || 7)}
              />
              <p className="text-xs text-muted-foreground">
                Offenses within this window count toward the progressive escalation (1st → 2nd → 3rd). Default: 7 days.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permanentWindowDays">Permanent Window (days)</Label>
              <Input
                id="permanentWindowDays"
                type="number"
                min={1}
                max={365}
                value={form.permanentWindowDays}
                onChange={e => updateField('permanentWindowDays', parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">
                Offenses within this window count toward the permanent lockout threshold. Default: 30 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Unlock & Notifications */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Auto-Unlock
            </CardTitle>
            <CardDescription>
              When enabled, timed lockouts are automatically cleared when they expire.
              Permanent lockouts always require admin review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Unlock Enabled</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Automatically unlock expired timed lockouts</p>
              </div>
              <Switch
                checked={form.autoUnlockEnabled}
                onCheckedChange={v => updateField('autoUnlockEnabled', v)}
              />
            </div>
            {!form.autoUnlockEnabled && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                All lockouts (including timed) will require admin intervention to unlock.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notifications
            </CardTitle>
            <CardDescription>
              Configure who gets notified when accounts are locked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notify User on Lock</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Send email to user when their account is locked</p>
              </div>
              <Switch
                checked={form.notifyUserOnLock}
                onCheckedChange={v => updateField('notifyUserOnLock', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Notify Admin on Permanent</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Alert admins via SENTINEL when a permanent lock occurs</p>
              </div>
              <Switch
                checked={form.notifyAdminOnPermanent}
                onCheckedChange={v => updateField('notifyAdminOnPermanent', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Self-Service Unlock */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Self-Service Unlock
          </CardTitle>
          <CardDescription>
            Allow users to unlock their own accounts for low-offense lockouts via email or MFA verification.
            Only applies to timed lockouts below the max offense threshold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Self-Service Enabled</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Allow users to self-unlock their accounts</p>
            </div>
            <Switch
              checked={form.selfServiceEnabled}
              onCheckedChange={v => updateField('selfServiceEnabled', v)}
            />
          </div>
          {form.selfServiceEnabled && (
            <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
              <div className="space-y-2">
                <Label htmlFor="selfServiceMaxOffense">Max Offense for Self-Service</Label>
                <Input
                  id="selfServiceMaxOffense"
                  type="number"
                  min={1}
                  max={form.permanentAfter - 1}
                  value={form.selfServiceMaxOffense}
                  onChange={e => updateField('selfServiceMaxOffense', parseInt(e.target.value) || 2)}
                />
                <p className="text-xs text-muted-foreground">
                  Users can self-unlock up to offense #{form.selfServiceMaxOffense}. Higher offenses require admin.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Verification Method</Label>
                <Select value={form.selfServiceMethod} onValueChange={v => updateField('selfServiceMethod', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Verification</SelectItem>
                    <SelectItem value="mfa">MFA Verification</SelectItem>
                    <SelectItem value="email_and_mfa">Email + MFA</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How the user proves identity to self-unlock</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NIST Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Compliance Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="p-3 rounded bg-muted/50">
              <div className="font-medium">NIST SP 800-63B §5.2.8</div>
              <div className="text-xs text-muted-foreground mt-1">Progressive lockout with time-limited durations</div>
            </div>
            <div className="p-3 rounded bg-muted/50">
              <div className="font-medium">OWASP ASVS V2.2.1</div>
              <div className="text-xs text-muted-foreground mt-1">Anti-automation via account lockout</div>
            </div>
            <div className="p-3 rounded bg-muted/50">
              <div className="font-medium">CIS Control 6.2</div>
              <div className="text-xs text-muted-foreground mt-1">Account lockout after failed authentication attempts</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200 shadow-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>
                <RotateCcw className="h-4 w-4 mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
