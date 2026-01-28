'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Clock, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Timer,
  Activity,
  Shield,
  BarChart3,
  History,
  Settings,
  Zap,
  Bell,
  Webhook,
  FileText,
  Layers,
  Power,
  PowerOff,
  Trash2,
  Plus,
  Copy
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ScheduleConfig {
  type: string;
  enabled: boolean;
  cronExpression: string;
  description: string;
  lastExecution?: string;
  nextExecution?: string;
}

interface ScheduleExecution {
  id: string;
  scheduleType: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  itemsProcessed: number;
  itemsFlagged: number;
  errorsCount: number;
  executionTimeMs?: number;
}

interface ExecutionStats {
  byType: Record<string, {
    total: number;
    successful: number;
    failed: number;
    avgDurationMs: number;
  }>;
  totalExecutions: number;
  successRate: number;
}

interface AuditEntry {
  id: string;
  scheduleType: string;
  action: string;
  oldCron?: string;
  newCron?: string;
  oldEnabled?: boolean;
  newEnabled?: boolean;
  reason?: string;
  createdAt: string;
}

interface SchedulePreset {
  cron: string;
  label: string;
  description: string;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  schedules: Array<{ type: string; enabled: boolean; cronExpression: string }>;
  isDefault: boolean;
}

interface NotificationConfig {
  enabled: boolean;
  snsTopicArn?: string;
  slackWebhookUrl?: string;
  emailRecipients?: string[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
}

interface CronParseResult {
  valid: boolean;
  humanReadable: string;
  nextExecutions: string[];
  error?: string;
}

const SCHEDULE_INFO: Record<string, { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  color: string;
}> = {
  drift_detection: {
    icon: <Activity className="w-5 h-5" />,
    title: 'Drift Detection',
    description: 'Monitors model output distribution changes over time',
    color: 'blue',
  },
  anomaly_detection: {
    icon: <AlertTriangle className="w-5 h-5" />,
    title: 'Anomaly Detection',
    description: 'Behavioral anomaly scans for suspicious patterns',
    color: 'yellow',
  },
  classification_review: {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Classification Review',
    description: 'Aggregates and reviews classification statistics',
    color: 'purple',
  },
  weekly_security_scan: {
    icon: <Shield className="w-5 h-5" />,
    title: 'Weekly Security Scan',
    description: 'Comprehensive security audit of all systems',
    color: 'red',
  },
  weekly_benchmark: {
    icon: <Zap className="w-5 h-5" />,
    title: 'Weekly Benchmark',
    description: 'TruthfulQA and factual accuracy testing',
    color: 'green',
  },
};

export default function SecuritySchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [presets, setPresets] = useState<Record<string, SchedulePreset>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('schedules');
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ cron: string; description: string; reason: string }>({
    cron: '',
    description: '',
    reason: '',
  });
  const [_cronPreview, _setCronPreview] = useState<CronParseResult | null>(null);
  void _cronPreview; void _setCronPreview; // Reserved for cron preview display
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [notifications, setNotifications] = useState<NotificationConfig | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  useEffect(() => {
    fetchDashboard();
    fetchPresets();
    fetchTemplates();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/security/schedules/dashboard');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.config.schedules);
        setStats(data.stats);
        setExecutions(data.recentExecutions);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/admin/security/schedules/presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets);
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await fetch('/api/admin/security/schedules/audit?limit=50');
      if (res.ok) {
        const data = await res.json();
        setAudit(data.audit);
      }
    } catch (error) {
      console.error('Failed to fetch audit:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/security/schedules/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/security/schedules/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/admin/security/schedules/webhooks');
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    }
  };

  const toggleSchedule = async (type: string, enabled: boolean) => {
    setSaving(type);
    try {
      const endpoint = enabled ? 'enable' : 'disable';
      const res = await fetch(`/api/admin/security/schedules/${type}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `${enabled ? 'Enabled' : 'Disabled'} via admin UI` }),
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    } finally {
      setSaving(null);
    }
  };

  const updateSchedule = async (type: string) => {
    setSaving(type);
    try {
      const res = await fetch(`/api/admin/security/schedules/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cronExpression: editForm.cron,
          description: editForm.description,
          reason: editForm.reason || 'Updated via admin UI',
        }),
      });
      if (res.ok) {
        await fetchDashboard();
        setEditingSchedule(null);
      }
    } catch (error) {
      console.error('Failed to update schedule:', error);
    } finally {
      setSaving(null);
    }
  };

  const runNow = async (type: string, dryRun: boolean = false) => {
    setSaving(type);
    try {
      const res = await fetch(`/api/admin/security/schedules/${type}/run-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to trigger schedule:', error);
    } finally {
      setSaving(null);
    }
  };

  const bulkEnable = async () => {
    setSaving('bulk');
    try {
      const res = await fetch('/api/admin/security/schedules/bulk/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Bulk enabled via admin UI' }),
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to bulk enable:', error);
    } finally {
      setSaving(null);
    }
  };

  const bulkDisable = async () => {
    setSaving('bulk');
    try {
      const res = await fetch('/api/admin/security/schedules/bulk/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Bulk disabled via admin UI' }),
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to bulk disable:', error);
    } finally {
      setSaving(null);
    }
  };

  const applyTemplate = async (templateId: string) => {
    setSaving('template');
    try {
      const res = await fetch(`/api/admin/security/schedules/templates/${templateId}/apply`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setSaving(null);
    }
  };

  const addWebhook = async () => {
    if (!newWebhookUrl) return;
    try {
      const res = await fetch('/api/admin/security/schedules/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newWebhookUrl, events: ['execution.completed', 'execution.failed'] }),
      });
      if (res.ok) {
        setNewWebhookUrl('');
        await fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to add webhook:', error);
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/security/schedules/webhooks/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    }
  };

  const startEditing = (schedule: ScheduleConfig) => {
    setEditingSchedule(schedule.type);
    setEditForm({
      cron: schedule.cronExpression,
      description: schedule.description,
      reason: '',
    });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Schedules</h1>
          <p className="text-gray-500">Configure automated security monitoring schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={bulkEnable} variant="outline" size="sm" disabled={saving === 'bulk'}>
            <Power className="w-4 h-4 mr-2" />
            Enable All
          </Button>
          <Button onClick={bulkDisable} variant="outline" size="sm" disabled={saving === 'bulk'}>
            <PowerOff className="w-4 h-4 mr-2" />
            Disable All
          </Button>
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Executions (30d)</p>
                  <p className="text-2xl font-bold">{stats.totalExecutions}</p>
                </div>
                <Timer className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold">{(stats.successRate * 100).toFixed(1)}%</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Schedules</p>
                  <p className="text-2xl font-bold">{schedules.filter(s => s.enabled).length} / {schedules.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Running Now</p>
                  <p className="text-2xl font-bold">{executions.filter(e => e.status === 'running').length}</p>
                </div>
                <Activity className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedules">
            <Clock className="w-4 h-4 mr-2" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="executions">
            <History className="w-4 h-4 mr-2" />
            Executions
          </TabsTrigger>
          <TabsTrigger value="templates" onClick={fetchTemplates}>
            <Layers className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="notifications" onClick={fetchNotifications}>
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="webhooks" onClick={fetchWebhooks}>
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="audit" onClick={fetchAudit}>
            <FileText className="w-4 h-4 mr-2" />
            Audit
          </TabsTrigger>
        </TabsList>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          {schedules.map((schedule) => {
            const info = SCHEDULE_INFO[schedule.type];
            const isEditing = editingSchedule === schedule.type;
            const typeStats = stats?.byType[schedule.type];

            return (
              <Card key={schedule.type} className={`${!schedule.enabled ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${info.color}-100 dark:bg-${info.color}-900/30`}>
                        {info.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{info.title}</CardTitle>
                        <CardDescription>{info.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={schedule.enabled}
                        onCheckedChange={(checked) => toggleSchedule(schedule.type, checked)}
                        disabled={saving === schedule.type}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runNow(schedule.type)}
                        disabled={saving === schedule.type || !schedule.enabled}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Run Now
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Cron Expression</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={editForm.cron}
                              onChange={(e) => setEditForm({ ...editForm, cron: e.target.value })}
                              placeholder="0 0 * * ? *"
                              className="font-mono"
                            />
                            <Select onValueChange={(v) => setEditForm({ ...editForm, cron: presets[v]?.cron || v })}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Presets" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(presets).map(([key, preset]) => (
                                  <SelectItem key={key} value={key}>
                                    {preset.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Schedule description"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Reason for Change</Label>
                        <Textarea
                          value={editForm.reason}
                          onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                          placeholder="Optional: Explain why you're changing this schedule"
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setEditingSchedule(null)}>
                          Cancel
                        </Button>
                        <Button onClick={() => updateSchedule(schedule.type)} disabled={saving === schedule.type}>
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Schedule</p>
                        <p className="font-mono text-sm">{schedule.cronExpression}</p>
                        <p className="text-xs text-gray-400">{schedule.description}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Last 30 Days</p>
                        {typeStats ? (
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">{typeStats.successful} ok</span>
                            <span className="text-gray-400">/</span>
                            <span className="text-red-600">{typeStats.failed} failed</span>
                          </div>
                        ) : (
                          <p className="text-gray-400">No data</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Duration</p>
                        <p>{formatDuration(typeStats?.avgDurationMs)}</p>
                      </div>
                      <div className="flex items-center justify-end">
                        <Button variant="ghost" size="sm" onClick={() => startEditing(schedule)}>
                          <Settings className="w-4 h-4 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Alert>
            <Clock className="w-4 h-4" />
            <AlertDescription>
              <strong>Cron Format:</strong> Minutes Hours Day-of-month Month Day-of-week Year (AWS EventBridge format).
              Example: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">0 0 * * ? *</code> = daily at midnight UTC.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flagged</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {executions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No executions recorded yet
                      </td>
                    </tr>
                  ) : (
                    executions.map((execution) => {
                      const info = SCHEDULE_INFO[execution.scheduleType];
                      return (
                        <tr key={execution.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {info?.icon}
                              <span>{info?.title || execution.scheduleType}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{formatDate(execution.startedAt)}</td>
                          <td className="px-4 py-3 text-sm">{formatDuration(execution.executionTimeMs)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={
                              execution.status === 'completed' ? 'default' :
                              execution.status === 'failed' ? 'destructive' : 'secondary'
                            }>
                              {execution.status === 'running' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                              {execution.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {execution.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                              {execution.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">{execution.itemsProcessed}</td>
                          <td className="px-4 py-3 text-sm">
                            {execution.itemsFlagged > 0 ? (
                              <span className="text-yellow-600 font-medium">{execution.itemsFlagged}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {execution.errorsCount > 0 ? (
                              <span className="text-red-600 font-medium">{execution.errorsCount}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Templates</CardTitle>
              <CardDescription>Apply pre-configured schedule configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No templates available</p>
              ) : (
                templates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{template.name}</h3>
                        {template.isDefault && <Badge variant="secondary">Default</Badge>}
                      </div>
                      <p className="text-sm text-gray-500">{template.description}</p>
                      <div className="flex gap-2 mt-2">
                        {template.schedules.map((s) => (
                          <Badge key={s.type} variant={s.enabled ? 'default' : 'outline'} className="text-xs">
                            {SCHEDULE_INFO[s.type]?.title || s.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button onClick={() => applyTemplate(template.id)} disabled={saving === 'template'}>
                      <Copy className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Execution Notifications</CardTitle>
              <CardDescription>Get notified when schedules complete or fail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Notifications</Label>
                      <p className="text-sm text-gray-500">Receive alerts for schedule executions</p>
                    </div>
                    <Switch checked={notifications.enabled} disabled />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={notifications.notifyOnSuccess} disabled />
                      <Label>Notify on Success</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={notifications.notifyOnFailure} disabled />
                      <Label>Notify on Failure</Label>
                    </div>
                  </div>
                  {notifications.slackWebhookUrl && (
                    <div>
                      <Label>Slack Webhook</Label>
                      <p className="text-sm text-gray-500 font-mono">{notifications.slackWebhookUrl.substring(0, 50)}...</p>
                    </div>
                  )}
                  {notifications.snsTopicArn && (
                    <div>
                      <Label>SNS Topic</Label>
                      <p className="text-sm text-gray-500 font-mono">{notifications.snsTopicArn}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Loading notification settings...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Send execution results to external services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="https://your-service.com/webhook"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addWebhook} disabled={!newWebhookUrl}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Webhook
                </Button>
              </div>
              {webhooks.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No webhooks configured</p>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-mono text-sm">{webhook.url}</p>
                        <div className="flex gap-1 mt-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                          {webhook.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => deleteWebhook(webhook.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {audit.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No audit entries yet
                      </td>
                    </tr>
                  ) : (
                    audit.map((entry) => {
                      const info = SCHEDULE_INFO[entry.scheduleType];
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="px-4 py-3 text-sm">{formatDate(entry.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {info?.icon}
                              <span>{info?.title || entry.scheduleType}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={
                              entry.action === 'enabled' ? 'default' :
                              entry.action === 'disabled' ? 'secondary' : 'outline'
                            }>
                              {entry.action}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {entry.oldCron !== entry.newCron && entry.newCron && (
                              <div className="font-mono text-xs">
                                <span className="text-red-500 line-through">{entry.oldCron}</span>
                                {' → '}
                                <span className="text-green-500">{entry.newCron}</span>
                              </div>
                            )}
                            {entry.oldEnabled !== entry.newEnabled && (
                              <div className="text-xs">
                                {entry.newEnabled ? 'Enabled' : 'Disabled'}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                            {entry.reason || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
