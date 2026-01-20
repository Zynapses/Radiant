'use client';

import { MetricCard } from '@/components/dashboard/metric-card';
import { SystemHealth } from '@/components/dashboard/system-health';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { useDashboard } from '@/lib/hooks/use-dashboard';
import { 
  Activity, 
  DollarSign, 
  Cpu, 
  Users,
  Zap,
  TrendingUp
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  const usageTrends = data?.usageTrends ?? [
    { date: 'Mon', requests: 0, tokens: 0 },
    { date: 'Tue', requests: 0, tokens: 0 },
    { date: 'Wed', requests: 0, tokens: 0 },
    { date: 'Thu', requests: 0, tokens: 0 },
    { date: 'Fri', requests: 0, tokens: 0 },
    { date: 'Sat', requests: 0, tokens: 0 },
    { date: 'Sun', requests: 0, tokens: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          RADIANT platform overview and metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Requests"
          value={data?.totalRequests?.value ?? 0}
          change={data?.totalRequests?.change ?? 0}
          icon={Activity}
          loading={isLoading}
        />
        <MetricCard
          title="Active Models"
          value={data?.activeModels?.value ?? 0}
          change={0}
          icon={Cpu}
          loading={isLoading}
          format="number"
        />
        <MetricCard
          title="Revenue (MTD)"
          value={data?.revenue?.value ?? 0}
          change={data?.revenue?.change ?? 0}
          icon={DollarSign}
          loading={isLoading}
          format="currency"
        />
        <MetricCard
          title="Error Rate"
          value={data?.errorRate?.value ?? 0}
          change={data?.errorRate?.change ?? 0}
          icon={Zap}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SystemHealth />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ActivityFeed />
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage Trends
          </h3>
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
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
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
        </div>
      </div>
    </div>
  );
}
