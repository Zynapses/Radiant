'use client';

/**
 * Think Tank Tenant Admin - Dashboard
 * 
 * Company/team level dashboard showing tenant-specific metrics.
 * All data is automatically tenant-isolated via the service layer.
 * 
 * @version 1.0.0
 * @since RADIANT v6.4.3
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  MessageSquare,
  CreditCard,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  FileText,
  Settings,
  Shield,
  Clock,
  Zap,
  Brain,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Bell,
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
  BarChart,
  Bar,
} from 'recharts';

// =============================================================================
// Types
// =============================================================================

interface TenantDashboardStats {
  activeUsers: { value: number; change: number };
  conversations: { value: number; change: number };
  apiRequests: { value: number; change: number };
  creditsUsed: { value: number; change: number; total: number };
  activeCartridges: number;
  totalCartridges: number;
  mlsUsage: { value: number; limit: number };
}

interface UsageTrend {
  date: string;
  requests: number;
  tokens: number;
}

interface ActivityItem {
  id: string;
  type: 'user_joined' | 'report_generated' | 'cartridge_activated' | 'settings_changed' | 'alert';
  message: string;
  timestamp: string;
  actor?: string;
}

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'error';
  title: string;
  message: string;
}

// =============================================================================
// API
// =============================================================================

const API_BASE = '/api/v1/tenant';

async function fetchDashboardStats(): Promise<TenantDashboardStats> {
  const response = await fetch(`${API_BASE}/dashboard/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

async function fetchUsageTrends(): Promise<UsageTrend[]> {
  const response = await fetch(`${API_BASE}/dashboard/usage-trends`);
  if (!response.ok) throw new Error('Failed to fetch trends');
  return response.json();
}

async function fetchRecentActivity(): Promise<ActivityItem[]> {
  const response = await fetch(`${API_BASE}/dashboard/activity`);
  if (!response.ok) throw new Error('Failed to fetch activity');
  return response.json();
}

async function fetchAlerts(): Promise<Alert[]> {
  const response = await fetch(`${API_BASE}/dashboard/alerts`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
}

// =============================================================================
// Main Component
// =============================================================================

export default function TenantDashboardPage() {
  const [stats, setStats] = useState<TenantDashboardStats | null>(null);
  const [usageTrends, setUsageTrends] = useState<UsageTrend[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel
      const [statsData, trendsData, activityData, alertsData] = await Promise.allSettled([
        fetchDashboardStats(),
        fetchUsageTrends(),
        fetchRecentActivity(),
        fetchAlerts(),
      ]);

      // Handle stats
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      } else {
        // Fallback demo data
        setStats({
          activeUsers: { value: 0, change: 0 },
          conversations: { value: 0, change: 0 },
          apiRequests: { value: 0, change: 0 },
          creditsUsed: { value: 0, change: 0, total: 1000 },
          activeCartridges: 0,
          totalCartridges: 0,
          mlsUsage: { value: 0, limit: 100 },
        });
      }

      // Handle trends
      if (trendsData.status === 'fulfilled') {
        setUsageTrends(trendsData.value);
      } else {
        setUsageTrends([
          { date: 'Mon', requests: 0, tokens: 0 },
          { date: 'Tue', requests: 0, tokens: 0 },
          { date: 'Wed', requests: 0, tokens: 0 },
          { date: 'Thu', requests: 0, tokens: 0 },
          { date: 'Fri', requests: 0, tokens: 0 },
          { date: 'Sat', requests: 0, tokens: 0 },
          { date: 'Sun', requests: 0, tokens: 0 },
        ]);
      }

      // Handle activity
      if (activityData.status === 'fulfilled') {
        setActivity(activityData.value);
      } else {
        setActivity([]);
      }

      // Handle alerts
      if (alertsData.status === 'fulfilled') {
        setAlerts(alertsData.value);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  const creditsPercentage = stats ? (stats.creditsUsed.value / stats.creditsUsed.total) * 100 : 0;
  const mlsPercentage = stats ? (stats.mlsUsage.value / stats.mlsUsage.limit) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your organization&apos;s Think Tank overview
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertBanner key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Users"
          value={stats?.activeUsers.value ?? 0}
          change={stats?.activeUsers.change ?? 0}
          icon={Users}
          format="number"
        />
        <MetricCard
          title="Conversations"
          value={stats?.conversations.value ?? 0}
          change={stats?.conversations.change ?? 0}
          icon={MessageSquare}
          format="number"
        />
        <MetricCard
          title="API Requests"
          value={stats?.apiRequests.value ?? 0}
          change={stats?.apiRequests.change ?? 0}
          icon={Activity}
          format="compact"
        />
        <MetricCard
          title="Credits Used"
          value={stats?.creditsUsed.value ?? 0}
          change={stats?.creditsUsed.change ?? 0}
          icon={CreditCard}
          format="currency"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Credits Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Credits Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats?.creditsUsed.value.toLocaleString() ?? 0} used</span>
                <span className="text-muted-foreground">
                  of {stats?.creditsUsed.total.toLocaleString() ?? 0}
                </span>
              </div>
              <Progress value={creditsPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {(100 - creditsPercentage).toFixed(1)}% remaining this period
              </p>
            </div>
          </CardContent>
        </Card>

        {/* MLS Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              MLS Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>${stats?.mlsUsage.value.toFixed(2) ?? '0.00'}</span>
                <span className="text-muted-foreground">
                  limit: ${stats?.mlsUsage.limit ?? 100}
                </span>
              </div>
              <Progress 
                value={mlsPercentage} 
                className={`h-2 ${mlsPercentage > 80 ? '[&>div]:bg-amber-500' : ''}`} 
              />
              <p className="text-xs text-muted-foreground">
                Mid-Level Services this month
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cartridges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Cartridges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.activeCartridges ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  active of {stats?.totalCartridges ?? 0} total
                </p>
              </div>
              <Link href="/cartridges">
                <Button variant="outline" size="sm">
                  Manage
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Trends Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Trends
            </CardTitle>
            <CardDescription>API requests and token usage this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  <XAxis 
                    dataKey="date" 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorRequests)"
                    name="Requests"
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="hsl(var(--chart-2))"
                    fillOpacity={1}
                    fill="url(#colorTokens)"
                    name="Tokens (K)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest events in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity
                </p>
              ) : (
                activity.slice(0, 5).map((item) => (
                  <ActivityItem key={item.id} item={item} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Manage Users"
          description="Invite and manage team members"
          href="/users"
          icon={Users}
        />
        <QuickActionCard
          title="Create Report"
          description="Generate usage or analytics reports"
          href="/reports"
          icon={FileText}
        />
        <QuickActionCard
          title="Team Settings"
          description="Configure organization preferences"
          href="/settings"
          icon={Settings}
        />
        <QuickActionCard
          title="Security"
          description="Manage MFA and access policies"
          href="/security"
          icon={Shield}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="h-[400px] col-span-2" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  format?: 'number' | 'currency' | 'compact';
}

function MetricCard({ title, value, change, icon: Icon, format = 'number' }: MetricCardProps) {
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

function AlertBanner({ alert }: { alert: Alert }) {
  const colors = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
  };

  const icons = {
    warning: AlertTriangle,
    info: Bell,
    error: AlertTriangle,
  };

  const Icon = icons[alert.type];

  return (
    <div className={`p-4 rounded-lg border ${colors[alert.type]}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{alert.title}</p>
          <p className="text-sm opacity-90">{alert.message}</p>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: ActivityItem }) {
  const icons = {
    user_joined: Users,
    report_generated: FileText,
    cartridge_activated: Package,
    settings_changed: Settings,
    alert: Bell,
  };

  const Icon = icons[item.type] || Activity;

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
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{item.message}</p>
        <p className="text-xs text-muted-foreground">
          {item.actor && `${item.actor} • `}
          {formatTime(item.timestamp)}
        </p>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function QuickActionCard({ title, description, href, icon: Icon }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
