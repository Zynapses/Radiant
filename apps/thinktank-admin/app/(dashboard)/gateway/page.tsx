'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  MessageSquare,
  Network,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const API_BASE = '/api/admin/gateway';

interface GatewayDashboard {
  overview: {
    totalConnections: number;
    peakConnections: number;
    messagesPerMinute: number;
    avgLatencyMs: number;
    errorRate: number;
    activeInstances: number;
  };
  protocols: Record<string, number>;
  alerts: Array<{
    id: string;
    alert_type: string;
    severity: string;
    title: string;
    created_at: string;
  }>;
  trend: Array<{
    hour: string;
    connections: number;
    messages: number;
  }>;
}

const PROTOCOL_COLORS: Record<string, string> = {
  mcp: '#6366f1',
  a2a: '#8b5cf6',
  openai: '#10b981',
  anthropic: '#f59e0b',
  google: '#3b82f6',
};

async function fetchDashboard(): Promise<GatewayDashboard> {
  const res = await fetch(`${API_BASE}/dashboard`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  status = 'normal',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  status?: 'normal' | 'warning' | 'error' | 'success';
}) {
  const statusColors = {
    normal: 'text-primary bg-primary/10',
    success: 'text-green-600 bg-green-100',
    warning: 'text-amber-600 bg-amber-100',
    error: 'text-red-600 bg-red-100',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full ${statusColors[status]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GatewayStatusPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['thinktank-gateway-status'],
    queryFn: fetchDashboard,
    refetchInterval: 60000, // Refresh every minute
  });

  const getOverallStatus = () => {
    if (!data) return 'unknown';
    if (data.overview.activeInstances === 0) return 'down';
    if (data.overview.errorRate > 5 || data.alerts.length > 0) return 'degraded';
    return 'healthy';
  };

  const status = getOverallStatus();
  const statusConfig = {
    healthy: { label: 'All Systems Operational', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    degraded: { label: 'Degraded Performance', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    down: { label: 'Service Unavailable', icon: WifiOff, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    unknown: { label: 'Loading...', icon: RefreshCw, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
  };

  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;

  const protocolData = data
    ? Object.entries(data.protocols).map(([name, value]) => ({
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
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Network className="h-7 w-7 text-primary" />
            Gateway Status
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time status of the AI Gateway infrastructure
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Info Banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Read-Only View</AlertTitle>
        <AlertDescription>
          This page shows the current status of the Multi-Protocol Gateway. For full management
          controls, access the RADIANT Admin Dashboard.
        </AlertDescription>
      </Alert>

      {/* Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-lg border ${currentStatus.bg}`}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-6 w-6 ${currentStatus.color}`} />
          <div>
            <p className={`font-semibold ${currentStatus.color}`}>{currentStatus.label}</p>
            <p className="text-sm text-muted-foreground">
              {data ? `${data.overview.activeInstances} gateway instance${data.overview.activeInstances !== 1 ? 's' : ''} active` : 'Checking status...'}
            </p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Connections"
              value={data.overview.totalConnections.toLocaleString()}
              subtitle={`Peak: ${data.overview.peakConnections.toLocaleString()}`}
              icon={Wifi}
              status="normal"
            />
            <StatCard
              title="Messages/min"
              value={data.overview.messagesPerMinute.toLocaleString()}
              icon={MessageSquare}
              status="success"
            />
            <StatCard
              title="Avg Latency"
              value={`${data.overview.avgLatencyMs}ms`}
              icon={Clock}
              status={data.overview.avgLatencyMs > 100 ? 'warning' : 'success'}
            />
            <StatCard
              title="Error Rate"
              value={`${data.overview.errorRate}%`}
              icon={AlertTriangle}
              status={data.overview.errorRate > 1 ? 'error' : 'success'}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Connection Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Connection Trend (24h)</CardTitle>
                <CardDescription>Active connections and message throughput</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v) => new Date(v).getHours() + ':00'}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip
                      labelFormatter={(v) => new Date(v).toLocaleString()}
                    />
                    <Line
                      type="monotone"
                      dataKey="connections"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      name="Connections"
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="Messages"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Protocol Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Protocol Mix</CardTitle>
                <CardDescription>Active connections by protocol</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={protocolData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      label={({ name, percent }) =>
                        percent > 0.05 ? `${name}` : ''
                      }
                      labelLine={false}
                    >
                      {protocolData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {protocolData.map((p) => (
                    <Badge key={p.name} variant="outline" style={{ borderColor: p.color }}>
                      <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                      {p.name}: {p.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts */}
          {data.alerts.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="bg-amber-50">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  Active Alerts ({data.alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {data.alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border ${
                        alert.severity === 'critical'
                          ? 'bg-red-50 border-red-200'
                          : alert.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${
                            alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                          }`} />
                          <span className="font-medium">{alert.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supported Protocols Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Supported Protocols
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { name: 'MCP', desc: 'Model Context Protocol', color: PROTOCOL_COLORS.mcp },
                  { name: 'A2A', desc: 'Agent-to-Agent', color: PROTOCOL_COLORS.a2a },
                  { name: 'OpenAI', desc: 'Chat Completions', color: PROTOCOL_COLORS.openai },
                  { name: 'Anthropic', desc: 'Messages API', color: PROTOCOL_COLORS.anthropic },
                  { name: 'Google', desc: 'Generative Language', color: PROTOCOL_COLORS.google },
                ].map((proto) => (
                  <div key={proto.name} className="text-center p-3 rounded-lg bg-muted/50">
                    <div
                      className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: proto.color }}
                    >
                      {proto.name[0]}
                    </div>
                    <p className="font-medium text-sm">{proto.name}</p>
                    <p className="text-xs text-muted-foreground">{proto.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
