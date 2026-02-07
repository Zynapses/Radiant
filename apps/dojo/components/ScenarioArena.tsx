'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Users,
  Loader2,
  Send,
  AlertOctagon,
  Shield,
  Heart,
  Target,
  MessageSquare,
  ChevronRight,
  Star,
  XCircle,
  CheckCircle2,
  HelpCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  startScenario,
  respondToScenario,
  concludeScenario,
  type ScenarioSession,
  type PersonaArchetype,
  type ScenarioBranch,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

const PERSONA_META: Record<PersonaArchetype, { label: string; icon: typeof Users; color: string; description: string }> = {
  confused_customer: { label: 'Confused Customer', icon: HelpCircle, color: 'text-blue-400', description: 'Needs patient guidance through complex processes' },
  angry_customer: { label: 'Angry Customer', icon: AlertOctagon, color: 'text-red-400', description: 'Escalated and demanding immediate resolution' },
  detail_oriented: { label: 'Detail-Oriented', icon: Target, color: 'text-purple-400', description: 'Asks precise questions, expects thorough answers' },
  time_pressured: { label: 'Time-Pressured', icon: Clock, color: 'text-orange-400', description: 'In a rush — wants fast, accurate answers' },
  price_sensitive: { label: 'Price-Sensitive', icon: DollarSign, color: 'text-green-400', description: 'Focused on cost, looking for deals and value' },
  vip_escalation: { label: 'VIP Escalation', icon: Star, color: 'text-dojo-400', description: 'High-value customer requiring premium handling' },
  compliance_auditor: { label: 'Compliance Auditor', icon: Shield, color: 'text-cyan-400', description: 'Testing adherence to policies and regulations' },
  new_employee: { label: 'New Employee', icon: Users, color: 'text-indigo-400', description: 'Fellow employee asking for process guidance' },
  hostile_negotiator: { label: 'Hostile Negotiator', icon: AlertOctagon, color: 'text-rose-400', description: 'Aggressive negotiation tactics, pushback on every point' },
};

const BRANCH_QUALITY_META: Record<string, { label: string; color: string }> = {
  optimal: { label: 'Optimal', color: 'text-green-400' },
  acceptable: { label: 'Acceptable', color: 'text-blue-400' },
  suboptimal: { label: 'Needs Work', color: 'text-yellow-400' },
  critical_error: { label: 'Critical Error', color: 'text-red-400' },
};

