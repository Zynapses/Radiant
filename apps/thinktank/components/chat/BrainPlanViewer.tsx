'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Zap, Check, Loader2, AlertCircle, 
  ChevronDown, ChevronUp, Clock, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BrainPlan, BrainPlanStep } from '@/lib/api/types';

interface BrainPlanViewerProps {
  plan: BrainPlan | null;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const MODE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  thinking: { icon: '🤔', label: 'Thinking', color: 'bg-blue-500/20 text-blue-400' },
  extended_thinking: { icon: '🧠', label: 'Deep Reasoning', color: 'bg-purple-500/20 text-purple-400' },
  coding: { icon: '💻', label: 'Coding', color: 'bg-green-500/20 text-green-400' },
  creative: { icon: '🎨', label: 'Creative', color: 'bg-pink-500/20 text-pink-400' },
  research: { icon: '🔬', label: 'Research', color: 'bg-cyan-500/20 text-cyan-400' },
  analysis: { icon: '📊', label: 'Analysis', color: 'bg-orange-500/20 text-orange-400' },
  multi_model: { icon: '🤝', label: 'Multi-Model', color: 'bg-violet-500/20 text-violet-400' },
  chain_of_thought: { icon: '🔗', label: 'Chain of Thought', color: 'bg-amber-500/20 text-amber-400' },
  self_consistency: { icon: '✓✓', label: 'Self-Consistency', color: 'bg-emerald-500/20 text-emerald-400' },
};

const STEP_ICONS: Record<string, string> = {
  analyze: '🔍',
  detect_domain: '🎯',
  select_model: '🤖',
  prepare_context: '📋',
  ethics_check: '⚖️',
  generate: '✨',
  synthesize: '🔄',
  verify: '✅',
  refine: '🔧',
  calibrate: '📐',
  reflect: '💭',
};

export function BrainPlanViewer({ plan, isExpanded = false, onToggle }: BrainPlanViewerProps) {
  if (!plan) return null;

  const modeConfig = MODE_CONFIG[plan.mode] || MODE_CONFIG.thinking;
  const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / plan.steps.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4"
    >
      <Card className="bg-slate-900/50 border-slate-700/50 overflow-hidden">
        <CardHeader className="pb-2 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Brain className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium text-white">
                  Brain Plan
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn('text-xs', modeConfig.color)}>
                    {modeConfig.icon} {modeConfig.label}
                  </Badge>
                  {plan.domain && (
                    <Badge variant="outline" className="text-xs">
                      {plan.domain.domain}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{Math.round(plan.estimatedTimeMs / 1000)}s
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${plan.estimatedCost.toFixed(4)}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {plan.steps.map((step, index) => (
                    <StepItem key={step.id} step={step} index={index} />
                  ))}
                </div>

                {plan.selectedModel && (
                  <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">Selected Model</div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-violet-400" />
                      <span className="text-sm font-medium text-white">{plan.selectedModel}</span>
                    </div>
                    {plan.modelReason && (
                      <p className="text-xs text-slate-500 mt-1">{plan.modelReason}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function StepItem({ step, index }: { step: BrainPlanStep; index: number }) {
  const icon = STEP_ICONS[step.type] || '📌';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg',
        step.status === 'completed' && 'bg-green-500/10',
        step.status === 'running' && 'bg-violet-500/10',
        step.status === 'failed' && 'bg-red-500/10'
      )}
    >
      <div className="w-6 text-center">{icon}</div>
      <div className="flex-1">
        <div className="text-sm text-white">{step.description}</div>
      </div>
      <div className="w-6 flex justify-center">
        {step.status === 'completed' && (
          <Check className="h-4 w-4 text-green-400" />
        )}
        {step.status === 'running' && (
          <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
        )}
        {step.status === 'failed' && (
          <AlertCircle className="h-4 w-4 text-red-400" />
        )}
        {step.status === 'pending' && (
          <div className="h-2 w-2 rounded-full bg-slate-600" />
        )}
      </div>
    </motion.div>
  );
}
