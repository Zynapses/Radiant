'use client';

/**
 * Modern Typing Indicator
 * 
 * Animated dots with wave effect for AI thinking state.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  className?: string;
  variant?: 'dots' | 'pulse' | 'wave' | 'thinking';
}

export function TypingIndicator({ className, variant = 'dots' }: TypingIndicatorProps) {
  if (variant === 'thinking') {
    return <ThinkingIndicator className={className} />;
  }
  
  if (variant === 'pulse') {
    return <PulseIndicator className={className} />;
  }
  
  if (variant === 'wave') {
    return <WaveIndicator className={className} />;
  }
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-violet-400"
          animate={{
            y: [0, -6, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function PulseIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <motion.div
        className="w-2 h-2 rounded-full bg-violet-400"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <span className="text-sm text-slate-400">Thinking...</span>
    </div>
  );
}

function WaveIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-gradient-to-t from-violet-500 to-fuchsia-400 rounded-full"
          animate={{
            height: [8, 20, 8],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn(
      'inline-flex items-center gap-3 px-4 py-2 rounded-2xl',
      'bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10',
      'border border-violet-500/20',
      className
    )}>
      <motion.div
        className="relative w-5 h-5"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/30" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400" />
      </motion.div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">Cato is thinking</span>
        <motion.span
          className="text-xs text-slate-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Analyzing your request...
        </motion.span>
      </div>
    </div>
  );
}

/**
 * Streaming text indicator
 */
export function StreamingIndicator({ className }: { className?: string }) {
  return (
    <motion.span
      className={cn('inline-block w-2 h-4 bg-violet-400 rounded-sm', className)}
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
  );
}
