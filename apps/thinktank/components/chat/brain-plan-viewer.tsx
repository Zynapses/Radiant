'use client';

/**
 * Brain Plan Viewer Component for Think Tank Consumer App
 * Shows the AGI's plan to solve a prompt with steps and orchestration modes
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  CheckCircle, 
  Circle,
  Clock,
  Zap,
  Code,
  Lightbulb,
  Search,
  BarChart,
  Users,
  Link2,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrainPlanStep {
  id: string;
  type: 'analyze' | 'detect_domain' | 'select_model' | 'prepare_context' | 'ethics_check' | 'generate' | 'synthesize' | 'verify' | 'refine' | 'calibrate' | 'reflect';
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'skipped';
  estimatedMs?: number;
  actualMs?: number;
}

interface BrainPlan {
  id: string;
  prompt: string;
  mode: 'thinking' | 'extended_thinking' | 'coding' | 'creative' | 'research' | 'analysis' | 'multi_model' | 'chain_of_thought' | 'self_consistency';
  domain?: {
    field: string;
    domain: string;
    subspecialty?: string;
    confidence: number;
  };
  model: {
    id: string;
    name: string;
    reason: string;
  };
  steps: BrainPlanStep[];
  estimatedCost?: number;
  estimatedTimeMs?: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

interface BrainPlanViewerProps {
  plan: BrainPlan | null;
  isLoading?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

const modeIcons: Record<BrainPlan['mode'], React.ReactNode> = {
  thinking: <Brain className="w-4 h-4" />,
  extended_thinking: <Brain className="w-4 h-4" />,
  coding: <Code className="w-4 h-4" />,
  creative: <Lightbulb className="w-4 h-4" />,
  research: <Search className="w-4 h-4" />,
  analysis: <BarChart className="w-4 h-4" />,
  multi_model: <Users className="w-4 h-4" />,
  chain_of_thought: <Link2 className="w-4 h-4" />,
  self_consistency: <Shield className="w-4 h-4" />,
};

const modeLabels: Record<BrainPlan['mode'], string> = {
  thinking: 'Standard Reasoning',
  extended_thinking: 'Deep Multi-Step Reasoning',
  coding: 'Code Generation',
  creative: 'Creative Writing',
  research: 'Research Synthesis',
  analysis: 'Quantitative Analysis',
  multi_model: 'Multi-Model Consensus',
  chain_of_thought: 'Chain of Thought',
  self_consistency: 'Self Consistency',
};

const modeColors: Record<BrainPlan['mode'], string> = {
  thinking: 'text-blue-500 bg-blue-500/10',
  extended_thinking: 'text-purple-500 bg-purple-500/10',
  coding: 'text-green-500 bg-green-500/10',
  creative: 'text-orange-500 bg-orange-500/10',
  research: 'text-cyan-500 bg-cyan-500/10',
  analysis: 'text-red-500 bg-red-500/10',
  multi_model: 'text-yellow-500 bg-yellow-500/10',
  chain_of_thought: 'text-indigo-500 bg-indigo-500/10',
  self_consistency: 'text-emerald-500 bg-emerald-500/10',
};

const stepTypeIcons: Record<BrainPlanStep['type'], React.ReactNode> = {
  analyze: <Search className="w-3 h-3" />,
  detect_domain: <Brain className="w-3 h-3" />,
  select_model: <Zap className="w-3 h-3" />,
  prepare_context: <Code className="w-3 h-3" />,
  ethics_check: <Shield className="w-3 h-3" />,
  generate: <Lightbulb className="w-3 h-3" />,
  synthesize: <Link2 className="w-3 h-3" />,
  verify: <CheckCircle className="w-3 h-3" />,
  refine: <BarChart className="w-3 h-3" />,
  calibrate: <Users className="w-3 h-3" />,
  reflect: <Brain className="w-3 h-3" />,
};

export function BrainPlanViewer({
  plan,
  isLoading = false,
  isExpanded = false,
  onToggleExpand,
  className,
}: BrainPlanViewerProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    setExpanded(isExpanded);
  }, [isExpanded]);

  const handleToggle = () => {
    setExpanded(!expanded);
    onToggleExpand?.();
  };

  const completedSteps = plan?.steps.filter(s => s.status === 'completed').length || 0;
  const totalSteps = plan?.steps.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  if (!plan && !isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            plan ? modeColors[plan.mode] : 'bg-zinc-200 dark:bg-zinc-700'
          )}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : plan ? (
              modeIcons[plan.mode]
            ) : (
              <Brain className="w-4 h-4" />
            )}
          </div>
          
          <div className="text-left">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {isLoading ? 'Generating plan...' : plan ? modeLabels[plan.mode] : 'Brain Plan'}
            </p>
            {plan?.model && (
              <p className="text-xs text-zinc-500">
                {plan.model.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {plan && (
            <>
              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-xs text-zinc-500">
                  {completedSteps}/{totalSteps}
                </span>
              </div>

              {/* Cost estimate */}
              {plan.estimatedCost !== undefined && (
                <span className="text-xs text-zinc-500">
                  ~${plan.estimatedCost.toFixed(3)}
                </span>
              )}
            </>
          )}

          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && plan && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-4 space-y-4">
              {/* Domain Detection */}
              {plan.domain && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Domain:</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {plan.domain.field} → {plan.domain.domain}
                    {plan.domain.subspecialty && ` → ${plan.domain.subspecialty}`}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({Math.round(plan.domain.confidence * 100)}%)
                  </span>
                </div>
              )}

              {/* Model Selection */}
              <div className="flex items-start gap-2 text-sm">
                <span className="text-zinc-500">Model:</span>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {plan.model.name}
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {plan.model.reason}
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div>
                <button
                  onClick={() => setShowSteps(!showSteps)}
                  className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {showSteps ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>Steps ({plan.steps.length})</span>
                </button>

                <AnimatePresence>
                  {showSteps && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 space-y-1"
                    >
                      {plan.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className={cn(
                            'flex items-center gap-3 p-2 rounded-lg',
                            step.status === 'running' && 'bg-blue-50 dark:bg-blue-950',
                            step.status === 'completed' && 'bg-green-50 dark:bg-green-950',
                            step.status === 'skipped' && 'opacity-50'
                          )}
                        >
                          {/* Status Icon */}
                          {step.status === 'running' ? (
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          ) : step.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-zinc-300" />
                          )}

                          {/* Step Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-400">
                                {index + 1}.
                              </span>
                              <div className="text-zinc-400">
                                {stepTypeIcons[step.type]}
                              </div>
                              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                {step.label}
                              </span>
                            </div>
                          </div>

                          {/* Timing */}
                          {step.actualMs !== undefined ? (
                            <span className="text-xs text-zinc-400">
                              {step.actualMs}ms
                            </span>
                          ) : step.estimatedMs !== undefined && step.status === 'pending' ? (
                            <span className="text-xs text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ~{step.estimatedMs}ms
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default BrainPlanViewer;
