'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  BookOpen,
  Swords,
  Play,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Clock,
  Zap,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  startSession,
  requestNextLesson,
  fetchSparringQuestion,
  submitSparringAnswer,
  completeSession,
  type LessonBlock,
  type SparringQuestion,
  type SparringResult,
  type SourceCitation,
} from '@/lib/api';
import { ArchytasToolPanel } from '@/components/ArchytasToolPanel';
import { cn } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

type ArenaMode = 'idle' | 'lecture' | 'sparring' | 'results';

export function TrainingArena() {
  const {
    tenantId,
    activeLibrary,
    selectedThemes,
    activeSession,
    setActiveSession,
    lessonBlocks,
    addLessonBlock,
    clearLessonBlocks,
    currentQuestion,
    setCurrentQuestion,
    sparringResults,
    addSparringResult,
    clearSparring,
  } = useDojoStore();
  const delight = useRadiantDelightOptional();

  const [mode, setMode] = useState<ArenaMode>('idle');
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerStartTime, setAnswerStartTime] = useState(0);
  const [lastResult, setLastResult] = useState<SparringResult | null>(null);

  // Start a new session
  const startMutation = useMutation({
    mutationFn: (sessionMode: 'lecture' | 'sparring') =>
      startSession(tenantId, {
        library_id: activeLibrary!.id,
        theme_ids: selectedThemes.map((t) => t.id),
        mode: sessionMode,
      }),
    onSuccess: (data, sessionMode) => {
      setActiveSession(data.session);
      clearLessonBlocks();
      clearSparring();
      setMode(sessionMode);
      delight?.triggerDelight('session_start');
      if (sessionMode === 'lecture') {
        lessonMutation.mutate();
      } else {
        sparMutation.mutate();
      }
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  // Fetch next lesson block
  const lessonMutation = useMutation({
    mutationFn: () => requestNextLesson(activeSession!.id),
    onSuccess: (data) => {
      addLessonBlock(data.block);
    },
  });

  // Fetch sparring question
  const sparMutation = useMutation({
    mutationFn: () => fetchSparringQuestion(activeSession!.id),
    onSuccess: (data) => {
      setCurrentQuestion(data.question);
      setUserAnswer('');
      setSelectedOption(null);
      setAnswerStartTime(Date.now());
      setLastResult(null);
    },
  });

  // Submit answer
  const answerMutation = useMutation({
    mutationFn: () => {
      const answer = currentQuestion?.question_type === 'multiple_choice'
        ? (currentQuestion.options?.[selectedOption ?? 0] || '')
        : userAnswer;
      return submitSparringAnswer(activeSession!.id, {
        question_id: currentQuestion!.id,
        answer,
        time_taken_seconds: Math.round((Date.now() - answerStartTime) / 1000),
      });
    },
    onSuccess: (data) => {
      addSparringResult(data.result);
      setLastResult(data.result);
      delight?.triggerDelight(data.result.correct ? 'action_complete' : 'error_recovery');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  // Complete session
  const completeMutation = useMutation({
    mutationFn: () => completeSession(activeSession!.id),
    onSuccess: (data) => {
      setActiveSession(data.session);
      setMode('results');
      delight?.triggerDelight('milestone');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const handleStartSession = useCallback(
    (sessionMode: 'lecture' | 'sparring') => {
      startMutation.mutate(sessionMode);
    },
    [startMutation]
  );

  // No themes selected
  if (selectedThemes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Swords className="w-12 h-12 text-white/10 mb-4" />
        <h3 className="text-lg font-medium text-white/40">Select Themes to Begin</h3>
        <p className="text-sm text-white/25 mt-1">
          Go to the Themes tab and select 1–3 central themes for your training session
        </p>
      </div>
    );
  }

  // IDLE — choose mode
  if (mode === 'idle') {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Training Arena</h1>
          <p className="text-sm text-white/40">
            Focused on: {selectedThemes.map((t) => t.name).join(', ')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lecture Mode */}
          <button
            onClick={() => handleStartSession('lecture')}
            disabled={startMutation.isPending}
            className="group p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-omega-500/5 hover:border-omega-500/20 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-omega-500/10 flex items-center justify-center mb-4 group-hover:bg-omega-500/20 transition-colors">
              <BookOpen className="w-6 h-6 text-omega-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Lecture Mode</h3>
            <p className="text-sm text-white/40 mb-4">
              The Sensei presents synthesized lessons from the library, grounded in citations.
              Learn at your own pace with structured content blocks.
            </p>
            <span className="flex items-center gap-1.5 text-xs text-omega-400 font-medium">
              Begin Lecture <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* Sparring Mode */}
          <button
            onClick={() => handleStartSession('sparring')}
            disabled={startMutation.isPending}
            className="group p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-dojo-500/5 hover:border-dojo-500/20 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-dojo-500/10 flex items-center justify-center mb-4 group-hover:bg-dojo-500/20 transition-colors">
              <Swords className="w-6 h-6 text-dojo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Sparring Mode</h3>
            <p className="text-sm text-white/40 mb-4">
              The adversarial testing agent challenges you with scenario-based questions.
              Exposes weaknesses and awards XP for correct reasoning.
            </p>
            <span className="flex items-center gap-1.5 text-xs text-dojo-400 font-medium">
              Enter the Ring <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>

        {startMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing session...
          </div>
        )}
      </div>
    );
  }

  // LECTURE MODE
  if (mode === 'lecture') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Lecture Mode</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 font-mono">{lessonBlocks.length} blocks</span>
            <button
              onClick={() => completeMutation.mutate()}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20 transition-all"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Archytas Tool Panel */}
        {activeSession && <ArchytasToolPanel sessionId={activeSession.id} />}

        {/* Lesson Blocks */}
        <div className="space-y-4">
          {lessonBlocks.map((block) => (
            <LessonBlockCard key={block.id} block={block} />
          ))}
        </div>

        {/* Load More */}
        <div className="flex justify-center">
          <button
            onClick={() => lessonMutation.mutate()}
            disabled={lessonMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-omega-600/20 border border-omega-500/30 text-omega-300 text-sm font-medium hover:bg-omega-600/30 disabled:opacity-40 transition-all"
          >
            {lessonMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Next Lesson
          </button>
        </div>
      </div>
    );
  }

  // SPARRING MODE
  if (mode === 'sparring') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-dojo-400" />
            Sparring
          </h2>
          {activeSession && <ArchytasToolPanel sessionId={activeSession.id} />}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30 font-mono">
              {sparringResults.filter((r) => r.correct).length}/{sparringResults.length} correct
            </span>
            <button
              onClick={() => completeMutation.mutate()}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20 transition-all"
            >
              End Sparring
            </button>
          </div>
        </div>

        {/* Current Question */}
        {currentQuestion && !lastResult && (
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs text-dojo-400 font-mono uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              {currentQuestion.question_type.replace('_', ' ')}
              {currentQuestion.time_limit_seconds && (
                <span className="ml-auto flex items-center gap-1 text-white/30">
                  <Clock className="w-3 h-3" />
                  {currentQuestion.time_limit_seconds}s
                </span>
              )}
            </div>

            {currentQuestion.context && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/60 italic">
                {currentQuestion.context}
              </div>
            )}

            <p className="text-white text-base leading-relaxed">{currentQuestion.question}</p>

            {/* Multiple Choice Options */}
            {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(i)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all text-sm',
                      selectedOption === i
                        ? 'bg-dojo-500/10 border-dojo-500/40 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04] hover:border-white/10'
                    )}
                  >
                    <span className="font-mono text-xs text-white/30 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Open-ended / Scenario */}
            {(currentQuestion.question_type === 'open_ended' || currentQuestion.question_type === 'scenario') && (
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-dojo-500/50 focus:outline-none transition-colors resize-none"
              />
            )}

            {/* True/False */}
            {currentQuestion.question_type === 'true_false' && (
              <div className="flex gap-3">
                {['True', 'False'].map((opt, i) => (
                  <button
                    key={opt}
                    onClick={() => { setSelectedOption(i); setUserAnswer(opt); }}
                    className={cn(
                      'flex-1 p-3 rounded-lg border transition-all text-sm font-medium',
                      selectedOption === i
                        ? 'bg-dojo-500/10 border-dojo-500/40 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={() => answerMutation.mutate()}
              disabled={answerMutation.isPending || (!userAnswer && selectedOption === null)}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-dojo-600 to-dojo-700 hover:from-dojo-500 hover:to-dojo-600 text-white font-medium text-sm disabled:opacity-30 transition-all"
            >
              {answerMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Evaluating...
                </span>
              ) : (
                'Submit Answer'
              )}
            </button>
          </div>
        )}

        {/* Result Display */}
        {lastResult && (
          <div className={cn(
            'glass-panel rounded-xl p-6 space-y-4',
            lastResult.correct ? 'sparring-correct' : 'sparring-incorrect'
          )}>
            <div className="flex items-center gap-3">
              {lastResult.correct ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <p className={cn('font-semibold', lastResult.correct ? 'text-green-400' : 'text-red-400')}>
                  {lastResult.correct ? 'Correct!' : 'Incorrect'}
                  {lastResult.partial_credit > 0 && lastResult.partial_credit < 1 && (
                    <span className="text-yellow-400 text-sm ml-2">
                      ({Math.round(lastResult.partial_credit * 100)}% partial credit)
                    </span>
                  )}
                </p>
                <p className="text-xs text-dojo-400 font-mono">+{lastResult.xp_awarded} XP</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">Correct Answer</p>
              <p className="text-sm text-white">{lastResult.correct_answer}</p>
            </div>

            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">Explanation</p>
              <p className="text-sm text-white/70 leading-relaxed">{lastResult.explanation}</p>
            </div>

            {lastResult.reasoning_analysis && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-1">Reasoning Analysis</p>
                <p className="text-sm text-white/50 leading-relaxed italic">{lastResult.reasoning_analysis}</p>
              </div>
            )}

            {/* Citations */}
            {lastResult.source_citations.length > 0 && (
              <CitationList citations={lastResult.source_citations} />
            )}

            <button
              onClick={() => sparMutation.mutate()}
              disabled={sparMutation.isPending}
              className="w-full py-3 rounded-lg bg-dojo-600/20 border border-dojo-500/30 text-dojo-300 font-medium text-sm hover:bg-dojo-600/30 disabled:opacity-40 transition-all"
            >
              {sparMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading next...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Next Question
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // RESULTS
  if (mode === 'results') {
    const totalCorrect = sparringResults.filter((r) => r.correct).length;
    const totalXP = sparringResults.reduce((sum, r) => sum + r.xp_awarded, 0);
    const accuracy = sparringResults.length > 0 ? totalCorrect / sparringResults.length : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
          <p className="text-sm text-white/40">
            {selectedThemes.map((t) => t.name).join(', ')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-panel rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-green-400">{totalCorrect}/{sparringResults.length}</p>
            <p className="text-xs text-white/40 mt-1">Correct</p>
          </div>
          <div className="glass-panel rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-dojo-400">+{totalXP}</p>
            <p className="text-xs text-white/40 mt-1">XP Earned</p>
          </div>
          <div className="glass-panel rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-omega-400">{Math.round(accuracy * 100)}%</p>
            <p className="text-xs text-white/40 mt-1">Accuracy</p>
          </div>
        </div>

        {/* Return */}
        <button
          onClick={() => {
            setMode('idle');
            setActiveSession(null);
            clearLessonBlocks();
            clearSparring();
            setLastResult(null);
          }}
          className="w-full py-3 rounded-lg bg-dojo-600 hover:bg-dojo-500 text-white font-medium text-sm transition-colors"
        >
          Return to Arena
        </button>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function LessonBlockCard({ block }: { block: LessonBlock }) {
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div className="glass-panel rounded-xl p-6 card-reveal">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-base">{block.title}</h3>
        <span className="text-xs text-white/20 font-mono">#{block.sequence}</span>
      </div>
      <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap mb-4">
        {block.content}
      </div>
      {block.source_citations.length > 0 && (
        <div>
          <button
            onClick={() => setShowCitations(!showCitations)}
            className="flex items-center gap-1.5 text-xs text-omega-400 hover:text-omega-300 transition-colors"
          >
            <FileText className="w-3 h-3" />
            {block.source_citations.length} source{block.source_citations.length !== 1 ? 's' : ''}
          </button>
          {showCitations && (
            <div className="mt-3">
              <CitationList citations={block.source_citations} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CitationList({ citations }: { citations: SourceCitation[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Sources</p>
      {citations.map((c, i) => (
        <div
          key={`${c.chunk_id}-${i}`}
          className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-xs"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-3 h-3 text-omega-400 flex-shrink-0" />
            <span className="text-omega-300 font-medium truncate">{c.document_name}</span>
            {c.page && <span className="text-white/20">p.{c.page}</span>}
            <span className="ml-auto text-white/15 font-mono">{Math.round(c.relevance_score * 100)}%</span>
          </div>
          <p className="text-white/50 italic leading-relaxed">&ldquo;{c.excerpt}&rdquo;</p>
        </div>
      ))}
    </div>
  );
}
