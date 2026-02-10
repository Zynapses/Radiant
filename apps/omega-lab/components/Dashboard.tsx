'use client';

import { useQuery } from '@tanstack/react-query';
import { Brain, Activity, Zap, Thermometer, Database, Clock } from 'lucide-react';
import { fetchDashboard, type DashboardData } from '@/lib/api';

export function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-omega-400 animate-pulse" />
          <span className="text-omega-400">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load dashboard</div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">OMEGA Dashboard</h2>
          <p className="text-omega-400">Real-time brain health monitoring</p>
        </div>
        <div className="text-sm text-omega-500">
          Last updated: {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          icon={<Brain className="w-6 h-6" />}
          label="Total Brains"
          value={summary.total_brains}
          color="omega"
        />
        <SummaryCard
          icon={<Activity className="w-6 h-6" />}
          label="Avg Coherence"
          value={`${(summary.health.avg_coherence * 100).toFixed(1)}%`}
          color={summary.health.avg_coherence > 0.6 ? 'green' : summary.health.avg_coherence > 0.3 ? 'yellow' : 'red'}
        />
        <SummaryCard
          icon={<Zap className="w-6 h-6" />}
          label="Total Cycles"
          value={summary.usage.total_cycles.toLocaleString()}
          color="purple"
        />
        <SummaryCard
          icon={<Database className="w-6 h-6" />}
          label="Storage Used"
          value={`${summary.usage.total_storage_mb.toFixed(1)} MB`}
          color="blue"
        />
      </div>

      {/* Thermal Distribution */}
      <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-omega-400" />
          Thermal Distribution
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <ThermalStat
            label="Warm"
            count={summary.thermal.warm}
            total={summary.total_brains}
            color="red"
            description="Active < 15 min"
          />
          <ThermalStat
            label="Cooling"
            count={summary.thermal.cooling}
            total={summary.total_brains}
            color="orange"
            description="Active 15-60 min"
          />
          <ThermalStat
            label="Cold"
            count={summary.thermal.cold}
            total={summary.total_brains}
            color="blue"
            description="Active 1-24 hours"
          />
          <ThermalStat
            label="Frozen"
            count={summary.thermal.frozen}
            total={summary.total_brains}
            color="indigo"
            description="Active > 24 hours"
          />
        </div>
      </div>

      {/* Health Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Health Alerts</h3>
          <div className="space-y-3">
            {summary.health.high_entropy > 0 && (
              <AlertItem
                type="warning"
                message={`${summary.health.high_entropy} brain(s) have high entropy (need dreaming)`}
              />
            )}
            {summary.health.low_coherence > 0 && (
              <AlertItem
                type="error"
                message={`${summary.health.low_coherence} brain(s) have low coherence (confused)`}
              />
            )}
            {summary.health.high_entropy === 0 && summary.health.low_coherence === 0 && (
              <AlertItem
                type="success"
                message="All brains are healthy"
              />
            )}
          </div>
        </div>

        <div className="bg-omega-900/50 rounded-xl border border-omega-800/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
          <div className="space-y-4">
            <StatusRow label="EFS Mount" status="online" />
            <StatusRow label="S3 Backup" status="online" />
            <StatusRow label="Heartbeat" status="online" />
            <StatusRow label="Inference API" status="online" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'omega' | 'green' | 'yellow' | 'red' | 'purple' | 'blue';
}) {
  const colorClasses = {
    omega: 'from-omega-500/20 to-omega-600/10 border-omega-500/30 text-omega-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  };

  return (
    <div
      className={`
        bg-gradient-to-br ${colorClasses[color]}
        rounded-xl border p-6
      `}
    >
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm text-omega-300">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function ThermalStat({
  label,
  count,
  total,
  color,
  description,
}: {
  label: string;
  count: number;
  total: number;
  color: 'red' | 'orange' | 'blue' | 'indigo';
  description: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  const colorClasses = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white mb-1">{count}</div>
      <div className="text-sm text-omega-400 mb-2">{label}</div>
      <div className="h-2 bg-omega-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-omega-500 mt-1">{description}</div>
    </div>
  );
}

function AlertItem({
  type,
  message,
}: {
  type: 'success' | 'warning' | 'error';
  message: string;
}) {
  const colorClasses = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  return (
    <div className={`px-4 py-2 rounded-lg border ${colorClasses[type]}`}>
      {message}
    </div>
  );
}

function StatusRow({
  label,
  status,
}: {
  label: string;
  status: 'online' | 'offline' | 'degraded';
}) {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    degraded: 'bg-yellow-500',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-omega-300">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-sm text-omega-400 capitalize">{status}</span>
      </div>
    </div>
  );
}
