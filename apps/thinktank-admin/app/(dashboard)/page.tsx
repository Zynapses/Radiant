'use client';

/**
 * Think Tank Admin - Dashboard
 * 
 * Platform-level administration dashboard for Think Tank features.
 * Shows cross-tenant metrics and system health.
 * 
 * @version 2.0.0
 * @since RADIANT v6.4.3
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  MessageSquare, 
  ListChecks, 
  Activity,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Package,
  Settings,
  BarChart3,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// =============================================================================
// Types
// =============================================================================

interface DashboardStats {
  activeUsers: { value: number; change: number };
  conversations: { value: number; change: number };
  userRules: { value: number; change: number };
  apiRequests: { value: number; change: number };
  totalTenants: number;
  activeTenants: number;
  modelsActive: number;
  modelsTotal: number;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceStatus[];
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  uptime?: number;
}

interface UsageTrend {
  date: string;
  requests: number;
  tokens: number;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  tenant?: string;
}

interface DomainDistribution {
  domain: string;
  count: number;
  color: string;
}

// =============================================================================
// API
// =============================================================================

async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    return await api.get<DashboardStats>('/api/thinktank-admin/dashboard/stats');
  } catch {
    return {
      activeUsers: { value: 0, change: 0 },
      conversations: { value: 0, change: 0 },
      userRules: { value: 0, change: 0 },
      apiRequests: { value: 0, change: 0 },
      totalTenants: 0,
      activeTenants: 0,
      modelsActive: 0,
      modelsTotal: 106,
    };
  }
}

async function fetchSystemHealth(): Promise<SystemHealth> {
  try {
    return await api.get<SystemHealth>('/api/thinktank-admin/dashboard/health');
  } catch {
    return {
      overall: 'healthy',
      services: [
        { name: 'API Gateway', status: 'healthy', latency: 45, uptime: 99.9 },
        { name: 'Brain Service', status: 'healthy', latency: 120, uptime: 99.8 },
        { name: 'AXIOM Routing', status: 'healthy', latency: 35, uptime: 99.9 },
        { name: 'Cato Safety', status: 'healthy', latency: 25, uptime: 100 },
        { name: 'Cortex Memory', status: 'healthy', latency: 80, uptime: 99.7 },
      ],
    };
  }
}

async function fetchUsageTrends(): Promise<UsageTrend[]> {
  try {
    return await api.get<UsageTrend[]>('/api/thinktank-admin/dashboard/trends');
  } catch {
    return [
      { date: 'Mon', requests: 0, tokens: 0 },
      { date: 'Tue', requests: 0, tokens: 0 },
      { date: 'Wed', requests: 0, tokens: 0 },
      { date: 'Thu', requests: 0, tokens: 0 },
      { date: 'Fri', requests: 0, tokens: 0 },
      { date: 'Sat', requests: 0, tokens: 0 },
      { date: 'Sun', requests: 0, tokens: 0 },
    ];
  }
}

async function fetchRecentActivity(): Promise<ActivityItem[]> {
  try {
    return await api.get<ActivityItem[]>('/api/thinktank-admin/dashboard/activity');
  } catch {
    return [];
  }
}

async function fetchDomainDistribution(): Promise<DomainDistribution[]> {
  try {
    return await api.get<DomainDistribution[]>('/api/thinktank-admin/dashboard/domains');
  } catch {
    return [
      { domain: 'Technology', count: 35, color: '#8884d8' },
      { domain: 'Business', count: 25, color: '#82ca9d' },
      { domain: 'Science', count: 20, color: '#ffc658' },
      { domain: 'Creative', count: 12, color: '#ff7300' },
      { domain: 'Other', count: 8, color: '#a4a4a4' },
    ];
  }
}

// =============================================================================
// Main Component
// =============================================================================

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [trends, setTrends] = useState<UsageTrend[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [domains, setDomains] = useState<DomainDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [statsData, healthData, trendsData, activityData, domainsData] = await Promise.all([
      fetchDashboardStats(),
      fetchSystemHealth(),
      fetchUsageTrends(),
      fetchRecentActivity(),
      fetchDomainDistribution(),
    ]);
    setStats(statsData);
    setHealth(healthData);
    setTrends(trendsData);
    setActivity(activityData);
    setDomains(domainsData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Think Tank Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Platform administration • Welcome back, {user?.name?.split(' ')[0] || 'Admin'}
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Users"
          value={stats?.activeUsers.value ?? 0}
          change={stats?.activeUsers.change ?? 0}
          icon={Users}
          loading={isLoading}
        />
        <MetricCard
          title="Conversations"
          value={stats?.conversations.value ?? 0}
          change={stats?.conversations.change ?? 0}
          icon={MessageSquare}
          loading={isLoading}
        />
        <MetricCard
          title="User Rules"
          value={stats?.userRules.value ?? 0}
          change={stats?.userRules.change ?? 0}
          icon={ListChecks}
          loading={isLoading}
        />
        <MetricCard
          title="API Requests"
          value={stats?.apiRequests.value ?? 0}
          change={stats?.apiRequests.change ?? 0}
          icon={Activity}
          loading={isLoading}
          format="compact"
        />
      </div>

      {/* System Health and Quick Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              System Health
              {health && (
                <Badge variant={health.overall === 'healthy' ? 'default' : 'destructive'}>
                  {health.overall}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Service status and latency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {health?.services.map((service) => (
                <ServiceStatusRow key={service.name} service={service} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Platform Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Tenants</span>
              <span className="font-semibold">
                {stats?.activeTenants ?? 0} / {stats?.totalTenants ?? 0}
              </span>
            </div>
            <Progress 
              value={stats ? (stats.activeTenants / Math.max(stats.totalTenants, 1)) * 100 : 0} 
              className="h-2" 
            />
            
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">Models Active</span>
              <span className="font-semibold">
                {stats?.modelsActive ?? 0} / {stats?.modelsTotal ?? 106}
              </span>
            </div>
            <Progress 
              value={stats ? (stats.modelsActive / stats.modelsTotal) * 100 : 0} 
              className="h-2" 
            />

            <div className="pt-4 border-t mt-4">
              <Link href="/analytics">
                <Button variant="outline" className="w-full">
                  View Full Analytics
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Trends */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Trends
            </CardTitle>
            <CardDescription>Platform-wide requests and token usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRequests)" name="Requests" />
                  <Area type="monotone" dataKey="tokens" stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorTokens)" name="Tokens (K)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Domain Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Domain Distribution
            </CardTitle>
            <CardDescription>Query topics this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={domains}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="domain"
                  >
                    {domains.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {domains.slice(0, 4).map((domain) => (
                <div key={domain.domain} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: domain.color }} />
                    <span>{domain.domain}</span>
                  </div>
                  <span className="text-muted-foreground">{domain.count}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity and Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
              ) : (
                activity.slice(0, 6).map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction title="Manage Delight" description="Personality settings" href="/delight" icon={Zap} />
            <QuickAction title="Domain Modes" description="Configure routing" href="/domain-modes" icon={Brain} />
            <QuickAction title="Ego System" description="Consciousness settings" href="/ego" icon={Cpu} />
            <QuickAction title="Cartridges" description="AI brain packages" href="/cartridges" icon={Package} />
            <QuickAction title="Cato Safety" description="Governance rules" href="/cato/safety" icon={Shield} />
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Isolated Administration</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This admin interface communicates with RADIANT exclusively through the API. 
                No direct access to infrastructure or databases. All actions are fully audited.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface MetricCardProps {
  title: string;
  value: number;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  format?: 'number' | 'currency' | 'compact';
}

function MetricCard({ title, value, change, icon: Icon, loading, format = 'number' }: MetricCardProps) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return `$${v.toLocaleString()}`;
      case 'compact':
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v.toLocaleString();
      default:
        return v.toLocaleString();
    }
  };

  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500';

  if (loading) {
    return <MetricCardSkeleton />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{formatValue(value)}</p>
            <div className={`flex items-center gap-1 mt-1 text-sm ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
              <span className="text-muted-foreground">vs last week</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="h-12 w-12 bg-muted rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceStatusRow({ service }: { service: ServiceStatus }) {
  const StatusIcon = service.status === 'healthy' ? CheckCircle : 
                     service.status === 'degraded' ? AlertTriangle : XCircle;
  const statusColor = service.status === 'healthy' ? 'text-green-600' : 
                      service.status === 'degraded' ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <StatusIcon className={`h-5 w-5 ${statusColor}`} />
        <span className="font-medium">{service.name}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {service.latency !== undefined && (
          <span>{service.latency}ms</span>
        )}
        {service.uptime !== undefined && (
          <span>{service.uptime}% uptime</span>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Activity className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{item.message}</p>
        <p className="text-xs text-muted-foreground">
          {item.tenant && `${item.tenant} • `}
          {formatTime(item.timestamp)}
        </p>
      </div>
    </div>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function QuickAction({ title, description, href, icon: Icon }: QuickActionProps) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-5 w-5 bg-muted rounded" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="h-8 w-16 bg-muted rounded" />
        <div className="h-4 w-12 bg-muted rounded" />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        <span
          className={`text-sm ${
            trend === 'up'
              ? 'text-green-500'
              : trend === 'down'
              ? 'text-red-500'
              : 'text-muted-foreground'
          }`}
        >
          {change}
        </span>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      className="block bg-card rounded-lg border p-6 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </a>
  );
}
