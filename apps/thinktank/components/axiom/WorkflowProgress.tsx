'use client';

/**
 * WorkflowProgress - Animated workflow steps visualization
 * 
 * Shows the 4-step AXIOM workflow: Classify → Clarify → Compile → Route
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Target, MessageSquare, Wand2, Router, Check } from 'lucide-react';

type WorkflowStep = 'classify' | 'clarify' | 'compile' | 'route';
type StepStatus = 'pending' | 'active' | 'completed';

interface StepInfo {
  step: WorkflowStep;
  label: string;
  status: StepStatus;
  duration?: number;
}

interface WorkflowProgressProps {
  currentStep: WorkflowStep;
  steps: StepInfo[];
  progress: number;
  className?: string;
}

const STEP_ICONS: Record<WorkflowStep, React.ElementType> = {
  classify: Target,
  clarify: MessageSquare,
  compile: Wand2,
  route: Router,
};

const STEP_COLORS: Record<StepStatus, string> = {
  pending: 'text-white/30 bg-white/5 border-white/10',
  active: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/40',
  completed: 'text-green-400 bg-green-500/20 border-green-500/40',
};

export function WorkflowProgress({
  currentStep: _currentStep,
  steps,
  progress,
  className,
}: WorkflowProgressProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress Bar */}
      <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.step];
          const isActive = step.status === 'active';
          const isCompleted = step.status === 'completed';

          return (
            <React.Fragment key={step.step}>
              {/* Step */}
              <motion.div
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={cn(
                    'relative w-10 h-10 rounded-xl border flex items-center justify-center',
                    'transition-all duration-300',
                    STEP_COLORS[step.status]
                  )}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}

                  {/* Active Pulse */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border-2 border-indigo-400"
                      initial={{ opacity: 1, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.2 }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>

                <span
                  className={cn(
                    'text-xs font-medium transition-colors',
                    isActive ? 'text-indigo-300' : isCompleted ? 'text-green-300' : 'text-white/40'
                  )}
                >
                  {step.label}
                </span>
              </motion.div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 relative">
                  <div className="absolute inset-0 bg-white/10 rounded-full" />
                  {(isCompleted || isActive) && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: isCompleted ? '100%' : '50%' }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
