'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Scale,
  Loader2,
  Send,
  Lightbulb,
  ShieldAlert,
  Merge,
  Eye,
  FileText,
  ChevronDown,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  startDialectic,
  submitDialecticResponse,
  concludeDialectic,
  type DialecticSession,
  type DialecticTurn,
  type DialecticRole,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

const ROLE_META: Record<DialecticRole | 'learner', { label: string; icon: typeof Scale; color: string; bg: string }> = {
  thesis: { label: 'Thesis Agent', icon: Lightbulb, color: 'text-green-400', bg: 'bg-green-500/10' },
  antithesis: { label: 'Antithesis Agent', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
  synthesis: { label: 'Synthesis Agent', icon: Merge, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  moderator: { label: 'Moderator', icon: Eye, color: 'text-dojo-400', bg: 'bg-dojo-500/10' },
  learner: { label: 'You', icon: Scale, color: 'text-omega-400', bg: 'bg-omega-500/10' },
};

const REASONING_LABELS: Record<string, { label: string; color: string }> = {
  claim: { label: 'Claim', color: 'text-blue-400' },
  evidence: { label: 'Evidence', color: 'text-green-400' },
  rebuttal: { label: 'Rebuttal', color: 'text-red-400' },
  concession: { label: 'Concession', color: 'text-yellow-400' },
  synthesis: { label: 'Synthesis', color: 'text-purple-400' },
  question: { label: 'Question', color: 'text-dojo-400' },
};

export function DialecticArena() {
  const { activeSession, selectedThemes, activeDialectic, setActiveDialectic } = useDojoStore();
  const delight = useRadiantDelightOptional();
  const [input, setInput] = useState('');
  const [reasoningType, setReasoningType] = useState<'claim' | 'evidence' | 'rebuttal' | 'concession' | 'synthesis'>('claim');
  const scrollRef = useRef<HTMLDivElement>(null);

  const startMutation = useMutation({
    mutationFn: (themeId: string) =>
      startDialectic(activeSession?.id || 'global', { theme_id: themeId }),
    onSuccess: (data) => { setActiveDialectic(data.dialectic); delight?.triggerDelight('session_start'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const respondMutation = useMutation({
    mutationFn: ({ content, type }: { content: string; type: typeof reasoningType }) => {
      if (!activeDialectic) throw new Error('No dialectic');
      return submitDialecticResponse(activeDialectic.id, content, type);
    },
    onSuccess: (data) => { setActiveDialectic(data.dialectic); delight?.triggerDelight('action_complete'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const concludeMutation = useMutation({
    mutationFn: () => {
      if (!activeDialectic) throw new Error('No dialectic');
      return concludeDialectic(activeDialectic.id);
    },
    onSuccess: (data) => { setActiveDialectic(data.dialectic); delight?.triggerDelight('milestone'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || respondMutation.isPending) return;
    setInput('');
    respondMutation.mutate({ content: msg, type: reasoningType });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeDialectic?.turns?.length]);

  // Start screen — pick a theme for dialectic
  if (!activeDialectic || activeDialectic.status === 'concluded') {
    if (activeDialectic?.status === 'concluded') {
      return <DialecticDebrief dialectic={activeDialectic} onReset={() => setActiveDialectic(null)} />;
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-dojo-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Socratic Dialectic</h2>
            <p className="text-xs text-white/30">
              Multi-agent debate — Thesis vs Antithesis. Defend your position with evidence.
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">How it works</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Lightbulb className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-white">Thesis Agent</p>
              <p className="text-[10px] text-white/30 mt-1">Presents the proposition with evidence from your library</p>
            </div>
            <div>
              <ShieldAlert className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-white">Antithesis Agent</p>
              <p className="text-[10px] text-white/30 mt-1">Challenges with counterarguments and edge cases</p>
            </div>
            <div>
              <Merge className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-white">Synthesis Agent</p>
              <p className="text-[10px] text-white/30 mt-1">Reconciles positions after you&apos;ve taken a stand</p>
            </div>
          </div>
        </div>

        {selectedThemes.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-8">
            Select themes first to begin a dialectic session.
          </p>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Choose a Theme for Debate</h3>
            <div className="space-y-2">
              {selectedThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => startMutation.mutate(theme.id)}
                  disabled={startMutation.isPending}
                  className="w-full glass-panel rounded-xl p-4 text-left hover:bg-white/[0.04] transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="text-sm font-medium text-white">{theme.name}</span>
                    <p className="text-[10px] text-white/30 mt-0.5">{theme.description}</p>
                  </div>
                  <Scale className="w-4 h-4 text-white/20 group-hover:text-dojo-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {startMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-dojo-400/60 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating dialectic proposition...
          </div>
        )}
      </div>
    );
  }

  // Active dialectic
  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="glass-panel rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Dialectic in Progress</h2>
            <p className="text-[10px] text-white/30 mt-0.5 max-w-xl">{activeDialectic.proposition}</p>
          </div>
          <button
            onClick={() => concludeMutation.mutate()}
            disabled={concludeMutation.isPending}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            Conclude
          </button>
        </div>
      </div>

      {/* Turns */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
        {activeDialectic.turns.map((turn) => {
          const roleMeta = ROLE_META[turn.role];
          const reasoningMeta = REASONING_LABELS[turn.reasoning_type];
          const isLearner = turn.role === 'learner';

          return (
            <div key={turn.id} className={cn('max-w-[90%]', isLearner ? 'ml-auto' : '')}>
              <div className={cn('flex items-center gap-1.5 mb-1', isLearner ? 'justify-end' : '')}>
                <roleMeta.icon className={cn('w-3 h-3', roleMeta.color)} />
                <span className="text-[10px] text-white/20">{roleMeta.label}</span>
                {reasoningMeta && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded bg-white/5', reasoningMeta.color)}>
                    {reasoningMeta.label}
                  </span>
                )}
                {turn.quality_score !== null && (
                  <span className="text-[10px] text-dojo-400/50 ml-1">
                    {Math.round(turn.quality_score * 100)}%
                  </span>
                )}
              </div>

              <div className={cn(
                'p-3 rounded-xl border',
                isLearner
                  ? 'bg-omega-500/5 border-omega-500/20'
                  : cn(roleMeta.bg, 'border-white/[0.06]')
              )}>
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{turn.content}</p>

                {turn.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
                    {turn.citations.slice(0, 2).map((c, i) => (
                      <div key={`${c.chunk_id}-${i}`} className="flex items-start gap-1.5 text-[10px] text-white/25">
                        <FileText className="w-2.5 h-2.5 text-omega-400 flex-shrink-0 mt-0.5" />
                        <span>
                          <span className="text-omega-300">{c.document_name}</span>
                          {' — '}
                          <span className="italic">{c.excerpt.slice(0, 60)}...</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {respondMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-dojo-400/60">
            <Loader2 className="w-3 h-3 animate-spin" />
            Agents deliberating...
          </div>
        )}
      </div>

      {/* Input with reasoning type selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">Reasoning type:</span>
          {(['claim', 'evidence', 'rebuttal', 'concession', 'synthesis'] as const).map((rt) => {
            const meta = REASONING_LABELS[rt];
            return (
              <button
                key={rt}
                onClick={() => setReasoningType(rt)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded border transition-colors',
                  reasoningType === rt
                    ? cn('border-white/20 bg-white/5', meta.color)
                    : 'border-transparent text-white/30 hover:text-white/50'
                )}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Present your argument..."
            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:border-dojo-500/40 focus:outline-none resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || respondMutation.isPending}
            className="p-3 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DialecticDebrief({ dialectic, onReset }: { dialectic: DialecticSession; onReset: () => void }) {
  const scores = [
    { label: 'Reasoning Chain', value: dialectic.reasoning_chain_score, color: 'text-blue-400' },
    { label: 'Argument Quality', value: dialectic.argument_quality_score, color: 'text-green-400' },
    { label: 'Evidence Usage', value: dialectic.evidence_usage_score, color: 'text-purple-400' },
    { label: 'Critical Thinking', value: dialectic.critical_thinking_score, color: 'text-dojo-400' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="w-6 h-6 text-dojo-400" />
        <h2 className="text-xl font-bold text-white">Dialectic Debrief</h2>
      </div>

      <div className="glass-panel rounded-xl p-4">
        <p className="text-xs text-white/30 mb-1">Proposition</p>
        <p className="text-sm text-white">{dialectic.proposition}</p>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-4 gap-3">
        {scores.map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{Math.round(s.value * 100)}%</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Logical fallacies */}
      {dialectic.logical_fallacies_detected.length > 0 && (
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Logical Fallacies Detected</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {dialectic.logical_fallacies_detected.map((f, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Synthesis */}
      {dialectic.synthesis_quality && (
        <div className="glass-panel rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Synthesis Assessment</h3>
          <p className="text-sm text-white/60 leading-relaxed">{dialectic.synthesis_quality}</p>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={onReset}
          className="px-6 py-2.5 rounded-lg bg-dojo-600 hover:bg-dojo-500 text-white text-sm font-medium transition-colors"
        >
          New Dialectic
        </button>
      </div>
    </div>
  );
}
