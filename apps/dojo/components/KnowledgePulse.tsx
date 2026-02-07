'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Loader2,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Award,
  Shield,
  BarChart3,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import { fetchKnowledgePulse, type KnowledgePulse as KnowledgePulseType } from '@/lib/api';
import { cn, RANK_META } from '@/lib/utils';

const SEVERITY_META = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle },
  warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: AlertTriangle },
  info: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: CheckCircle2 },
};

export function KnowledgePulseView() {
  const { tenantId } = useDojoStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dojo-pulse', tenantId],
    queryFn: () => fetchKnowledgePulse(tenantId),
    enabled: !!tenantId,
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
      </div>
    );
  }

  const pulse = data?.pulse;

  if (!pulse) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity className="w-12 h-12 text-white/10 mb-4" />
        <h3 className="text-lg font-medium text-white/40">No Pulse Data</h3>
        <p className="text-sm text-white/25 mt-1">Knowledge Pulse requires active training across your organization</p>
      </div>
    );
  }

  const healthColor =
    pulse.overall_health >= 80 ? 'text-green-400' : pulse.overall_health >= 50 ? 'text-yellow-400' : 'text-red-400';
  const healthGlow =
    pulse.overall_health >= 80 ? 'shadow-green-500/20' : pulse.overall_health >= 50 ? 'shadow-yellow-500/20' : 'shadow-red-500/20';
  const trendIcon =
    pulse.trends.avg_session_score_trend === 'up'
      ? TrendingUp
      : pulse.trends.avg_session_score_trend === 'down'
      ? TrendingDown
      : Minus;
  const TrendIcon = trendIcon;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-dojo-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Organizational Knowledge Pulse</h2>
          <p className="text-xs text-white/30">
            Real-time health monitoring across {pulse.total_users} users ·
            Last updated {new Date(pulse.snapshot_at).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Health score hero */}
      <div className={cn('glass-panel rounded-2xl p-8 text-center shadow-lg', healthGlow)}>
        <div className={cn('text-6xl font-bold mb-2', healthColor)}>
          {Math.round(pulse.overall_health)}%
        </div>
        <p className="text-sm text-white/40">Overall Knowledge Health</p>
        <div className="flex items-center justify-center gap-1 mt-2">
          <TrendIcon className={cn(
            'w-4 h-4',
            pulse.trends.avg_session_score_trend === 'up' ? 'text-green-400' :
            pulse.trends.avg_session_score_trend === 'down' ? 'text-red-400' : 'text-white/30'
          )} />
          <span className="text-xs text-white/30">
            {pulse.trends.avg_session_score_trend === 'up' ? 'Improving' :
             pulse.trends.avg_session_score_trend === 'down' ? 'Declining' : 'Stable'}
          </span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-5 gap-3">
        <MetricCard icon={Users} label="Active (30d)" value={pulse.active_users_30d} total={pulse.total_users} color="text-omega-400" />
        <MetricCard icon={Award} label="New Certs (7d)" value={pulse.trends.new_certifications_7d} color="text-dojo-400" />
        <MetricCard icon={DollarSign} label="Cost Savings/mo" value={`$${(pulse.roi_metrics.estimated_cost_savings_monthly / 1000).toFixed(1)}k`} color="text-green-400" />
        <MetricCard icon={Clock} label="Avg Time to Competency" value={`${pulse.roi_metrics.avg_time_to_competency_days}d`} color="text-purple-400" />
        <MetricCard icon={Shield} label="Retention Rate" value={`${Math.round(pulse.roi_metrics.knowledge_retention_rate * 100)}%`} color="text-cyan-400" />
      </div>

      {/* ROI summary */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">ROI Metrics</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-2xl font-bold text-green-400">
              {Math.round(pulse.roi_metrics.certification_pass_rate * 100)}%
            </p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Cert Pass Rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-dojo-400">
              {Math.round(pulse.roi_metrics.knowledge_retention_rate * 100)}%
            </p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Knowledge Retention</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-400">
              {pulse.roi_metrics.training_hours_saved_vs_traditional}h
            </p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Hours Saved vs Traditional</p>
          </div>
        </div>
      </div>

      {/* Decay alerts */}
      {pulse.decay_alerts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Decay Alerts ({pulse.decay_alerts.length})
          </h3>
          <div className="space-y-2">
            {pulse.decay_alerts.map((alert) => {
              const meta = SEVERITY_META[alert.severity];
              const AlertIcon = meta.icon;
              return (
                <div
                  key={alert.id}
                  className={cn('rounded-xl p-4 border', meta.bg, meta.border)}
                >
                  <div className="flex items-start gap-3">
                    <AlertIcon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', meta.color)} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-medium', meta.color)}>{alert.message}</span>
                        <span className="text-[10px] text-white/20">{alert.affected_users} users</span>
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">
                        Theme: {alert.theme_name} · {alert.recommended_action}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Department health */}
      {pulse.department_health.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Department Health</h3>
          <div className="space-y-2">
            {pulse.department_health.map((dept) => {
              const deptColor =
                dept.health_score >= 80 ? 'text-green-400' :
                dept.health_score >= 50 ? 'text-yellow-400' : 'text-red-400';
              const barColor =
                dept.health_score >= 80 ? 'from-green-600 to-green-400' :
                dept.health_score >= 50 ? 'from-yellow-600 to-yellow-400' : 'from-red-600 to-red-400';

              return (
                <div key={dept.department} className="glass-panel rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{dept.department}</span>
                      <span className="text-[10px] text-white/20">{dept.users} users</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {dept.at_risk_count > 0 && (
                        <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          {dept.at_risk_count} at risk
                        </span>
                      )}
                      <span className={cn('text-sm font-mono font-bold', deptColor)}>
                        {Math.round(dept.health_score)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', barColor)}
                      style={{ width: `${dept.health_score}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-white/20">
                    <span>Avg accuracy: {Math.round(dept.avg_accuracy * 100)}%</span>
                    <span>Training: {dept.training_hours_30d}h (30d)</span>
                    <span>Avg rank: {RANK_META[dept.avg_rank]?.label || dept.avg_rank}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Theme coverage */}
      {pulse.theme_coverage.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Theme Coverage</h3>
          <div className="grid grid-cols-2 gap-3">
            {pulse.theme_coverage.map((tc) => (
              <div key={tc.theme_id} className="glass-panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{tc.theme_name}</span>
                  {tc.compliance_required && (
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full',
                      tc.compliance_met
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    )}>
                      {tc.compliance_met ? 'Compliant' : 'Non-Compliant'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div>
                    <p className="text-white font-medium">{tc.users_trained}</p>
                    <p className="text-white/20">Trained</p>
                  </div>
                  <div>
                    <p className="text-white font-medium">{Math.round(tc.avg_mastery * 100)}%</p>
                    <p className="text-white/20">Mastery</p>
                  </div>
                  <div>
                    <p className={cn(
                      'font-medium',
                      tc.decay_risk > 0.5 ? 'text-red-400' : tc.decay_risk > 0.25 ? 'text-yellow-400' : 'text-green-400'
                    )}>
                      {Math.round(tc.decay_risk * 100)}%
                    </p>
                    <p className="text-white/20">Decay Risk</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  total,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  total?: number;
  color: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-4 text-center">
      <Icon className={cn('w-5 h-5 mx-auto mb-2', color)} />
      <p className="text-lg font-bold text-white">
        {value}
        {total !== undefined && <span className="text-xs text-white/20 font-normal">/{total}</span>}
      </p>
      <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
    </div>
  );
}
