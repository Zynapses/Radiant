'use client';

/**
 * ErrorStates - Error UI Components for CLARION
 * 
 * Provides error state displays for:
 * - Network errors (connection lost)
 * - Timeout errors (taking too long)
 * - Validation errors (invalid input)
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  WifiOff,
  Clock,
  AlertTriangle,
  RefreshCw,
  SkipForward,
  Loader2,
} from 'lucide-react';

// =============================================================================
// Network Error
// =============================================================================

interface NetworkErrorProps {
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function NetworkError({ onRetry, isRetrying, className }: NetworkErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-red-500/10 border border-red-500/20 rounded-lg p-4',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-500/20 rounded-lg">
          <WifiOff className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-red-300">Connection lost</h4>
          <p className="text-sm text-red-400/80 mt-0.5">
            We&apos;re having trouble connecting. Your progress is saved.
          </p>
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className={cn(
          'mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          'bg-red-500/20 hover:bg-red-500/30 text-red-300',
          isRetrying && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isRetrying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isRetrying ? 'Retrying...' : 'Try again'}
      </button>
    </motion.div>
  );
}

// =============================================================================
// Timeout Error
// =============================================================================

interface TimeoutErrorProps {
  onContinueWaiting: () => void;
  onSkip: () => void;
  isWaiting?: boolean;
  className?: string;
}

export function TimeoutError({
  onContinueWaiting,
  onSkip,
  isWaiting,
  className,
}: TimeoutErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-yellow-500/20 rounded-lg">
          <Clock className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-yellow-300">Taking longer than expected</h4>
          <p className="text-sm text-yellow-400/80 mt-0.5">
            The system is processing your request. You can wait or skip ahead.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onContinueWaiting}
          disabled={isWaiting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300',
            isWaiting && 'opacity-50'
          )}
        >
          {isWaiting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {isWaiting ? 'Waiting...' : 'Keep waiting'}
        </button>
        <button
          onClick={onSkip}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white/5 hover:bg-white/10 text-white/70"
        >
          <SkipForward className="h-4 w-4" />
          Skip to results
        </button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Validation Error
// =============================================================================

interface ValidationErrorProps {
  message: string;
  className?: string;
}

export function ValidationError({ message, className }: ValidationErrorProps) {
  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('text-sm text-orange-400 mt-1 flex items-center gap-1.5', className)}
    >
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      {message}
    </motion.p>
  );
}

// =============================================================================
// Generic Error Banner
// =============================================================================

interface ErrorBannerProps {
  title: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
  variant?: 'error' | 'warning';
  className?: string;
}

export function ErrorBanner({
  title,
  message,
  onRetry,
  onDismiss,
  isRetrying,
  variant = 'error',
  className,
}: ErrorBannerProps) {
  const colors = variant === 'error' 
    ? {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: 'bg-red-500/20 text-red-400',
        title: 'text-red-300',
        message: 'text-red-400/80',
        button: 'bg-red-500/20 hover:bg-red-500/30 text-red-300',
      }
    : {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: 'bg-yellow-500/20 text-yellow-400',
        title: 'text-yellow-300',
        message: 'text-yellow-400/80',
        button: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300',
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(colors.bg, 'border', colors.border, 'rounded-lg p-4', className)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg', colors.icon)}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn('font-medium', colors.title)}>{title}</h4>
          <p className={cn('text-sm mt-0.5', colors.message)}>{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            ×
          </button>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className={cn(
            'mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            colors.button,
            isRetrying && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isRetrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isRetrying ? 'Retrying...' : 'Try again'}
        </button>
      )}
    </motion.div>
  );
}

const ErrorStates = {
  NetworkError,
  TimeoutError,
  ValidationError,
  ErrorBanner,
};

export default ErrorStates;
