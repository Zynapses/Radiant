'use client';

/**
 * ModelScoreBars - Real-time model score visualization
 * 
 * Shows animated score bars for each model prediction,
 * updating in real-time as user answers questions.
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Crown, Sparkles } from 'lucide-react';

interface ModelScore {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;
  previousScore?: number;
  isLeading: boolean;
  reasons: string[];
}

interface ModelScoreBarsProps {
  scores: ModelScore[];
  maxVisible?: number;
  className?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'from-orange-500 to-amber-500',
  openai: 'from-green-500 to-emerald-500',
  google: 'from-blue-500 to-cyan-500',
  meta: 'from-purple-500 to-violet-500',
  mistral: 'from-red-500 to-rose-500',
  default: 'from-indigo-500 to-purple-500',
};

export function ModelScoreBars({
  scores,
  maxVisible = 5,
  className,
}: ModelScoreBarsProps) {
  const visibleScores = scores.slice(0, maxVisible);

  return (
    <div className={cn('space-y-3', className)}>
      {visibleScores.map((model, index) => {
        const colorClass = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.default;
        const scoreChange = model.previousScore !== undefined
          ? model.score - model.previousScore
          : 0;

        return (
          <motion.div
            key={model.modelId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group"
          >
            {/* Model Info */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {model.isLeading && (
                  <Crown className="w-4 h-4 text-amber-400" />
                )}
                <span className={cn(
                  'text-sm font-medium',
                  model.isLeading ? 'text-white' : 'text-white/70'
                )}>
                  {model.modelName}
                </span>
                <span className="text-xs text-white/40">{model.provider}</span>
              </div>
              <div className="flex items-center gap-2">
                {scoreChange !== 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      'text-xs font-medium',
                      scoreChange > 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {scoreChange > 0 ? '+' : ''}{scoreChange}%
                  </motion.span>
                )}
                <span className={cn(
                  'text-sm font-semibold',
                  model.isLeading ? 'text-indigo-300' : 'text-white/60'
                )}>
                  {model.score}%
                </span>
              </div>
            </div>

            {/* Score Bar */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', colorClass)}
                initial={{ width: `${model.previousScore || 0}%` }}
                animate={{ width: `${model.score}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              
              {/* Shimmer effect for leading model */}
              {model.isLeading && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                />
              )}
            </div>

            {/* Reasons (shown on hover) */}
            {model.reasons.length > 0 && (
              <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-wrap gap-1">
                  {model.reasons.slice(0, 2).map((reason, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/50"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* More models indicator */}
      {scores.length > maxVisible && (
        <div className="flex items-center gap-2 text-xs text-white/40 pt-1">
          <Sparkles className="w-3 h-3" />
          <span>+{scores.length - maxVisible} more models considered</span>
        </div>
      )}
    </div>
  );
}
