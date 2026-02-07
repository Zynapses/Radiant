'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Network,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  fetchCompetencyMesh,
  extractCompetencies,
  type CompetencyMesh as CompetencyMeshType,
  type UserCompetencyScore,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

const TREND_ICON = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};
const TREND_COLOR = {
  improving: 'text-green-400',
  stable: 'text-white/30',
  declining: 'text-red-400',
};
const PRIORITY_META: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  low: { color: 'text-green-400', bg: 'bg-green-500/10' },
};

export function CompetencyMeshView() {
  const { tenantId, userId, activeLibrary } = useDojoStore();
  const delight = useRadiantDelightOptional();

  const { data, isLoading } = useQuery({
    queryKey: ['dojo-competency', tenantId, userId, activeLibrary?.id],
    queryFn: () => fetchCompetencyMesh(tenantId, userId, activeLibrary!.id),
    enabled: !!tenantId && !!userId && !!activeLibrary,
  });

  const extractMutation = useMutation({
    mutationFn: () => extractCompetencies(activeLibrary!.id),
    onSuccess: () => { delight?.triggerDelight('milestone'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  if (!activeLibrary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Network className="w-12 h-12 text-white/10 mb-4" />
        <h3 className="text-lg font-medium text-white/40">Select a Library</h3>
        <p className="text-sm text-white/25 mt-1">Go to the Library tab and select a library to view competencies</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
      </div>
    );
  }

  const mesh = data?.mesh;

  if (!mesh || mesh.competencies.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <Network className="w-12 h-12 text-white/10 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white/40">No Competencies Mapped</h3>
        <p className="text-sm text-white/25 mt-2 mb-6">
          Extract competencies from your library to build a predictive skill mesh
        </p>
        <button
          onClick={() => extractMutation.mutate()}
          disabled={extractMutation.isPending}
          className="px-6 py-2.5 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white text-sm font-medium transition-colors"
        >
          {extractMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Extracting competencies...
            </span>
          ) : (
            'Extract Competencies from Library'
          )}
        </button>
      </div>
    );
  }

  // Group competencies by category
  const byCategory: Record<string, UserCompetencyScore[]> = {};
  mesh.competencies.forEach((c) => {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Network className="w-6 h-6 text-dojo-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Competency Mesh</h2>
          <p className="text-xs text-white/30">Predictive skill mapping with gap analysis</p>
        </div>
      </div>

      {/* Role readiness scores */}
      {mesh.readiness_scores.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Role Readiness</h3>
          <div className="grid grid-cols-2 gap-3">
            {mesh.readiness_scores.map((r) => {
              const scorePct = Math.round(r.score * 100);
              const barColor =
                scorePct >= 80
                  ? 'from-green-600 to-green-400'
                  : scorePct >= 50
                  ? 'from-yellow-600 to-yellow-400'
                  : 'from-red-600 to-red-400';

              return (
                <div key={r.role} className="glass-panel rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{r.role}</span>
                    <span className={cn(
                      'text-sm font-mono font-bold',
                      scorePct >= 80 ? 'text-green-400' : scorePct >= 50 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {scorePct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', barColor)}
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>
                  {r.missing_competencies.length > 0 && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-yellow-400/70">
                        Missing: {r.missing_competencies.slice(0, 3).join(', ')}
                        {r.missing_competencies.length > 3 && ` +${r.missing_competencies.length - 3} more`}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] text-white/20">
                      Est. {r.estimated_time_to_ready_hours}h to ready
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Competency grid by category */}
      {Object.entries(byCategory).map(([category, competencies]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-white mb-3">{category}</h3>
          <div className="space-y-2">
            {competencies.map((c) => {
              const TrendIcon = TREND_ICON[c.trend];
              const levelPct = (c.current_level / c.max_level) * 100;

              return (
                <div key={c.competency_id} className="glass-panel rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{c.competency_name}</span>
                      <TrendIcon className={cn('w-3 h-3', TREND_COLOR[c.trend])} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/20">
                        {c.evidence_count} evidence points
                      </span>
                      <span className="text-sm font-mono text-dojo-400">
                        L{c.current_level}/{c.max_level}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-dojo-600 to-dojo-400 transition-all duration-500"
                      style={{ width: `${levelPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-white/20">
                      Confidence: {Math.round(c.confidence * 100)}%
                    </span>
                    {c.gap_to_target > 0 && (
                      <span className="text-[10px] text-yellow-400">
                        {c.gap_to_target} level{c.gap_to_target !== 1 ? 's' : ''} below target
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Recommended learning path */}
      {mesh.recommended_path.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-dojo-400" />
            Recommended Learning Path
          </h3>
          <div className="space-y-2">
            {mesh.recommended_path.map((step, i) => {
              const pMeta = PRIORITY_META[step.priority] || PRIORITY_META.medium;
              return (
                <div key={step.competency_id} className="flex items-center gap-3 glass-panel rounded-xl p-3">
                  <span className="text-xs text-white/20 font-mono w-6">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{step.competency_name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', pMeta.bg, pMeta.color)}>
                        {step.priority}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {step.estimated_sessions} session{step.estimated_sessions !== 1 ? 's' : ''} estimated
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/10" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
