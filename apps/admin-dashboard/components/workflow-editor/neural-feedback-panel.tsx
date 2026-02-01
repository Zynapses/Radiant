'use client';

/**
 * Neural Feedback Panel
 * RADIANT v5.53.0
 * 
 * UI for neural network feedback loops in workflow orchestration:
 * - Quality feedback submission
 * - Model performance tracking
 * - Learning curve visualization
 * - Pattern recognition insights
 * 
 * Uses glass UI design system.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard } from '@/components/ui/glass-card';
import { Slider } from '@/components/ui/slider';
import {
  Brain,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  MessageSquare,
  CheckCircle2,
  XCircle,
  BarChart3,
  LineChart,
  RefreshCw,
  Send,
  Star,
  AlertCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// Types
// =============================================================================

export interface FeedbackSubmission {
  executionId: string;
  modelId: string;
  workflowId: string;
  stepId: string;
  rating: number; // 1-5
  qualityScore?: number; // 0-1
  latencySatisfactory?: boolean;
  costSatisfactory?: boolean;
  comment?: string;
  correctedOutput?: string;
  timestamp: string;
}

export interface ModelPerformance {
  modelId: string;
  modelName: string;
  totalExecutions: number;
  averageRating: number;
  averageQuality: number;
  averageLatencyMs: number;
  improvementTrend: number; // -1 to 1
  lastUpdated: string;
}

export interface LearningInsight {
  insightId: string;
  type: 'pattern' | 'improvement' | 'warning' | 'suggestion';
  title: string;
  description: string;
  confidence: number;
  timestamp: string;
}

// =============================================================================
// Star Rating
// =============================================================================

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= (hovered ?? value);
        return (
          <button
            key={star}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !disabled && setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            disabled={disabled}
            className={cn(
              'p-0.5 transition-all',
              disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            )}
          >
            <Star
              className={cn(
                'w-5 h-5 transition-colors',
                isFilled ? 'fill-amber-400 text-amber-400' : 'text-white/20'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Quick Feedback Buttons
// =============================================================================

function QuickFeedback({
  onPositive,
  onNegative,
  disabled,
}: {
  onPositive: () => void;
  onNegative: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onPositive}
        disabled={disabled}
        className="h-8 px-3 hover:bg-emerald-500/20 hover:text-emerald-400"
      >
        <ThumbsUp className="w-4 h-4 mr-1" />
        Good
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onNegative}
        disabled={disabled}
        className="h-8 px-3 hover:bg-red-500/20 hover:text-red-400"
      >
        <ThumbsDown className="w-4 h-4 mr-1" />
        Poor
      </Button>
    </div>
  );
}

// =============================================================================
// Model Performance Card
// =============================================================================

function ModelPerformanceCard({
  performance,
}: {
  performance: ModelPerformance;
}) {
  const trendIcon = performance.improvementTrend > 0 ? TrendingUp : 
                    performance.improvementTrend < 0 ? TrendingDown : Target;
  const trendColor = performance.improvementTrend > 0 ? 'text-emerald-400' :
                     performance.improvementTrend < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <span className="font-medium text-sm">{performance.modelName}</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className={cn('flex items-center gap-1', trendColor)}>
                {React.createElement(trendIcon, { className: 'w-3 h-3' })}
                <span className="text-xs font-mono">
                  {performance.improvementTrend > 0 ? '+' : ''}
                  {(performance.improvementTrend * 100).toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Learning trend over last 7 days
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground mb-0.5">Rating</div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-mono">{performance.averageRating.toFixed(1)}</span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Quality</div>
          <span className="font-mono text-violet-400">
            {(performance.averageQuality * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Executions</div>
          <span className="font-mono">{performance.totalExecutions}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Learning Insight Card
// =============================================================================

function InsightCard({
  insight,
}: {
  insight: LearningInsight;
}) {
  const typeConfig = {
    pattern: { icon: Sparkles, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    improvement: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    warning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    suggestion: { icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  };

  const config = typeConfig[insight.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('p-3 rounded-lg border border-white/10', config.bg)}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-4 h-4 mt-0.5', config.color)} />
        <div className="flex-1">
          <div className="font-medium text-sm">{insight.title}</div>
          <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
            <span>{(insight.confidence * 100).toFixed(0)}% confidence</span>
            <span>•</span>
            <span>{new Date(insight.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Learning Progress
// =============================================================================

function LearningProgress({
  dataPoints,
}: {
  dataPoints: Array<{ date: string; quality: number }>;
}) {
  if (dataPoints.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <LineChart className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Not enough data yet
      </div>
    );
  }

  const maxQuality = Math.max(...dataPoints.map(d => d.quality));
  const minQuality = Math.min(...dataPoints.map(d => d.quality));
  const range = maxQuality - minQuality || 0.1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <LineChart className="w-3 h-3" />
          Learning Curve
        </span>
        <span className="font-mono text-violet-400">
          {(dataPoints[dataPoints.length - 1]?.quality * 100).toFixed(0)}%
        </span>
      </div>
      
      <div className="relative h-16 border border-white/10 rounded-lg p-2">
        <svg className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="learningGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Area fill */}
          <motion.path
            d={`
              M 0 ${100 - ((dataPoints[0]?.quality - minQuality) / range) * 100}
              ${dataPoints.map((d, i) => {
                const x = (i / (dataPoints.length - 1)) * 100;
                const y = 100 - ((d.quality - minQuality) / range) * 100;
                return `L ${x} ${y}`;
              }).join(' ')}
              L 100 100
              L 0 100
              Z
            `}
            fill="url(#learningGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          
          {/* Line */}
          <motion.path
            d={`
              M 0 ${100 - ((dataPoints[0]?.quality - minQuality) / range) * 100}
              ${dataPoints.map((d, i) => {
                const x = (i / (dataPoints.length - 1)) * 100;
                const y = 100 - ((d.quality - minQuality) / range) * 100;
                return `L ${x} ${y}`;
              }).join(' ')}
            `}
            fill="none"
            stroke="rgb(139, 92, 246)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
        </svg>
      </div>
    </div>
  );
}

