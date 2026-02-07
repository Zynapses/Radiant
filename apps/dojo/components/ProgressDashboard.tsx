'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Award,
  Loader2,
  ChevronRight,
  Star,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import { fetchProgress, type UserProgress, type ThemeProgress as ThemeProgressType } from '@/lib/api';
import { cn, RANK_META, xpPercentage, accuracyColor, formatDuration } from '@/lib/utils';

export function ProgressDashboard() {
  const { tenantId, userId } = useDojoStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dojo-progress', tenantId, userId],
    queryFn: () => fetchProgress(tenantId, userId),
    enabled: !!tenantId && !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
      </div>
    );
  }

  const progress = data?.progress;

  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Trophy className="w-12 h-12 text-white/10 mb-4" />
        <h3 className="text-lg font-medium text-white/40">No Progress Yet</h3>
        <p className="text-sm text-white/25 mt-1">Complete training sessions to track your mastery</p>
      </div>
    );
  }

  const rankMeta = RANK_META[progress.overall_rank];
  const xpPct = xpPercentage(progress.overall_xp, progress.xp_to_next_rank);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header — Overall Rank */}
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center gap-6">
          {/* Rank Badge */}
          <div className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center',
            rankMeta.bg, rankMeta.border, 'border-2'
          )}>
            <div className="text-center">
              <Star className={cn('w-8 h-8 mx-auto', rankMeta.color)} />
              <span className={cn('text-[10px] font-bold uppercase tracking-wider mt-1 block', rankMeta.color)}>
                {rankMeta.label}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">Your Progress</h1>
            <p className="text-sm text-white/40 mb-3">
              {progress.overall_xp.toLocaleString()} XP · {progress.total_sessions} sessions · {formatDuration(progress.total_time_minutes)} total
            </p>

            {/* XP Progress Bar */}
            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', 'bg-gradient-to-r from-dojo-600 to-dojo-400')}
                style={{ width: `${xpPct}%` }}
              />
              <div className="absolute inset-0 progress-shimmer rounded-full" />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-white/30 font-mono">{progress.overall_xp} XP</span>
              <span className="text-[10px] text-white/30 font-mono">
                {progress.xp_to_next_rank > 0 ? `${progress.xp_to_next_rank} to next rank` : 'Max rank'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/[0.06]">
          <StatCard icon={Flame} label="Streak" value={`${progress.streak_days}d`} color="text-dojo-400" />
          <StatCard icon={Target} label="Sessions" value={String(progress.total_sessions)} color="text-omega-400" />
          <StatCard icon={Clock} label="Time" value={formatDuration(progress.total_time_minutes)} color="text-purple-400" />
          <StatCard icon={Award} label="Certs" value={String(progress.certifications.length)} color="text-green-400" />
        </div>
      </div>

      {/* Theme Progress */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Theme Mastery</h2>
        {progress.theme_progress.length === 0 ? (
          <p className="text-sm text-white/30">No theme progress yet. Start a training session to begin.</p>
        ) : (
          <div className="space-y-3">
            {progress.theme_progress.map((tp) => (
              <ThemeProgressCard key={tp.theme_id} progress={tp} />
            ))}
          </div>
        )}
      </div>

      {/* Certifications */}
      {progress.certifications.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Certifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {progress.certifications.map((cert) => {
              const certRank = RANK_META[cert.rank_achieved];
              return (
                <div
                  key={cert.id}
                  className={cn(
                    'p-4 rounded-xl border',
                    cert.passed
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-white/[0.02] border-white/[0.06]'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Award className={cn('w-4 h-4', cert.passed ? 'text-green-400' : 'text-white/30')} />
                      <span className="font-medium text-white text-sm">{cert.theme_name}</span>
                    </div>
                    <span className={cn('text-xs font-medium', certRank.color)}>{certRank.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    <span>{cert.score}/{cert.max_score}</span>
                    <span>·</span>
                    <span>{cert.exam_duration_minutes}m</span>
                    <span>·</span>
                    <span>{new Date(cert.issued_at).toLocaleDateString()}</span>
                    {cert.proctored && (
                      <>
                        <span>·</span>
                        <span className="text-dojo-400">Proctored</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Flame; label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <Icon className={cn('w-5 h-5 mx-auto mb-1.5', color)} />
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function ThemeProgressCard({ progress }: { progress: ThemeProgressType }) {
  const rankMeta = RANK_META[progress.rank];
  const pct = xpPercentage(progress.xp, progress.xp_to_next);

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', rankMeta.bg, rankMeta.border, 'border')}>
            <Star className={cn('w-4 h-4', rankMeta.color)} />
          </div>
          <div>
            <h3 className="font-medium text-white text-sm">{progress.theme_name}</h3>
            <div className="flex items-center gap-2 text-[10px] text-white/30">
              <span className={rankMeta.color}>{rankMeta.label}</span>
              <span>·</span>
              <span>{Math.round(progress.mastery_percentage)}% mastery</span>
              <span>·</span>
              <span className={accuracyColor(progress.accuracy)}>
                {Math.round(progress.accuracy * 100)}% accuracy
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-dojo-400">{progress.xp} XP</p>
          <p className="text-[10px] text-white/20">{progress.questions_attempted} questions</p>
        </div>
      </div>

      {/* XP Bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-dojo-600 to-dojo-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Strengths / Weaknesses */}
      {(progress.strengths.length > 0 || progress.weaknesses.length > 0) && (
        <div className="flex gap-4 mt-3 text-[10px]">
          {progress.strengths.length > 0 && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-green-400/70">{progress.strengths.slice(0, 2).join(', ')}</span>
            </div>
          )}
          {progress.weaknesses.length > 0 && (
            <div className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-red-400" />
              <span className="text-red-400/70">{progress.weaknesses.slice(0, 2).join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
