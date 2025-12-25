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

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

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
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Chart placeholder
          </div>
        </div>
      </div>
    </div>
  );
}
