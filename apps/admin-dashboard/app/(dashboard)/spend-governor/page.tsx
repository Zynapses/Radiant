'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldAlert,
  DollarSign,
  Snowflake,
  Sun,
  AlertTriangle,
  Activity,
  Clock,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Shield,
  Send,
  History,
  Gauge,
} from 'lucide-react';
import { api } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

interface InstanceConfig {
  budgetUsd: number;
  periodHours: number;
  warningThreshold: number;
  suspendThreshold: number;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenReason: string | null;
  currentSpendUsd: number;
  costReportIntervalHours: number;
  lastCostReportAt: string | null;
}

interface TenantConfig {
  tenantId: string;
  budgetUsd: number;
  periodHours: number;
  warningThreshold: number;
  suspendThreshold: number;
  perModelLimitUsd: number;
  isEnabled: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  currentSpendUsd: number;
}

interface AuditEntry {
  id: string;
  tenant_id: string | null;
  action: string;
  scope: string;
  budget_usd: number;
  spent_usd: number;
  percent_used: number;
  reason: string;
  performed_by: string;
  created_at: string;
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchInstanceConfig(): Promise<InstanceConfig> {
  return api.get<InstanceConfig>('/api/admin/spend-governor/instance');
}

async function fetchTenantConfigs(): Promise<TenantConfig[]> {
  return api.get<TenantConfig[]>('/api/admin/spend-governor/tenants');
}

async function fetchAuditLog(): Promise<AuditEntry[]> {
  return api.get<AuditEntry[]>('/api/admin/spend-governor/audit');
}

// ============================================================================
// Page Component
// ============================================================================

export default function SpendGovernorPage() {
  const queryClient = useQueryClient();

  const { data: instanceConfig, isLoading: instanceLoading } = useQuery({
    queryKey: ['spend-governor-instance'],
    queryFn: fetchInstanceConfig,
    refetchInterval: 30_000,
  });

  const { data: tenantConfigs = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['spend-governor-tenants'],
    queryFn: fetchTenantConfigs,
    refetchInterval: 30_000,
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ['spend-governor-audit'],
    queryFn: fetchAuditLog,
    refetchInterval: 60_000,
  });

