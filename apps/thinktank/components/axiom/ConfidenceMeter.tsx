'use client';

/**
 * ConfidenceMeter - Optimization Progress Indicator
 * 
 * Shows overall confidence level with animated progress bar.
 * Changes color based on confidence threshold:
 * - Green: >= 85% (ready to compile)
 * - Yellow: >= 70% (getting close)
 * - Orange: < 70% (needs more clarification)
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface ConfidenceMeterProps {
  confidence: number;
  threshold?: number;
  showLabel?: boolean;
  showStatus?: boolean;
  compact?: boolean;
  animated?: boolean;
  className?: string;
}

function getConfidenceGradient(confidence: number, threshold: number): string {
  if (confidence >= threshold) return 'from-green-500 to-emerald-400';
  if (confidence >= threshold - 0.15) return 'from-yellow-500 to-amber-400';
  return 'from-orange-500 to-red-400';
}

function getStatusText(confidence: number, threshold: number): string {
  if (confidence >= threshold) return 'Ready to optimize';
  if (confidence >= threshold - 0.15) return 'Almost there';
  return 'Gathering context';
}

function getStatusIcon(confidence: number, threshold: number) {
  if (confidence >= threshold) return CheckCircle2;
  if (confidence >= threshold - 0.15) return Sparkles;
  return AlertCircle;
}

export function ConfidenceMeter({
  confidence,
  threshold = 0.85,
  showLabel = true,
  showStatus = true,
  compact = false,
  animated = true,
  className,
}: ConfidenceMeterProps) {
  const percent = Math.round(confidence * 100);
  const isReady = confidence >= threshold;
  const StatusIcon = getStatusIcon(confidence, threshold);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full bg-gradient-to-r',
              getConfidenceGradient(confidence, threshold)
            )}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <motion.span
          key={percent}
          initial={animated ? { opacity: 0, scale: 0.8 } : false}
          animate={{ opacity: 1, scale: 1 }}
          className="text-xs font-medium tabular-nums w-8 text-right"
        >
          {percent}%
        </motion.span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        {showLabel && (
          <span className="text-xs font-medium text-muted-foreground">
            Optimization Confidence
          </span>
        )}
        <motion.div
          key={percent}
          initial={animated ? { opacity: 0, y: -5 } : false}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5"
        >
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            isReady ? 'text-green-400' : 'text-white'
          )}>
            {percent}%
          </span>
        </motion.div>
      </div>

      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
            getConfidenceGradient(confidence, threshold)
          )}
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        
        {/* Threshold marker */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-white/30"
          style={{ left: `${threshold * 100}%` }}
        />
        
        {/* Animated shine effect when ready */}
        {isReady && animated && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
          />
        )}
      </div>

      {showStatus && (
        <motion.div
          key={getStatusText(confidence, threshold)}
          initial={animated ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5"
        >
          <StatusIcon className={cn(
            'h-3.5 w-3.5',
            isReady ? 'text-green-400' : 
            confidence >= threshold - 0.15 ? 'text-yellow-400' : 'text-orange-400'
          )} />
          <span className="text-xs text-muted-foreground">
            {getStatusText(confidence, threshold)}
          </span>
        </motion.div>
      )}
    </div>
  );
}

export default ConfidenceMeter;
