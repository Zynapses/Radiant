'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Brain,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Network,
  Shield,
  BookOpen,
  Target,
  Zap,
  Play,
  RotateCw,
  X,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PlanStep {
  stepNumber: number;
  icon: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  statusIcon: string;
  isActive: boolean;
  details?: string[];
  model?: string;
  domain?: string;
  duration?: string;
  confidence?: string;
}

interface PlanSummary {
  headline: string;
  approach: string;
  stepsOverview: string[];
  expectedOutcome: string;
  estimatedTime: string;
  confidenceStatement: string;
  warnings?: string[];
}

interface SynthesisSummary {
  title: string;
  overview: string;
  keyPoints: string[];
  modelsUsed: {
    modelId: string;
    role: string;
    confidence: number;
  }[];
  artifacts: string[];
  wordCount: number;
  readingTime: string;
  agreementScore?: number;
}

interface PlanDisplay {
  planId: string;
  status: string;
  statusMessage: string;
  mode: string;
  modeDescription: string;
  modeSelection: 'auto' | 'user';
  modeReason: string;
  promptSummary: string;
  complexity: string;
  estimatedTime: string;
  estimatedCost: string;
  domain?: {
    icon: string;
    name: string;
    field: string;
    confidence: string;
  };
  model: {
    name: string;
    provider: string;
    reason: string;
  };
  steps: PlanStep[];
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  elapsed?: string;
  remaining?: string;
  summary?: PlanSummary;
  synthesis?: SynthesisSummary;
}

interface BrainPlanViewerProps {
  prompt: string;
  sessionId?: string;
  conversationId?: string;
  onPlanReady?: (planId: string) => void;
  onExecute?: (planId: string) => void;
  onCancel?: () => void;
  autoExecute?: boolean;
  compact?: boolean;
}

// ============================================================================
// Mode Icons
// ============================================================================

const MODE_ICONS: Record<string, typeof Brain> = {
  thinking: Brain,
  extended_thinking: Brain,
  coding: Zap,
  creative: Sparkles,
  research: BookOpen,
  analysis: Target,
  multi_model: Network,
  chain_of_thought: Brain,
  self_consistency: Shield,
};

const MODE_COLORS: Record<string, string> = {
  thinking: 'bg-violet-100 text-violet-700 border-violet-200',
  extended_thinking: 'bg-purple-100 text-purple-700 border-purple-200',
  coding: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  creative: 'bg-pink-100 text-pink-700 border-pink-200',
  research: 'bg-blue-100 text-blue-700 border-blue-200',
  analysis: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  multi_model: 'bg-amber-100 text-amber-700 border-amber-200',
  chain_of_thought: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  self_consistency: 'bg-rose-100 text-rose-700 border-rose-200',
};

// ============================================================================
// Component
// ============================================================================

