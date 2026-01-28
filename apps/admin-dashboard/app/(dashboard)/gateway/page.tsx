'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Network,
  Pause,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const API_BASE = '/api/admin/gateway';

// ============================================================================
// Types
// ============================================================================

interface DashboardData {
  overview: {
    totalConnections: number;
    peakConnections: number;
    messagesPerMinute: number;
    avgLatencyMs: number;
    errorRate: number;
    activeInstances: number;
  };
  instances: Array<{
    id: string;
    instance_id: string;
    hostname: string;
    region: string;
    status: string;
    version: string;
    started_at: string;
    last_heartbeat_at: string;
  }>;
  protocols: Record<string, number>;
  alerts: Array<{
    id: string;
    alert_type: string;
    severity: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  trend: Array<{
    hour: string;
    connections: number;
    messages: number;
    errors: number;
  }>;
}

interface GatewayConfig {
  max_connections_per_tenant: number;
  max_connections_per_user: number;
  rate_limit_messages_per_second: number;
  timeout_idle_ms: number;
  protocols_enabled: string[];
  require_mtls_for_a2a: boolean;
  maintenance_mode: boolean;
  maintenance_message?: string;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function fetchConfig(): Promise<GatewayConfig> {
  const res = await fetch(`${API_BASE}/configuration`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function updateConfig(config: Partial<GatewayConfig>): Promise<void> {
  const res = await fetch(`${API_BASE}/configuration`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

async function acknowledgeAlert(alertId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

async function drainInstance(instanceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/instances/${instanceId}/drain`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// ============================================================================
// Components
// ============================================================================

const PROTOCOL_COLORS: Record<string, string> = {
  mcp: '#6366f1',
  a2a: '#8b5cf6',
  openai: '#10b981',
  anthropic: '#f59e0b',
  google: '#3b82f6',
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-green-600 bg-green-100',
    warning: 'text-amber-600 bg-amber-100',
    destructive: 'text-red-600 bg-red-100',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <p className={`text-xs mt-2 ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsList({
  alerts,
  onAcknowledge,
}: {
  alerts: DashboardData['alerts'];
  onAcknowledge: (id: string) => void;
}) {
  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
        <p>No active alerts</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3">
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-4 rounded-lg border ${severityColors[alert.severity]}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {alert.status === 'open' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAcknowledge(alert.id)}
                >
                  Acknowledge
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

function InstancesTable({
  instances,
  onDrain,
}: {
  instances: DashboardData['instances'];
  onDrain: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    draining: 'bg-amber-100 text-amber-800',
    stopped: 'bg-gray-100 text-gray-800',
    unhealthy: 'bg-red-100 text-red-800',
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Instance</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Uptime</TableHead>
          <TableHead>Last Heartbeat</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((instance) => (
          <TableRow key={instance.id}>
            <TableCell className="font-mono text-sm">{instance.hostname}</TableCell>
            <TableCell>{instance.region}</TableCell>
            <TableCell>
              <Badge className={statusColors[instance.status]}>{instance.status}</Badge>
            </TableCell>
            <TableCell>{instance.version}</TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(instance.started_at))}
            </TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(instance.last_heartbeat_at), { addSuffix: true })}
            </TableCell>
            <TableCell className="text-right">
              {instance.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDrain(instance.instance_id)}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Drain
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ConfigurationPanel({
  config,
  onSave,
  isLoading,
}: {
  config: GatewayConfig;
  onSave: (config: Partial<GatewayConfig>) => void;
  isLoading: boolean;
}) {
  const [localConfig, setLocalConfig] = useState(config);
  const [maintenanceMessage, setMaintenanceMessage] = useState(config.maintenance_message || '');

  const handleSave = () => {
    onSave(localConfig);
  };

  return (
    <div className="space-y-6">
      {/* Connection Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connection Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Connections per Tenant</Label>
              <Input
                type="number"
                value={localConfig.max_connections_per_tenant}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, max_connections_per_tenant: parseInt(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Max Connections per User</Label>
              <Input
                type="number"
                value={localConfig.max_connections_per_user}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, max_connections_per_user: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Rate Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Messages per Second</Label>
              <Input
                type="number"
                value={localConfig.rate_limit_messages_per_second}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    rate_limit_messages_per_second: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Idle Timeout (ms)</Label>
              <Input
                type="number"
                value={localConfig.timeout_idle_ms}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, timeout_idle_ms: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require mTLS for A2A</Label>
              <p className="text-sm text-muted-foreground">
                Enforce mutual TLS for agent-to-agent connections
              </p>
            </div>
            <Switch
              checked={localConfig.require_mtls_for_a2a}
              onCheckedChange={(checked) =>
                setLocalConfig({ ...localConfig, require_mtls_for_a2a: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className={localConfig.maintenance_mode ? 'border-amber-500' : ''}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reject new connections with maintenance message
              </p>
            </div>
            <Switch
              checked={localConfig.maintenance_mode}
              onCheckedChange={(checked) =>
                setLocalConfig({ ...localConfig, maintenance_mode: checked })
              }
            />
          </div>
          {localConfig.maintenance_mode && (
            <div>
              <Label>Maintenance Message</Label>
              <Textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="The system is undergoing scheduled maintenance..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function GatewayPage() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('overview');

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['gateway-dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['gateway-config'],
    queryFn: fetchConfig,
  });

  const updateConfigMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-config'] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-dashboard'] });
    },
  });

  const drainMutation = useMutation({
    mutationFn: drainInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-dashboard'] });
    },
  });

  const protocolData = dashboard
    ? Object.entries(dashboard.protocols).map(([name, value]) => ({
        name: name.toUpperCase(),
        value,
        color: PROTOCOL_COLORS[name] || '#94a3b8',
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Network className="h-8 w-8 text-primary" />
            Gateway Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-Protocol AI Gateway monitoring and configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['gateway-dashboard'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="instances" className="gap-2">
            <Server className="h-4 w-4" />
            Instances
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
            {dashboard && dashboard.alerts.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {dashboard.alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Active Connections"
                  value={dashboard.overview.totalConnections.toLocaleString()}
                  subtitle={`Peak: ${dashboard.overview.peakConnections.toLocaleString()}`}
                  icon={Wifi}
                  color="primary"
                />
                <StatCard
                  title="Messages/min"
                  value={dashboard.overview.messagesPerMinute.toLocaleString()}
                  icon={MessageSquare}
                  color="success"
                />
                <StatCard
                  title="Avg Latency"
                  value={`${dashboard.overview.avgLatencyMs}ms`}
                  icon={Clock}
                  color={dashboard.overview.avgLatencyMs > 100 ? 'warning' : 'success'}
                />
                <StatCard
                  title="Error Rate"
                  value={`${dashboard.overview.errorRate}%`}
                  subtitle={`${dashboard.overview.activeInstances} instances`}
                  icon={AlertTriangle}
                  color={dashboard.overview.errorRate > 1 ? 'destructive' : 'success'}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connection Trend */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>24-Hour Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={dashboard.trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="hour"
                          tickFormatter={(v) => new Date(v).getHours() + ':00'}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(v) => new Date(v).toLocaleString()}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="connections"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.3}
                          name="Connections"
                        />
                        <Area
                          type="monotone"
                          dataKey="messages"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.3}
                          name="Messages"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Protocol Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Protocol Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={protocolData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {protocolData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Alerts Preview */}
              {dashboard.alerts.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-5 w-5" />
                      Active Alerts ({dashboard.alerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AlertsList
                      alerts={dashboard.alerts.slice(0, 3)}
                      onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                    />
                    {dashboard.alerts.length > 3 && (
                      <Button
                        variant="link"
                        className="mt-2"
                        onClick={() => setSelectedTab('alerts')}
                      >
                        View all {dashboard.alerts.length} alerts →
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Instances Tab */}
        <TabsContent value="instances">
          <Card>
            <CardHeader>
              <CardTitle>Gateway Instances</CardTitle>
              <CardDescription>
                Active gateway instances and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.instances && (
                <InstancesTable
                  instances={dashboard.instances}
                  onDrain={(id) => drainMutation.mutate(id)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration">
          {configLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : config ? (
            <ConfigurationPanel
              config={config}
              onSave={(c) => updateConfigMutation.mutate(c)}
              isLoading={updateConfigMutation.isPending}
            />
          ) : null}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Gateway Alerts</CardTitle>
              <CardDescription>
                System alerts and incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.alerts && (
                <AlertsList
                  alerts={dashboard.alerts}
                  onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