// =============================================================================
// Feedback Form
// =============================================================================

function FeedbackForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (feedback: Partial<FeedbackSubmission>) => void;
  isSubmitting?: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [qualityScore, setQualityScore] = useState(0.7);
  const [comment, setComment] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const handleSubmit = () => {
    onSubmit({
      rating,
      qualityScore,
      comment: comment || undefined,
      timestamp: new Date().toISOString(),
    });
    setRating(0);
    setComment('');
    setShowDetails(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Rate this output:</span>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <AnimatePresence>
        {rating > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Quality Score</span>
                <span className="font-mono text-violet-400">
                  {(qualityScore * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[qualityScore * 100]}
                onValueChange={([v]) => setQualityScore(v / 100)}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <Textarea
              placeholder="Optional: Add details about this output..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-20 text-sm resize-none"
            />

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className="w-full"
              size="sm"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <Send className="w-3 h-3 mr-2" />
              )}
              Submit Feedback
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Main Panel
// =============================================================================

export interface NeuralFeedbackPanelProps {
  executionId: string;
  modelId: string;
  workflowId: string;
  stepId: string;
  modelPerformance?: ModelPerformance[];
  insights?: LearningInsight[];
  learningCurve?: Array<{ date: string; quality: number }>;
  onSubmitFeedback?: (feedback: Partial<FeedbackSubmission>) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function NeuralFeedbackPanel({
  executionId,
  modelId,
  workflowId,
  stepId,
  modelPerformance = [],
  insights = [],
  learningCurve = [],
  onSubmitFeedback,
  isSubmitting,
  className,
}: NeuralFeedbackPanelProps) {
  const handleQuickPositive = () => {
    onSubmitFeedback?.({
      executionId,
      modelId,
      workflowId,
      stepId,
      rating: 5,
      qualityScore: 0.9,
      timestamp: new Date().toISOString(),
    });
  };

  const handleQuickNegative = () => {
    onSubmitFeedback?.({
      executionId,
      modelId,
      workflowId,
      stepId,
      rating: 1,
      qualityScore: 0.2,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDetailedFeedback = (feedback: Partial<FeedbackSubmission>) => {
    onSubmitFeedback?.({
      ...feedback,
      executionId,
      modelId,
      workflowId,
      stepId,
    });
  };

  return (
    <GlassCard className={cn('p-4', className)} variant="elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Neural Feedback Loop</h3>
            <p className="text-xs text-muted-foreground">
              Help the system learn
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          <Sparkles className="w-3 h-3 mr-1" />
          Learning
        </Badge>
      </div>

      {/* Quick Feedback */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/10">
        <span className="text-sm text-muted-foreground">Was this helpful?</span>
        <QuickFeedback
          onPositive={handleQuickPositive}
          onNegative={handleQuickNegative}
          disabled={isSubmitting}
        />
      </div>

      {/* Detailed Feedback Form */}
      <div className="mb-4">
        <FeedbackForm
          onSubmit={handleDetailedFeedback}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* Learning Progress */}
      {learningCurve.length > 0 && (
        <div className="mb-4">
          <LearningProgress dataPoints={learningCurve} />
        </div>
      )}

      {/* Model Performance */}
      {modelPerformance.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Model Performance
          </h4>
          <div className="space-y-2">
            {modelPerformance.slice(0, 3).map(perf => (
              <ModelPerformanceCard key={perf.modelId} performance={perf} />
            ))}
          </div>
        </div>
      )}

      {/* Learning Insights */}
      {insights.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Learning Insights
          </h4>
          <div className="space-y-2">
            {insights.slice(0, 3).map(insight => (
              <InsightCard key={insight.insightId} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export default NeuralFeedbackPanel;
