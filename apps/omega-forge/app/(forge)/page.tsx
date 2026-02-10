'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Brain, Package, Bot, Globe,
  Activity, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import type { Row } from '@/lib/types';

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-2 text-zinc-400 mb-2">
        <Icon className={`h-4 w-4 ${color || ''}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function ForgeDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['forge', 'dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-amber-500" />
          OMEGA Forge
        </h1>
        <p className="text-zinc-400 mt-1">
          System admin dashboard — cartridge authoring, brain management & platform intelligence
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading system state...
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Package}
            label="Cartridges"
            value={stats?.cartridges?.total || 0}
            sub={`${stats?.cartridges?.active || 0} active`}
            color="text-blue-400"
          />
          <StatCard
            icon={Brain}
            label="OMEGA Brains"
            value={stats?.brains?.total || 0}
            sub={`${stats?.brains?.healthy || 0} healthy`}
            color="text-purple-400"
          />
          <StatCard
            icon={Bot}
            label="CATO Instances"
            value={stats?.cato?.total || 0}
            color="text-green-400"
          />
          <StatCard
            icon={Globe}
            label="Global Brain"
            value={stats?.globalBrain?.enrolledTenants || 0}
            sub={`${stats?.globalBrain?.completedRounds || 0} rounds completed`}
            color="text-amber-400"
          />
        </div>
      )}

      {/* Recent Activity */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-zinc-400" />
          Recent Activity
        </h2>
        {stats?.recentAudit?.length > 0 ? (
          <div className="space-y-2">
            {stats.recentAudit.map((entry: Row, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-zinc-800 last:border-0">
                {entry.action?.includes('fail') ? (
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                )}
                <span className="text-zinc-300 flex-1">{entry.action}</span>
                <span className="text-zinc-500 text-xs font-mono">{entry.cartridge_id?.slice(0, 8) || '—'}</span>
                <span className="text-zinc-500 text-xs">
                  {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">No recent activity</div>
        )}
      </div>
    </div>
  );
}