export function BrainPlanViewer({
  prompt,
  sessionId,
  conversationId,
  onPlanReady,
  onExecute,
  onCancel,
  autoExecute = false,
  compact = false,
}: BrainPlanViewerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [planId, setPlanId] = useState<string | null>(null);

  // Generate plan on mount
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/thinktank/brain-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          sessionId,
          conversationId,
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPlanId(data.plan.planId);
      onPlanReady?.(data.plan.planId);
      
      if (autoExecute) {
        executeMutation.mutate(data.plan.planId);
      }
    },
  });

  // Execute plan
  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/thinktank/brain-plan/${id}/execute`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: (data) => {
      onExecute?.(data.plan.planId);
    },
  });

  // Poll for updates when executing
  const { data: planData, isLoading: isPlanLoading } = useQuery({
    queryKey: ['brain-plan', planId],
    queryFn: async () => {
      const response = await fetch(`/api/thinktank/brain-plan/${planId}`);
      return response.json();
    },
    enabled: !!planId,
    refetchInterval: (query) => {
      // Poll every 500ms while executing
      const data = query.state.data as { plan?: { status?: string } } | undefined;
      return data?.plan?.status === 'executing' ? 500 : false;
    },
  });

  // Generate plan on mount
  useEffect(() => {
    if (prompt && !planId && !generateMutation.isPending) {
      generateMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const display: PlanDisplay | null = planData?.display || generateMutation.data?.display;
  const isGenerating = generateMutation.isPending;
  const isExecuting = executeMutation.isPending || display?.status === 'executing';
  const isComplete = display?.status === 'completed';
  const isFailed = display?.status === 'failed';

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const getStepStatusIcon = (step: PlanStep) => {
    if (step.status === 'completed') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (step.status === 'in_progress' || step.isActive) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (step.status === 'failed') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (step.status === 'skipped') {
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  if (isGenerating && !display) {
    return (
      <Card className={cn('border-dashed', compact && 'p-2')}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500 mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing your request...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!display) {
    return null;
  }

  const ModeIcon = MODE_ICONS[display.mode] || Brain;
  const modeColor = MODE_COLORS[display.mode] || MODE_COLORS.thinking;
  const progress = (display.completedSteps / display.totalSteps) * 100;

  return (
    <Card className={cn(
      'transition-all duration-300',
      isComplete && 'border-emerald-200 bg-emerald-50/30',
      isFailed && 'border-red-200 bg-red-50/30',
      isExecuting && 'border-blue-200 bg-blue-50/30',
      compact && 'p-0'
    )}>
      <CardHeader className={cn('pb-3', compact && 'p-3')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg border',
              modeColor
            )}>
              <ModeIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Brain Plan
                <Badge variant="outline" className="font-normal text-xs">
                  {display.mode.replace(/_/g, ' ')}
                </Badge>
                {/* Workflow Selection Indicator */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant={display.modeSelection === 'auto' ? 'secondary' : 'default'}
                        className={cn(
                          'text-xs',
                          display.modeSelection === 'auto' 
                            ? 'bg-amber-100 text-amber-700 border-amber-200' 
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        )}
                      >
                        {display.modeSelection === 'auto' ? (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Auto
                          </>
                        ) : (
                          <>
                            <Target className="h-3 w-3 mr-1" />
                            Selected
                          </>
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">
                        {display.modeSelection === 'auto' ? 'Auto-selected workflow' : 'User-selected workflow'}
                      </p>
                      <p className="text-xs text-muted-foreground">{display.modeReason}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {isExecuting && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Executing
                  </Badge>
                )}
                {isComplete && (
                  <Badge variant="default" className="bg-emerald-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {display.modeDescription}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {display.status === 'ready' && (
              <Button 
                size="sm" 
                onClick={() => planId && executeMutation.mutate(planId)}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Execute
              </Button>
            )}
            {onCancel && !isComplete && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {display.totalSteps > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Step {display.currentStep + 1} of {display.totalSteps}
              </span>
              <span>
                {display.completedSteps} completed
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>

      <CardContent className={cn('space-y-4', compact && 'p-3 pt-0')}>
        {/* Plan Summary (shown before execution) */}
        {display.summary && display.status === 'ready' && (
          <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-100 dark:border-violet-800">
            <h4 className="font-semibold text-violet-900 dark:text-violet-100 mb-2">
              {display.summary.headline}
            </h4>
            <p className="text-sm text-violet-700 dark:text-violet-300 mb-3">
              {display.summary.approach}
            </p>
            
            <div className="space-y-1.5 mb-3">
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                My Plan:
              </p>
              {display.summary.stepsOverview.map((step, i) => (
                <p key={i} className="text-sm text-violet-800 dark:text-violet-200 pl-2">
                  {step}
                </p>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-violet-600 dark:text-violet-400">
              <span>{display.summary.estimatedTime}</span>
              <span>•</span>
              <span>{display.summary.confidenceStatement}</span>
            </div>

            {display.summary.warnings && display.summary.warnings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-700 space-y-1">
                {display.summary.warnings.map((warning, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    {warning}
                  </p>
                ))}
              </div>
            )}

            <p className="text-sm text-violet-700 dark:text-violet-300 mt-3 italic">
              {display.summary.expectedOutcome}
            </p>
          </div>
        )}

        {/* Summary Row */}
        <div className="flex flex-wrap gap-4 text-sm">
          {display.domain && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <span>{display.domain.icon}</span>
                    <span className="font-medium">{display.domain.name}</span>
                    <Badge variant="secondary" className="text-xs h-5">
                      {display.domain.confidence}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Domain: {display.domain.field} → {display.domain.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                  <Network className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{display.model.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{display.model.reason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{display.elapsed || display.estimatedTime}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{display.complexity}</span>
          </div>
        </div>

        <Separator />

        {/* Steps */}
        <div className="space-y-1">
          {display.steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.stepNumber);
            const isCurrentStep = step.isActive || (isExecuting && step.status === 'in_progress');

            return (
              <Collapsible
                key={step.stepNumber}
                open={isExpanded}
                onOpenChange={() => toggleStep(step.stepNumber)}
              >
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-muted/50',
                      isCurrentStep && 'bg-blue-50 dark:bg-blue-950/30',
                      step.status === 'completed' && 'opacity-70'
                    )}
                  >
                    {/* Status indicator */}
                    {getStepStatusIcon(step)}

                    {/* Step icon */}
                    <span className="text-lg">{step.icon}</span>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium text-sm',
                          step.status === 'completed' && 'text-muted-foreground'
                        )}>
                          {step.title}
                        </span>
                        {step.model && (
                          <Badge variant="outline" className="text-xs h-5">
                            {step.model.split('/').pop()}
                          </Badge>
                        )}
                        {step.duration && (
                          <span className="text-xs text-muted-foreground">
                            {step.duration}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {step.description}
                      </p>
                    </div>

                    {/* Expand indicator */}
                    {step.details && step.details.length > 0 && (
                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleTrigger>

                {step.details && step.details.length > 0 && (
                  <CollapsibleContent>
                    <div className="ml-12 pl-3 border-l-2 border-muted py-2 space-y-1">
                      {step.details.map((detail, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {detail}
                        </p>
                      ))}
                      {step.confidence && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Confidence:</span>
                          <Badge variant="secondary" className="text-xs">
                            {step.confidence}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            );
          })}
        </div>

        {/* Multi-Model Synthesis Summary (shown after execution with multi_model mode) */}
        {display.synthesis && isComplete && (
          <>
            <Separator />
            <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-3">
                <Network className="h-5 w-5 text-emerald-600" />
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {display.synthesis.title}
                </h4>
                {display.synthesis.agreementScore !== undefined && (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      'text-xs',
                      display.synthesis.agreementScore >= 0.8 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {Math.round(display.synthesis.agreementScore * 100)}% agreement
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-3">
                {display.synthesis.overview}
              </p>

              {/* Models Used */}
              <div className="mb-3">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                  Models Contributing:
                </p>
                <div className="flex flex-wrap gap-2">
                  {display.synthesis.modelsUsed.map((model, i) => (
                    <TooltipProvider key={i}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs">
                            {model.modelId.split('/')[1] || model.modelId}
                            <span className="ml-1 opacity-60">
                              ({Math.round(model.confidence * 100)}%)
                            </span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{model.role}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>

              {/* Key Points */}
              {display.synthesis.keyPoints.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                    Key Points:
                  </p>
                  <ul className="space-y-1">
                    {display.synthesis.keyPoints.map((point, i) => (
                      <li key={i} className="text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Artifacts */}
              {display.synthesis.artifacts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                    Generated Files:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {display.synthesis.artifacts.map((artifactId, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        📄 {artifactId.slice(0, 12)}...
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer stats */}
              <div className="flex items-center gap-4 text-xs text-emerald-600 dark:text-emerald-400 pt-2 border-t border-emerald-200 dark:border-emerald-700">
                <span>{display.synthesis.wordCount.toLocaleString()} words</span>
                <span>•</span>
                <span>{display.synthesis.readingTime}</span>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        {!compact && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Plan ID: {display.planId.slice(0, 8)}...</span>
              <span>Est. cost: {display.estimatedCost}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default BrainPlanViewer;
