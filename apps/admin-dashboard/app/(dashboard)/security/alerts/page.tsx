'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, AlertTriangle, CheckCircle, Send, Settings } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AlertConfig {
  enabled: boolean;
  channels: {
    slack?: { enabled: boolean; webhookUrl: string; channel?: string };
    email?: { enabled: boolean; recipients: string[] };
    pagerduty?: { enabled: boolean; routingKey: string };
    webhook?: { enabled: boolean; url: string };
  };
  severityFilters: { info: boolean; warning: boolean; critical: boolean };
  cooldownMinutes: number;
}

interface AlertHistory {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  channels: string[];
  createdAt: string;
}

export default function AlertsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<AlertConfig>({
    enabled: false,
    channels: {},
    severityFilters: { info: false, warning: true, critical: true },
    cooldownMinutes: 60,
  });
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('config');
  
  // Form states
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [pagerdutyKey, setPagerdutyKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/security/alerts/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSlackWebhook(data.channels?.slack?.webhookUrl || '');
        setSlackChannel(data.channels?.slack?.channel || '');
        setEmailRecipients(data.channels?.email?.recipients?.join(', ') || '');
        setPagerdutyKey(data.channels?.pagerduty?.routingKey || '');
        setWebhookUrl(data.channels?.webhook?.url || '');
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/admin/security/alerts?limit=100');
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const updatedConfig: AlertConfig = {
        ...config,
        channels: {
          slack: {
            enabled: config.channels.slack?.enabled || false,
            webhookUrl: slackWebhook,
            channel: slackChannel || undefined,
          },
          email: {
            enabled: config.channels.email?.enabled || false,
            recipients: emailRecipients.split(',').map(e => e.trim()).filter(Boolean),
          },
          pagerduty: {
            enabled: config.channels.pagerduty?.enabled || false,
            routingKey: pagerdutyKey,
          },
          webhook: {
            enabled: config.channels.webhook?.enabled || false,
            url: webhookUrl,
          },
        },
      };

      await fetch('/api/admin/security/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });

      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const testChannel = async (channel: string) => {
    setTesting(channel);
    try {
      const res = await fetch('/api/admin/security/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const result = await res.json();
      if (result.sent) {
        toast({
          title: 'Test Alert Sent',
          description: `Test alert sent successfully to ${channel}.`,
        });
      } else {
        toast({
          title: 'Test Failed',
          description: result.errors?.join(', ') || `Failed to send test to ${channel}.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to test channel:', error);
      toast({
        title: 'Test Failed',
        description: 'An error occurred while sending test alert.',
        variant: 'destructive',
      });
    } finally {
      setTesting(null);
    }
  };

  const toggleChannel = (channel: keyof AlertConfig['channels']) => {
    setConfig(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: {
          ...prev.channels[channel],
          enabled: !prev.channels[channel]?.enabled,
        },
      },
    }));
  };

  const toggleSeverity = (severity: keyof AlertConfig['severityFilters']) => {
    setConfig(prev => ({
      ...prev,
      severityFilters: {
        ...prev.severityFilters,
        [severity]: !prev.severityFilters[severity],
      },
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Alerts</h1>
          <p className="text-muted-foreground mt-1">
            Configure alert channels and view alert history
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Alerts Enabled</Label>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))}
            />
          </div>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="history">
            <Bell className="h-4 w-4 mr-2" />
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Slack */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <CardTitle>Slack</CardTitle>
                  </div>
                  <Switch
                    checked={config.channels.slack?.enabled || false}
                    onCheckedChange={() => toggleChannel('slack')}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    type="password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Channel (optional)</Label>
                  <Input
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#security-alerts"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testChannel('slack')}
                  disabled={!slackWebhook || testing === 'slack'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testing === 'slack' ? 'Sending...' : 'Test'}
                </Button>
              </CardContent>
            </Card>

            {/* Email */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    <CardTitle>Email (AWS SES)</CardTitle>
                  </div>
                  <Switch
                    checked={config.channels.email?.enabled || false}
                    onCheckedChange={() => toggleChannel('email')}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipients (comma-separated)</Label>
                  <Input
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="admin@example.com, security@example.com"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testChannel('email')}
                  disabled={!emailRecipients || testing === 'email'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testing === 'email' ? 'Sending...' : 'Test'}
                </Button>
              </CardContent>
            </Card>

            {/* PagerDuty */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    <CardTitle>PagerDuty</CardTitle>
                  </div>
                  <Switch
                    checked={config.channels.pagerduty?.enabled || false}
                    onCheckedChange={() => toggleChannel('pagerduty')}
                  />
                </div>
                <CardDescription>Critical alerts only</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Routing Key</Label>
                  <Input
                    value={pagerdutyKey}
                    onChange={(e) => setPagerdutyKey(e.target.value)}
                    placeholder="Integration key..."
                    type="password"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testChannel('pagerduty')}
                  disabled={!pagerdutyKey || testing === 'pagerduty'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testing === 'pagerduty' ? 'Sending...' : 'Test'}
                </Button>
              </CardContent>
            </Card>

            {/* Webhook */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    <CardTitle>Custom Webhook</CardTitle>
                  </div>
                  <Switch
                    checked={config.channels.webhook?.enabled || false}
                    onCheckedChange={() => toggleChannel('webhook')}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-service.com/webhook"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testChannel('webhook')}
                  disabled={!webhookUrl || testing === 'webhook'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {testing === 'webhook' ? 'Sending...' : 'Test'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Severity Filters & Cooldown */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <Label>Severity Filters</Label>
                  <div className="space-y-2">
                    {(['info', 'warning', 'critical'] as const).map(severity => (
                      <div key={severity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={severityColor(severity)}>{severity}</Badge>
                        </div>
                        <Switch
                          checked={config.severityFilters[severity]}
                          onCheckedChange={() => toggleSeverity(severity)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Cooldown Period (minutes)</Label>
                  <Input
                    type="number"
                    value={config.cooldownMinutes}
                    onChange={(e) => setConfig(prev => ({ ...prev, cooldownMinutes: parseInt(e.target.value) || 60 }))}
                    min={1}
                    max={1440}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum time between alerts of the same type
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Recent security alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {history.map(alert => (
                    <div key={alert.id} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={severityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">{alert.type}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{alert.message}</div>
                      {alert.channels.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-muted-foreground">
                            Sent to: {alert.channels.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      No alerts sent yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
