'use client';

/**
 * AxiomForge - Main AXIOM/CLARION Interface Component
 * 
 * Orchestrates the 4-step prompt optimization workflow:
 * 1. Classify - Domain detection
 * 2. Clarify - Adaptive questioning via CLARION
 * 3. Compile - Prompt compilation
 * 4. Route - Model selection
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAxiomSession } from '@/lib/hooks/useAxiomSession';
import { WorkflowProgress } from './WorkflowProgress';
import { ClarificationCard } from './ClarificationCard';
import { ModelScoreBars } from './ModelScoreBars';
import { CompiledPromptPreview } from './CompiledPromptPreview';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface AxiomForgeProps {
  query: string;
  onCompiled?: (result: {
    prompt: { systemPrompt: string; userPrompt: string };
    model: { modelId: string; modelName: string };
  }) => void;
  onCancel?: () => void;
  className?: string;
}

export function AxiomForge({ query, onCompiled, onCancel, className }: AxiomForgeProps) {
  const {
    sessionId,
    status,
    workflow,
    domain,
    currentQuestion,
    answeredCount,
    modelScores,
    compiledPrompt,
    isLoading,
    error,
    startSession,
    submitAnswer,
    skipQuestion,
    compile,
  } = useAxiomSession();

  // Start session when query changes
  useEffect(() => {
    if (query && !sessionId) {
      startSession(query);
    }
  }, [query, sessionId, startSession]);

  // Notify parent when compilation is complete
  useEffect(() => {
    if (compiledPrompt && onCompiled) {
      onCompiled({
        prompt: {
          systemPrompt: compiledPrompt.systemPrompt,
          userPrompt: compiledPrompt.userPrompt,
        },
        model: {
          modelId: compiledPrompt.modelId,
          modelName: compiledPrompt.modelName,
        },
      });
    }
  }, [compiledPrompt, onCompiled]);

  if (error) {
    return (
      <div className={cn('rounded-xl bg-red-500/10 border border-red-500/20 p-6', className)}>
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error initializing AXIOM</span>
        </div>
        <p className="mt-2 text-sm text-red-300/80">{error}</p>
        <button
          onClick={() => startSession(query)}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading && !sessionId) {
    return (
      <div className={cn('rounded-xl bg-white/5 border border-white/10 p-8', className)}>
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-white/60">Analyzing your request...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl bg-gradient-to-b from-indigo-500/10 to-purple-500/5',
        'border border-indigo-500/20 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AXIOM Forge</h3>
              <p className="text-xs text-white/50">Optimizing your prompt</p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              Skip optimization
            </button>
          )}
        </div>
      </div>

      {/* Workflow Progress */}
      <div className="px-6 py-4 border-b border-white/5">
        <WorkflowProgress
          currentStep={workflow.currentStep}
          steps={workflow.steps}
          progress={workflow.overallProgress}
        />
      </div>

      {/* Main Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Domain Display */}
          {domain && (
            <motion.div
              key="domain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex items-center gap-3"
            >
              <span className="text-sm text-white/50">Domain:</span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium">
                {domain.name}
              </span>
              <span className="text-xs text-white/40">
                {Math.round(domain.confidence * 100)}% confidence
              </span>
            </motion.div>
          )}

          {/* CLARION Questions */}
          {status === 'active' && currentQuestion && (
            <motion.div
              key="question"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ClarificationCard
                question={currentQuestion}
                questionNumber={answeredCount + 1}
                totalQuestions={5}
                onAnswer={(answer) => submitAnswer(currentQuestion.questionId, answer)}
                onSkip={() => skipQuestion(currentQuestion.questionId)}
                isSubmitting={isLoading}
              />
            </motion.div>
          )}

          {/* Ready to Compile */}
          {status === 'ready_to_compile' && !compiledPrompt && (
            <motion.div
              key="compile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">
                Ready to compile your optimized prompt
              </h4>
              <p className="text-sm text-white/60 mb-6">
                We've gathered enough context. Click below to generate your optimized prompt.
              </p>
              <button
                onClick={() => compile()}
                disabled={isLoading}
                className={cn(
                  'px-6 py-3 rounded-xl font-medium',
                  'bg-gradient-to-r from-indigo-500 to-purple-500',
                  'hover:from-indigo-400 hover:to-purple-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-all duration-200'
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Compiling...
                  </span>
                ) : (
                  'Compile Optimized Prompt'
                )}
              </button>
            </motion.div>
          )}

          {/* Compiled Prompt Preview */}
          {compiledPrompt && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CompiledPromptPreview
                systemPrompt={compiledPrompt.systemPrompt}
                userPrompt={compiledPrompt.userPrompt}
                modelId={compiledPrompt.modelId}
                modelName={compiledPrompt.modelName}
                tokenCount={compiledPrompt.tokenCount}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Model Score Bars */}
        {modelScores.length > 0 && status !== 'completed' && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h4 className="text-sm font-medium text-white/70 mb-3">
              Model Predictions
            </h4>
            <ModelScoreBars scores={modelScores} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
