'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  fetchDecayDashboard,
  triggerReinforcement,
  submitReinforcementAnswer,
  type DecayDashboard,
  type ReinforcementSession,
  type SparringAnswer,
} from '@/lib/api';
import { cn, formatDuration } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

export function DecayEngine() {
  const { tenantId, userId } = useDojoStore();
  const queryClient = useQueryClient();
  const delight = useRadiantDelightOptional();
  const [reinforcement, setReinforcement] = useState<ReinforcementSession | null>(null);
  const [currentAtomIdx, setCurrentAtomIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; xp: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dojo-decay', tenantId, userId],
    queryFn: () => fetchDecayDashboard(tenantId, userId),
    enabled: !!tenantId && !!userId,
    refetchInterval: 60_000,
  });

  const reinforceMutation = useMutation({
    mutationFn: () => triggerReinforcement(tenantId, userId, 'manual'),
    onSuccess: (data) => {
      setReinforcement(data.session);
      setCurrentAtomIdx(0);
      setShowResult(false);
      setLastResult(null);
      delight?.triggerDelight('session_start');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const answerMutation = useMutation({
    mutationFn: (answer: SparringAnswer) => {
      if (!reinforcement) throw new Error('No reinforcement session');
      const atom = reinforcement.atoms[currentAtomIdx];
      return submitReinforcementAnswer(reinforcement.id, atom.atom.id, answer);
    },
    onSuccess: (data) => {
      setLastResult({ correct: data.result.correct, xp: data.result.xp_awarded });
      setShowResult(true);
      queryClient.invalidateQueries({ queryKey: ['dojo-decay'] });
      delight?.triggerDelight(data.result.correct ? 'action_complete' : 'error_recovery');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const handleSubmitAnswer = () => {
    if (!reinforcement) return;
    const atom = reinforcement.atoms[currentAtomIdx];
    const q = atom.question;
    const answer: SparringAnswer = {
      question_id: q.id,
      answer: q.question_type === 'multiple_choice' ? (q.options?.[selectedChoice ?? 0] ?? '') : userAnswer,
      time_taken_seconds: 30,
    };
    answerMutation.mutate(answer);
  };

  const handleNext = () => {
    if (!reinforcement) return;
    if (currentAtomIdx < reinforcement.atoms.length - 1) {
      setCurrentAtomIdx((i) => i + 1);
      setShowResult(false);
      setLastResult(null);
      setUserAnswer('');
      setSelectedChoice(null);
    } else {
      setReinforcement(null);
      setCurrentAtomIdx(0);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
      </div>
    );
  }

  const dashboard = data?.dashboard;

  // Active reinforcement session
  if (reinforcement && reinforcement.atoms.length > 0) {
    const current = reinforcement.atoms[currentAtomIdx];
    const q = current.question;
    const progress = ((currentAtomIdx + 1) / reinforcement.atoms.length) * 100;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-dojo-400" />
            <h2 className="text-lg font-semibold text-white">Reinforcement Session</h2>
          </div>
          <span className="text-sm text-white/40 font-mono">
            {currentAtomIdx + 1}/{reinforcement.atoms.length}
          </span>
        </div>

        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-dojo-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Decay context */}
        <div className="glass-panel rounded-xl p-3 flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            current.decay.retention_probability < 0.5
              ? 'bg-red-500/10'
              : current.decay.retention_probability < 0.75
              ? 'bg-yellow-500/10'
              : 'bg-green-500/10'
          )}>
            <BarChart3 className={cn(
              'w-4 h-4',
              current.decay.retention_probability < 0.5
                ? 'text-red-400'
                : current.decay.retention_probability < 0.75
                ? 'text-yellow-400'
                : 'text-green-400'
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{current.atom.concept}</p>
            <p className="text-[10px] text-white/30">
              Retention: {Math.round(current.decay.retention_probability * 100)}% ·
              Half-life: {Math.round(current.decay.half_life_hours)}h ·
              Reviews: {current.decay.review_count}
            </p>
          </div>
        </div>

        {/* Question */}
        <div className="glass-panel rounded-xl p-6">
          <p className="text-white mb-4">{q.question}</p>

          {q.question_type === 'multiple_choice' && q.options && (
            <div className="space-y-2">
              {q.options.map((c: string, i: number) => (
                <button
                  key={i}
                  onClick={() => !showResult && setSelectedChoice(i)}
                  disabled={showResult}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm',
                    selectedChoice === i
                      ? 'border-dojo-500/40 bg-dojo-500/10 text-white'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]',
                    showResult && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {(q.question_type === 'open_ended' || q.question_type === 'scenario') && (
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showResult}
              rows={4}
              placeholder="Your answer..."
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:border-dojo-500/40 focus:outline-none resize-none"
            />
          )}

          {q.question_type === 'true_false' && (
            <div className="flex gap-3">
              {['True', 'False'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => !showResult && setUserAnswer(opt.toLowerCase())}
                  disabled={showResult}
                  className={cn(
                    'flex-1 py-3 rounded-lg border text-sm font-medium transition-colors',
                    userAnswer === opt.toLowerCase()
                      ? 'border-dojo-500/40 bg-dojo-500/10 text-white'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result feedback */}
        {showResult && lastResult && (
          <div className={cn(
            'rounded-xl p-4 border',
            lastResult.correct
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.correct ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <span className={cn('font-medium', lastResult.correct ? 'text-green-400' : 'text-red-400')}>
                {lastResult.correct ? 'Correct — memory reinforced!' : 'Incorrect — decay curve reset'}
              </span>
              <span className="text-xs text-dojo-400 ml-auto">+{lastResult.xp} XP</span>
            </div>
            <p className="text-xs text-white/40">
              {lastResult.correct
                ? 'Your half-life for this concept has increased. Next review pushed further out.'
                : 'Half-life shortened. This concept will appear more frequently until mastered.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {!showResult ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={answerMutation.isPending || (q.question_type === 'multiple_choice' ? selectedChoice === null : !userAnswer.trim())}
              className="px-6 py-2.5 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white text-sm font-medium transition-colors"
            >
              {answerMutation.isPending ? 'Checking...' : 'Submit'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg bg-dojo-600 hover:bg-dojo-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {currentAtomIdx < reinforcement.atoms.length - 1 ? 'Next Concept' : 'Complete Session'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-dojo-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Ebbinghaus Decay Engine</h2>
            <p className="text-xs text-white/30">Per-concept neural memory decay tracking</p>
          </div>
        </div>
        <button
          onClick={() => reinforceMutation.mutate()}
          disabled={reinforceMutation.isPending || !dashboard || dashboard.atoms_at_risk === 0}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          {reinforceMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Reinforce Now
        </button>
      </div>

      {!dashboard ? (
        <div className="text-center py-16">
          <Brain className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/40">No Knowledge Atoms Yet</h3>
          <p className="text-sm text-white/25 mt-1">Complete training sessions to build your memory graph</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard
              label="Total Concepts"
              value={dashboard.total_atoms}
              icon={Brain}
              color="text-dojo-400"
            />
            <SummaryCard
              label="At Risk"
              value={dashboard.atoms_at_risk}
              icon={AlertTriangle}
              color="text-red-400"
              highlight={dashboard.atoms_at_risk > 0}
            />
            <SummaryCard
              label="Stable"
              value={dashboard.atoms_stable}
              icon={CheckCircle2}
              color="text-green-400"
            />
            <SummaryCard
              label="Avg Retention"
              value={`${Math.round(dashboard.average_retention * 100)}%`}
              icon={BarChart3}
              color="text-purple-400"
            />
          </div>

          {/* Next reinforcement */}
          {dashboard.next_reinforcement_at && (
            <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-dojo-400" />
              <div>
                <p className="text-sm text-white">Next scheduled reinforcement</p>
                <p className="text-xs text-white/30">
                  {new Date(dashboard.next_reinforcement_at).toLocaleString()}
                </p>
              </div>
              <Zap className="w-4 h-4 text-dojo-500/40 ml-auto" />
            </div>
          )}

          {/* Per-theme decay */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Decay by Theme</h3>
            <div className="space-y-2">
              {dashboard.decay_by_theme.map((t) => {
                const retPct = Math.round(t.avg_retention * 100);
                const retColor =
                  retPct >= 80 ? 'text-green-400' : retPct >= 50 ? 'text-yellow-400' : 'text-red-400';
                const barColor =
                  retPct >= 80 ? 'from-green-600 to-green-400' : retPct >= 50 ? 'from-yellow-600 to-yellow-400' : 'from-red-600 to-red-400';

                return (
                  <div key={t.theme_id} className="glass-panel rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{t.theme_name}</span>
                      <div className="flex items-center gap-3">
                        {t.at_risk_count > 0 && (
                          <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                            {t.at_risk_count} at risk
                          </span>
                        )}
                        <span className={cn('text-sm font-mono font-medium', retColor)}>
                          {retPct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', barColor)}
                        style={{ width: `${retPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: typeof Brain;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'glass-panel rounded-xl p-4 text-center',
      highlight && 'border-red-500/20 bg-red-500/5'
    )}>
      <Icon className={cn('w-5 h-5 mx-auto mb-2', color)} />
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
    </div>
  );
}
