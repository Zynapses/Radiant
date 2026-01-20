'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { api } from '@/lib/api/client';
import { 
  Users, 
  MessageSquare, 
  ListChecks, 
  Activity,
  Zap,
  RefreshCw,
} from 'lucide-react';

interface DashboardStats {
  activeUsers: number;
  activeUsersChange: number;
  conversations: number;
  conversationsChange: number;
  userRules: number;
  userRulesChange: number;
  apiRequests: number;
  apiRequestsChange: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get<DashboardStats>('/api/thinktank-admin/dashboard/stats');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        // Set fallback demo data on error
        setStats({
          activeUsers: 0,
          activeUsersChange: 0,
          conversations: 0,
          conversationsChange: 0,
          userRules: 0,
          userRulesChange: 0,
          apiRequests: 0,
          apiRequestsChange: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const getTrend = (change: number): 'up' | 'down' | 'neutral' => {
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0] || 'Admin'}</h1>
        <p className="text-muted-foreground mt-1">
          Think Tank administration for {user?.tenantId || 'your organization'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Active Users"
              value={stats?.activeUsers?.toLocaleString() || '0'}
              change={formatChange(stats?.activeUsersChange || 0)}
              icon={Users}
              trend={getTrend(stats?.activeUsersChange || 0)}
            />
            <StatCard
              title="Conversations"
              value={stats?.conversations?.toLocaleString() || '0'}
              change={formatChange(stats?.conversationsChange || 0)}
              icon={MessageSquare}
              trend={getTrend(stats?.conversationsChange || 0)}
            />
            <StatCard
              title="User Rules"
              value={stats?.userRules?.toLocaleString() || '0'}
              change={formatChange(stats?.userRulesChange || 0)}
              icon={ListChecks}
              trend={getTrend(stats?.userRulesChange || 0)}
            />
            <StatCard
              title="API Requests"
              value={stats?.apiRequests?.toLocaleString() || '0'}
              change={formatChange(stats?.apiRequestsChange || 0)}
              icon={Activity}
              trend={getTrend(stats?.apiRequestsChange || 0)}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction
          title="Manage Users"
          description="View and manage Think Tank users in your organization"
          href="/users"
          icon={Users}
        />
        <QuickAction
          title="Configure Delight"
          description="Customize personality and feedback settings"
          href="/delight"
          icon={Zap}
        />
        <QuickAction
          title="Domain Modes"
          description="Configure domain detection and routing"
          href="/domain-modes"
          icon={Activity}
        />
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Isolated Administration</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This admin interface communicates with Radiant exclusively through the API. 
              No direct access to infrastructure or databases.
            </p>
          </div>
        </div>
      </div>
    </div>
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