  const isLoading = instanceLoading || tenantsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isFrozen = instanceConfig?.isFrozen ?? false;
  const instancePercent = instanceConfig && instanceConfig.budgetUsd > 0
    ? (instanceConfig.currentSpendUsd / instanceConfig.budgetUsd) * 100
    : 0;
  const suspendedTenants = tenantConfigs.filter(t => t.isSuspended);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gauge className="h-8 w-8" />
            Spend Governor
          </h1>
          <p className="text-muted-foreground mt-1">
            Budget controls, spend limits, and cost reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFrozen && (
            <Badge variant="destructive" className="text-base px-4 py-1.5 animate-pulse">
              <Snowflake className="h-4 w-4 mr-1.5" />
              AWS FROZEN
            </Badge>
          )}
          {suspendedTenants.length > 0 && (
            <Badge variant="destructive" className="text-base px-4 py-1.5">
              <ShieldAlert className="h-4 w-4 mr-1.5" />
              {suspendedTenants.length} Tenant{suspendedTenants.length !== 1 ? 's' : ''} Suspended
            </Badge>
          )}
        </div>
      </div>

      {/* Instance Freeze Banner */}
      {isFrozen && (
        <Card className="border-red-600 bg-red-950/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Snowflake className="h-8 w-8 text-red-400" />
              <div>
                <p className="font-bold text-red-300 text-lg">AWS Services Are Frozen</p>
                <p className="text-red-400 text-sm">
                  {instanceConfig?.frozenReason || 'Budget exceeded. Use Deployer to restore.'}
                </p>
                {instanceConfig?.frozenAt && (
                  <p className="text-red-500 text-xs mt-1">
                    Frozen at {new Date(instanceConfig.frozenAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <ThawButton onSuccess={() => queryClient.invalidateQueries({ queryKey: ['spend-governor-instance'] })} />
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Instance Budget</CardDescription>
            <CardTitle className="text-2xl">
              ${instanceConfig?.budgetUsd?.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress
                value={Math.min(instancePercent, 100)}
                className={instancePercent > 90 ? 'bg-red-200' : instancePercent > 70 ? 'bg-amber-200' : ''}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>${instanceConfig?.currentSpendUsd?.toFixed(2) || '0'} spent</span>
                <span>{instancePercent.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget Period</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1.5">
              <Clock className="h-5 w-5" />
              {formatPeriod(instanceConfig?.periodHours || 720)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">
              Rolling window
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Tenants</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1.5">
              <Users className="h-5 w-5" />
              {tenantConfigs.filter(t => t.isEnabled).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">
              with spend controls
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost Reports</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1.5">
              <Send className="h-5 w-5" />
              Every {formatPeriod(instanceConfig?.costReportIntervalHours || 24)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">
              {instanceConfig?.lastCostReportAt
                ? `Last: ${new Date(instanceConfig.lastCostReportAt).toLocaleString()}`
                : 'No reports sent yet'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenant Budgets</TabsTrigger>
          <TabsTrigger value="instance">Instance Settings</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Tenant Budgets Tab */}
        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Per-Tenant AI Spend Limits</CardTitle>
              <CardDescription>
                Configure budget limits per tenant. Models are suspended when limits are exceeded.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenantConfigs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No tenant budgets configured</p>
                  <p className="text-sm mt-1">Use the API or Deployer to set tenant budgets</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tenantConfigs.map(tenant => (
                    <TenantBudgetRow
                      key={tenant.tenantId}
                      tenant={tenant}
                      onAction={() => queryClient.invalidateQueries({ queryKey: ['spend-governor-tenants'] })}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instance Settings Tab */}
        <TabsContent value="instance" className="space-y-4">
          <InstanceSettingsCard
            config={instanceConfig!}
            onSave={() => queryClient.invalidateQueries({ queryKey: ['spend-governor-instance'] })}
          />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Governor Audit Log
              </CardTitle>
              <CardDescription>History of all spend governor actions</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No audit entries yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {auditLog.map(entry => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function TenantBudgetRow({
  tenant,
  onAction,
}: {
  tenant: TenantConfig;
  onAction: () => void;
}) {
  const percent = tenant.budgetUsd > 0
    ? (tenant.currentSpendUsd / tenant.budgetUsd) * 100
    : 0;

  const restoreMutation = useMutation({
    mutationFn: () => api.post(`/api/admin/spend-governor/tenants/${tenant.tenantId}/restore`),
    onSuccess: onAction,
  });

  return (
    <div className={`flex items-center gap-4 p-3 rounded-lg border ${
      tenant.isSuspended ? 'border-red-600 bg-red-950/20' : 'border-slate-800 bg-slate-900/30'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm truncate">{tenant.tenantId}</span>
          {tenant.isSuspended && (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="h-3 w-3 mr-1" /> Suspended
            </Badge>
          )}
          {!tenant.isSuspended && tenant.isEnabled && (
            <Badge className="bg-emerald-600 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1.5">
          <div className="flex-1">
            <Progress
              value={Math.min(percent, 100)}
              className={`h-1.5 ${percent > 90 ? 'bg-red-200' : percent > 70 ? 'bg-amber-200' : ''}`}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ${tenant.currentSpendUsd.toFixed(2)} / ${tenant.budgetUsd.toFixed(2)}
            ({percent.toFixed(1)}%) &middot; {formatPeriod(tenant.periodHours)}
          </span>
        </div>
      </div>
      {tenant.isSuspended && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => restoreMutation.mutate()}
          disabled={restoreMutation.isPending}
          className="border-emerald-600 text-emerald-400 hover:bg-emerald-950"
        >
          {restoreMutation.isPending ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <Sun className="h-3.5 w-3.5 mr-1" />
          )}
          Restore
        </Button>
      )}
    </div>
  );
}

function InstanceSettingsCard({
  config,
  onSave,
}: {
  config: InstanceConfig;
  onSave: () => void;
}) {
  const [budgetUsd, setBudgetUsd] = useState(String(config.budgetUsd));
  const [periodHours, setPeriodHours] = useState(String(config.periodHours));
  const [periodUnit, setPeriodUnit] = useState<'hours' | 'days'>(
    config.periodHours >= 24 && config.periodHours % 24 === 0 ? 'days' : 'hours'
  );
  const [reportInterval, setReportInterval] = useState(String(config.costReportIntervalHours));
  const [reportUnit, setReportUnit] = useState<'hours' | 'days'>(
    config.costReportIntervalHours >= 24 && config.costReportIntervalHours % 24 === 0 ? 'days' : 'hours'
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const hours = periodUnit === 'days'
        ? Number(periodHours) * 24
        : Number(periodHours);
      const reportHours = reportUnit === 'days'
        ? Number(reportInterval) * 24
        : Number(reportInterval);

      return api.put('/api/admin/spend-governor/instance', {
        budgetUsd: Number(budgetUsd),
        periodHours: hours,
        costReportIntervalHours: reportHours,
      });
    },
    onSuccess: onSave,
  });

  const displayPeriod = periodUnit === 'days'
    ? String(Number(periodHours))
    : String(Number(periodHours));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instance Budget Settings</CardTitle>
        <CardDescription>
          Global AWS spend limits. When exceeded, services are frozen to prevent charges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="budget">Budget Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="budget"
                type="number"
                value={budgetUsd}
                onChange={e => setBudgetUsd(e.target.value)}
                className="pl-9"
                min={0}
                step={100}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Budget Period</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={periodUnit === 'days' ? String(Math.round(Number(periodHours) / 24)) : periodHours}
                onChange={e => {
                  const val = e.target.value;
                  setPeriodHours(periodUnit === 'days' ? String(Number(val) * 24) : val);
                }}
                min={1}
                className="flex-1"
              />
              <Select value={periodUnit} onValueChange={(v: 'hours' | 'days') => {
                if (v === 'days' && periodUnit === 'hours') {
                  setPeriodHours(String(Math.max(24, Math.round(Number(periodHours) / 24) * 24)));
                } else if (v === 'hours' && periodUnit === 'days') {
                  setPeriodHours(String(Number(periodHours)));
                }
                setPeriodUnit(v);
              }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Cost Report Interval</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={reportUnit === 'days' ? String(Math.round(Number(reportInterval) / 24)) : reportInterval}
                onChange={e => {
                  const val = e.target.value;
                  setReportInterval(reportUnit === 'days' ? String(Number(val) * 24) : val);
                }}
                min={1}
                className="flex-1"
              />
              <Select value={reportUnit} onValueChange={(v: 'hours' | 'days') => {
                if (v === 'days' && reportUnit === 'hours') {
                  setReportInterval(String(Math.max(24, Math.round(Number(reportInterval) / 24) * 24)));
                } else if (v === 'hours' && reportUnit === 'days') {
                  setReportInterval(String(Number(reportInterval)));
                }
                setReportUnit(v);
              }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              How often cost summaries are emailed to super admins
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Save Instance Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThawButton({ onSuccess }: { onSuccess: () => void }) {
  const thawMutation = useMutation({
    mutationFn: () => api.post('/api/admin/spend-governor/instance/thaw'),
    onSuccess,
  });

  return (
    <Button
      onClick={() => thawMutation.mutate()}
      disabled={thawMutation.isPending}
      className="bg-emerald-600 hover:bg-emerald-700"
    >
      {thawMutation.isPending ? (
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Sun className="h-4 w-4 mr-2" />
      )}
      Restore AWS Services
    </Button>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const actionConfig = auditActionConfig[entry.action] || {
    icon: Activity,
    color: 'text-slate-400',
    label: entry.action,
  };

  return (
    <div className="flex items-start gap-3 p-2.5 rounded border border-slate-800 bg-slate-900/20 text-sm">
      <actionConfig.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${actionConfig.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${actionConfig.color}`}>{actionConfig.label}</span>
          <Badge variant="outline" className="text-xs">
            {entry.scope}
          </Badge>
          {entry.tenant_id && (
            <span className="text-xs text-muted-foreground font-mono truncate">
              {entry.tenant_id.substring(0, 8)}...
            </span>
          )}
        </div>
        {entry.reason && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.reason}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-muted-foreground">
          {new Date(entry.created_at).toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.performed_by}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatPeriod(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

const auditActionConfig: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  warning_sent: { icon: AlertTriangle, color: 'text-amber-400', label: 'Warning Sent' },
  models_suspended: { icon: XCircle, color: 'text-red-400', label: 'Models Suspended' },
  models_restored: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Models Restored' },
  budget_set: { icon: Shield, color: 'text-blue-400', label: 'Budget Set' },
  budget_increased: { icon: DollarSign, color: 'text-emerald-400', label: 'Budget Increased' },
  override_granted: { icon: Shield, color: 'text-purple-400', label: 'Override Granted' },
  override_expired: { icon: Clock, color: 'text-slate-400', label: 'Override Expired' },
  instance_frozen: { icon: Snowflake, color: 'text-red-400', label: 'Instance Frozen' },
  instance_thawed: { icon: Sun, color: 'text-emerald-400', label: 'Instance Thawed' },
  instance_budget_set: { icon: Shield, color: 'text-blue-400', label: 'Instance Budget Set' },
  cost_report_sent: { icon: Send, color: 'text-blue-400', label: 'Cost Report Sent' },
};