export function ScenarioArena() {
  const { activeSession, selectedThemes, activeScenario, setActiveScenario } = useDojoStore();
  const delight = useRadiantDelightOptional();
  const [response, setResponse] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const startMutation = useMutation({
    mutationFn: (archetype?: PersonaArchetype) =>
      startScenario(activeSession?.id || 'global', {
        theme_ids: selectedThemes.map((t) => t.id),
        archetype,
      }),
    onSuccess: (data) => { setActiveScenario(data.scenario); delight?.triggerDelight('session_start'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const respondMutation = useMutation({
    mutationFn: (text: string) => {
      if (!activeScenario) throw new Error('No scenario');
      return respondToScenario(activeScenario.id, text);
    },
    onSuccess: (data) => { setActiveScenario(data.scenario); delight?.triggerDelight('action_complete'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const concludeMutation = useMutation({
    mutationFn: () => {
      if (!activeScenario) throw new Error('No scenario');
      return concludeScenario(activeScenario.id);
    },
    onSuccess: (data) => { setActiveScenario(data.scenario); delight?.triggerDelight('milestone'); },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const handleSend = () => {
    const msg = response.trim();
    if (!msg || respondMutation.isPending) return;
    setResponse('');
    respondMutation.mutate(msg);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeScenario?.branches?.length]);

  // Scenario selection
  if (!activeScenario || activeScenario.status !== 'active') {
    if (activeScenario?.status === 'completed' || activeScenario?.status === 'failed') {
      return <ScenarioDebrief scenario={activeScenario} onReset={() => setActiveScenario(null)} />;
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-dojo-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Scenario Synthesis</h2>
            <p className="text-xs text-white/30">AI-generated multi-turn scenarios with digital twin personas</p>
          </div>
        </div>

        {selectedThemes.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white/40">Select Themes First</h3>
            <p className="text-sm text-white/25 mt-1">Go to the Themes tab and select 1-3 themes for scenario training</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-white/50">
              Choose a persona archetype. The AI will generate a realistic multi-turn scenario
              grounded in your library&apos;s policies and procedures.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(PERSONA_META) as [PersonaArchetype, typeof PERSONA_META[PersonaArchetype]][]).map(
                ([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => startMutation.mutate(key)}
                    disabled={startMutation.isPending}
                    className="glass-panel rounded-xl p-4 text-left hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <meta.icon className={cn('w-4 h-4', meta.color)} />
                      <span className="text-sm font-medium text-white">{meta.label}</span>
                    </div>
                    <p className="text-[11px] text-white/30 leading-relaxed">{meta.description}</p>
                  </button>
                )
              )}
            </div>

            <div className="text-center">
              <button
                onClick={() => startMutation.mutate(undefined)}
                disabled={startMutation.isPending}
                className="px-6 py-2.5 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white text-sm font-medium transition-colors"
              >
                {startMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating scenario...
                  </span>
                ) : (
                  'Random Scenario'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Active scenario conversation
  const persona = activeScenario.persona;
  const personaMeta = PERSONA_META[persona.archetype];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
      {/* Scenario header */}
      <div className="glass-panel rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-white/5')}>
              <personaMeta.icon className={cn('w-5 h-5', personaMeta.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{persona.name}</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full bg-white/5', personaMeta.color)}>
                  {personaMeta.label}
                </span>
              </div>
              <p className="text-[10px] text-white/30">{activeScenario.situation}</p>
            </div>
          </div>
          <button
            onClick={() => concludeMutation.mutate()}
            disabled={concludeMutation.isPending}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            End Scenario
          </button>
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <p className="text-[10px] text-dojo-400/70">
            <strong>Objective:</strong> {activeScenario.objective}
          </p>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
        {activeScenario.branches.map((branch) => (
          <div key={branch.id}>
            {/* Persona message */}
            <div className="max-w-[85%] mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <personaMeta.icon className={cn('w-3 h-3', personaMeta.color)} />
                <span className="text-[10px] text-white/20">{persona.name}</span>
                {branch.emotional_shift && (
                  <span className="text-[10px] text-dojo-400/50 italic">({branch.emotional_shift})</span>
                )}
              </div>
              <div className="mobot-bubble p-3">
                <p className="text-sm text-white/80 leading-relaxed">{branch.persona_message}</p>
              </div>
            </div>

            {/* Learner response */}
            {branch.learner_response && (
              <div className="max-w-[85%] ml-auto mb-2">
                <div className="user-bubble p-3">
                  <p className="text-sm text-white/80 leading-relaxed">{branch.learner_response}</p>
                </div>
                {branch.branch_quality && (
                  <div className="flex justify-end mt-1">
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full bg-white/5',
                      BRANCH_QUALITY_META[branch.branch_quality]?.color || 'text-white/30'
                    )}>
                      {BRANCH_QUALITY_META[branch.branch_quality]?.label || branch.branch_quality}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {respondMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-dojo-400/60">
            <Loader2 className="w-3 h-3 animate-spin" />
            {persona.name} is responding...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          placeholder="Your response to the scenario..."
          className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:border-dojo-500/40 focus:outline-none resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!response.trim() || respondMutation.isPending}
          className="p-3 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ScenarioDebrief({ scenario, onReset }: { scenario: ScenarioSession; onReset: () => void }) {
  const scores = [
    { label: 'Emotional Intelligence', value: scenario.emotional_intelligence_score, icon: Heart, color: 'text-pink-400' },
    { label: 'Policy Adherence', value: scenario.policy_adherence_score, icon: Shield, color: 'text-cyan-400' },
    { label: 'Resolution', value: scenario.resolution_score, icon: Target, color: 'text-green-400' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-dojo-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Scenario Debrief</h2>
          <p className="text-xs text-white/30">
            {scenario.persona.name} — {PERSONA_META[scenario.persona.archetype]?.label}
          </p>
        </div>
      </div>

      {/* Overall score */}
      <div className="glass-panel rounded-2xl p-6 text-center">
        <div className="text-5xl font-bold text-white mb-2">{Math.round(scenario.total_score)}%</div>
        <p className="text-sm text-white/40">Overall Performance</p>
        <div className={cn(
          'inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium',
          scenario.status === 'completed'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-red-500/10 text-red-400'
        )}>
          {scenario.status === 'completed' ? 'Scenario Resolved' : 'Scenario Failed'}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {scores.map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
            <s.icon className={cn('w-5 h-5 mx-auto mb-2', s.color)} />
            <p className="text-2xl font-bold text-white">{Math.round(s.value)}%</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Debrief */}
      {scenario.debrief && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">AI Analysis</h3>
          <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{scenario.debrief}</p>
        </div>
      )}

      {/* Branch quality timeline */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Response Timeline</h3>
        <div className="space-y-1">
          {scenario.branches.filter((b) => b.learner_response).map((branch, i) => {
            const qualityMeta = BRANCH_QUALITY_META[branch.branch_quality] || { label: '?', color: 'text-white/30' };
            return (
              <div key={branch.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02]">
                <span className="text-[10px] text-white/20 w-6">#{i + 1}</span>
                <span className="text-xs text-white/50 flex-1 truncate">{branch.learner_response}</span>
                {branch.branch_quality === 'optimal' || branch.branch_quality === 'acceptable' ? (
                  <CheckCircle2 className={cn('w-3.5 h-3.5', qualityMeta.color)} />
                ) : (
                  <XCircle className={cn('w-3.5 h-3.5', qualityMeta.color)} />
                )}
                <span className={cn('text-[10px] font-medium w-20 text-right', qualityMeta.color)}>
                  {qualityMeta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onReset}
          className="px-6 py-2.5 rounded-lg bg-dojo-600 hover:bg-dojo-500 text-white text-sm font-medium transition-colors"
        >
          New Scenario
        </button>
      </div>
    </div>
  );
}
