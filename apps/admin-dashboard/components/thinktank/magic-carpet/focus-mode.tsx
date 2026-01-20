'use client';

/**
 * Focus Mode
 * 
 * Actively manages user attention by dimming non-essential UI elements,
 * implementing progressive disclosure, and creating a distraction-free
 * environment for deep work.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Focus,
  X,
  Moon,
  Volume2,
  VolumeX,
  Clock,
  Target,
  Sparkles,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
interface FocusModeProps {
  isActive: boolean;
  onToggle: () => void;
  focusIntensity?: number; // 0-100
  onIntensityChange?: (intensity: number) => void;
  showTimer?: boolean;
  timerMinutes?: number;
  onTimerEnd?: () => void;
  soundEnabled?: boolean;
  onSoundToggle?: () => void;
  className?: string;
}

interface FocusOverlayProps {
  intensity: number;
  children: React.ReactNode;
  focusedElementId?: string;
  className?: string;
}

/**
 * Focus Mode Controls - Toggle and configure focus mode
 */
export function FocusModeControls({
  isActive,
  onToggle,
  focusIntensity = 70,
  onIntensityChange,
  showTimer = false,
  timerMinutes = 25,
  onTimerEnd,
  soundEnabled = true,
  onSoundToggle,
  className,
}: FocusModeProps) {
  const [timeRemaining, setTimeRemaining] = useState(timerMinutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Timer logic
  useEffect(() => {
    if (!isActive || !showTimer || !isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          onTimerEnd?.();
          return timerMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, showTimer, isTimerRunning, timerMinutes, onTimerEnd]);

  // Reset timer when focus mode is deactivated
  useEffect(() => {
    if (!isActive) {
      setTimeRemaining(timerMinutes * 60);
      setIsTimerRunning(false);
    }
  }, [isActive, timerMinutes]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          'inline-flex items-center gap-2 p-2 rounded-full',
          'bg-background/80 backdrop-blur-sm border',
          isActive && 'border-purple-500/50 bg-purple-500/10',
          !isActive && 'border-border/50',
          className
        )}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'gap-2',
                isActive && 'bg-purple-600 hover:bg-purple-700'
              )}
              onClick={onToggle}
            >
              {isActive ? (
                <Eye className="h-4 w-4" />
              ) : (
                <Focus className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isActive ? 'Exit Focus' : 'Focus Mode'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isActive ? 'Exit focus mode' : 'Enter focus mode for distraction-free work'}
          </TooltipContent>
        </Tooltip>

        {/* Active State Controls */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              className="flex items-center gap-3 pl-2 border-l border-purple-500/30"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
            >
              {/* Intensity Slider */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 w-24">
                    <Moon className="h-3.5 w-3.5 text-purple-400" />
                    <Slider
                      value={[focusIntensity]}
                      onValueChange={([v]) => onIntensityChange?.(v)}
                      max={100}
                      step={10}
                      className="w-16"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Focus intensity: {focusIntensity}%
                </TooltipContent>
              </Tooltip>

              {/* Timer */}
              {showTimer && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                  >
                    <Clock className={cn(
                      'h-3.5 w-3.5',
                      isTimerRunning && 'text-purple-400'
                    )} />
                  </Button>
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatTime(timeRemaining)}
                  </Badge>
                </div>
              )}

              {/* Sound Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSoundToggle}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}

/**
 * Focus Overlay - Applies dimming effect to non-focused elements
 */
export function FocusOverlay({
  intensity,
  children,
  focusedElementId,
  className,
}: FocusOverlayProps) {
  const dimOpacity = (intensity / 100) * 0.8; // Max 80% dim

  return (
    <div className={cn('relative', className)}>
      {children}
      
      {/* Overlay that dims everything except focused element */}
      <AnimatePresence>
        {intensity > 0 && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: `radial-gradient(ellipse at center, transparent 20%, rgba(0, 0, 0, ${dimOpacity}) 70%)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Focusable - Wrapper that keeps elements visible during focus mode
 */
interface FocusableProps {
  children: React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
  className?: string;
}

export function Focusable({
  children,
  priority = 'medium',
  className,
}: FocusableProps) {
  const zIndex = {
    high: 'z-50',
    medium: 'z-45',
    low: 'z-42',
  }[priority];

  return (
    <div className={cn('relative', zIndex, className)}>
      {children}
    </div>
  );
}

/**
 * Focus Session Summary - Shows stats after focus session ends
 */
interface FocusSessionSummaryProps {
  duration: number; // seconds
  tasksCompleted: number;
  aiInteractions: number;
  onClose: () => void;
  className?: string;
}

export function FocusSessionSummary({
  duration,
  tasksCompleted,
  aiInteractions,
  onClose,
  className,
}: FocusSessionSummaryProps) {
  const minutes = Math.round(duration / 60);

  return (
    <motion.div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-md',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-background border rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10">
            <Sparkles className="h-8 w-8 text-purple-500" />
          </div>

          <div>
            <h2 className="text-2xl font-bold">Focus Session Complete</h2>
            <p className="text-muted-foreground mt-1">
              Great work staying focused!
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{minutes}</p>
              <p className="text-sm text-muted-foreground">Minutes</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{tasksCompleted}</p>
              <p className="text-sm text-muted-foreground">Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{aiInteractions}</p>
              <p className="text-sm text-muted-foreground">AI Assists</p>
            </div>
          </div>

          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
