'use client';

/**
 * Cost Negotiation Panel
 * RADIANT v5.53.0
 * 
 * UI for workflow budget management and model cost negotiation:
 * - Budget allocation dashboard
 * - Model bidding visualization
 * - Cost vs quality tradeoffs
 * - Step spending breakdown
 * 
 * Uses glass UI design system.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { GlassCard } from '@/components/ui/glass-card';
import {
  DollarSign,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Scale,
  BarChart3,
  Info,
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

export interface ModelBid {
  modelId: string;
  modelName?: string;
  estimatedCostCents: number;
  estimatedQuality: number;
  estimatedLatencyMs: number;
  capabilities: string[];
}

export interface BudgetAllocation {
  allocationId: string;
  workflowId: string;
  totalBudgetCents: number;
  remainingBudgetCents: number;
  allocatedSteps: Record<string, number>;
  spentCents: number;
}

export interface NegotiationResult {
  success: boolean;
  selectedModel: ModelBid | null;
  allocatedBudgetCents: number;
  alternatives: ModelBid[];
  reasoning: string;
  tradeoffAnalysis?: {
    qualityVsCost: number;
    speedVsCost: number;
    recommendation: 'accept' | 'consider_alternatives' | 'reject';
  };
}

// =============================================================================
// Budget Gauge
// =============================================================================

function BudgetGauge({
  total,
  spent,
  remaining,
}: {
  total: number;
  spent: number;
  remaining: number;
}) {
  const percentUsed = (spent / total) * 100;
  const isLow = remaining < total * 0.2;
  const isCritical = remaining < total * 0.1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Budget Used</span>
        <span className={cn(
          'font-mono font-medium',
          isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
        )}>
          {formatCents(spent)} / {formatCents(total)}
        </span>
      </div>
      
      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentUsed}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        
        {/* Markers for 25%, 50%, 75% */}
        {[25, 50, 75].map(marker => (
          <div
            key={marker}
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${marker}%` }}
          />
        ))}
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{percentUsed.toFixed(0)}% used</span>
        <span>{formatCents(remaining)} remaining</span>
      </div>
    </div>
  );
}

function formatCents(cents: number): string {
  if (cents >= 100) {
    return `$${(cents / 100).toFixed(2)}`;
  }
  return `${cents.toFixed(1)}¢`;
}

// =============================================================================
// Model Bid Card
// =============================================================================

function ModelBidCard({
  bid,
  isSelected,
  isBest,
  onSelect,
}: {
  bid: ModelBid;
  isSelected?: boolean;
  isBest?: boolean;
  onSelect?: () => void;
}) {
  const qualityPercent = bid.estimatedQuality * 100;
  const value = bid.estimatedQuality / (bid.estimatedCostCents || 0.01);

  return (
    <motion.button
      onClick={onSelect}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-all',
        'border border-white/10 hover:border-white/20',
        isSelected && 'border-violet-500 bg-violet-500/10',
        !isSelected && 'bg-white/[0.02] hover:bg-white/[0.04]'
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {bid.modelName || bid.modelId.split('/').pop()}
          </span>
        </div>
        {isBest && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            <Sparkles className="w-2.5 h-2.5 mr-1" />
            Best Value
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground mb-0.5">Cost</div>
          <div className="font-mono font-medium text-emerald-400">
            {formatCents(bid.estimatedCostCents)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Quality</div>
          <div className="font-mono font-medium text-violet-400">
            {qualityPercent.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Latency</div>
          <div className="font-mono font-medium text-cyan-400">
            {bid.estimatedLatencyMs}ms
          </div>
        </div>
      </div>

      {bid.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {bid.capabilities.slice(0, 3).map(cap => (
            <Badge key={cap} variant="outline" className="text-[10px] px-1.5 py-0">
              {cap}
            </Badge>
          ))}
          {bid.capabilities.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{bid.capabilities.length - 3}
            </Badge>
          )}
        </div>
      )}
    </motion.button>
  );
}

// =============================================================================
// Quality-Cost Tradeoff Chart
// =============================================================================

function TradeoffChart({
  bids,
  selectedId,
}: {
  bids: ModelBid[];
  selectedId?: string;
}) {
  const maxCost = Math.max(...bids.map(b => b.estimatedCostCents), 1);
  
  return (
    <div className="relative h-40 w-full border border-white/10 rounded-lg p-4">
      {/* Axes */}
      <div className="absolute left-8 top-2 text-[10px] text-muted-foreground">Quality</div>
      <div className="absolute right-2 bottom-2 text-[10px] text-muted-foreground">Cost</div>
      
      {/* Grid lines */}
      <div className="absolute inset-8 border-l border-b border-white/10">
        {[25, 50, 75].map(y => (
          <div
            key={y}
            className="absolute w-full border-t border-white/5"
            style={{ bottom: `${y}%` }}
          />
        ))}
        {[25, 50, 75].map(x => (
          <div
            key={x}
            className="absolute h-full border-l border-white/5"
            style={{ left: `${x}%` }}
          />
        ))}
      </div>
      
      {/* Points */}
      <div className="absolute inset-8">
        {bids.map((bid, idx) => {
          const x = (bid.estimatedCostCents / maxCost) * 100;
          const y = bid.estimatedQuality * 100;
          const isSelected = bid.modelId === selectedId;
          
          return (
            <TooltipProvider key={bid.modelId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    className={cn(
                      'absolute w-3 h-3 rounded-full -translate-x-1/2 translate-y-1/2 cursor-pointer',
                      isSelected 
                        ? 'bg-violet-500 ring-2 ring-violet-500/50' 
                        : 'bg-white/60 hover:bg-white'
                    )}
                    style={{ left: `${x}%`, bottom: `${y}%` }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.3 }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">{bid.modelId.split('/').pop()}</div>
                  <div className="text-muted-foreground">
                    {formatCents(bid.estimatedCostCents)} • {(bid.estimatedQuality * 100).toFixed(0)}%
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      
      {/* Ideal zone indicator */}
      <div className="absolute bottom-8 right-8 w-1/3 h-1/3 border border-emerald-500/30 rounded bg-emerald-500/5">
        <span className="absolute top-1 left-1 text-[8px] text-emerald-400">Ideal Zone</span>
      </div>
    </div>
  );
}

// =============================================================================
// Step Spending Breakdown
// =============================================================================

function StepBreakdown({
  steps,
  total,
}: {
  steps: Record<string, number>;
  total: number;
}) {
  const sortedSteps = useMemo(() => 
    Object.entries(steps)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5),
    [steps]
  );

  if (sortedSteps.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No spending recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedSteps.map(([stepId, cents]) => {
        const percent = (cents / total) * 100;
        return (
          <div key={stepId} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate max-w-[150px]">
                {stepId}
              </span>
              <span className="font-mono">{formatCents(cents)}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-violet-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Negotiation Result Display
// =============================================================================

function NegotiationResultDisplay({
  result,
}: {
  result: NegotiationResult;
}) {
  const { tradeoffAnalysis } = result;
  
  const recommendationConfig = {
    accept: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    consider_alternatives: { icon: Scale, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    reject: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  const config = tradeoffAnalysis 
    ? recommendationConfig[tradeoffAnalysis.recommendation]
    : recommendationConfig.accept;
  const Icon = config.icon;

  return (
    <GlassCard variant="inset" padding="sm" className={config.bg}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 mt-0.5', config.color)} />
        <div className="flex-1">
          <div className="font-medium text-sm mb-1">
            {tradeoffAnalysis?.recommendation === 'accept' && 'Recommended Selection'}
            {tradeoffAnalysis?.recommendation === 'consider_alternatives' && 'Consider Alternatives'}
            {tradeoffAnalysis?.recommendation === 'reject' && 'Budget Concern'}
          </div>
          <p className="text-xs text-muted-foreground">{result.reasoning}</p>
          
          {tradeoffAnalysis && (
            <div className="flex gap-4 mt-2 text-xs">
              <div>
                <span className="text-muted-foreground">Value: </span>
                <span className="font-mono">{tradeoffAnalysis.qualityVsCost.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Speed: </span>
                <span className="font-mono">{tradeoffAnalysis.speedVsCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// =============================================================================
// Main Panel
// =============================================================================

export interface CostNegotiationPanelProps {
  budget: BudgetAllocation;
  bids: ModelBid[];
  negotiationResult?: NegotiationResult;
  qualityTarget: number;
  onQualityTargetChange?: (value: number) => void;
  onSelectModel?: (modelId: string) => void;
  onNegotiate?: () => void;
  className?: string;
}

export function CostNegotiationPanel({
  budget,
  bids,
  negotiationResult,
  qualityTarget,
  onQualityTargetChange,
  onSelectModel,
  onNegotiate,
  className,
}: CostNegotiationPanelProps) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    negotiationResult?.selectedModel?.modelId || null
  );

  const sortedBids = useMemo(() => 
    [...bids].sort((a, b) => {
      const valueA = a.estimatedQuality / (a.estimatedCostCents || 0.01);
      const valueB = b.estimatedQuality / (b.estimatedCostCents || 0.01);
      return valueB - valueA;
    }),
    [bids]
  );

  const bestValueModelId = sortedBids[0]?.modelId;

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    onSelectModel?.(modelId);
  };

  return (
    <GlassCard className={cn('p-4', className)} variant="elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Cost Negotiation</h3>
            <p className="text-xs text-muted-foreground">
              {bids.length} models available
            </p>
          </div>
        </div>
        <Badge variant="outline">
          <BarChart3 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      </div>

      {/* Budget Gauge */}
      <BudgetGauge
        total={budget.totalBudgetCents}
        spent={budget.spentCents}
        remaining={budget.remainingBudgetCents}
      />

      {/* Quality Target Slider */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Target className="w-3 h-3" />
            Quality Target
          </span>
          <span className="font-mono font-medium text-violet-400">
            {(qualityTarget * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[qualityTarget * 100]}
          onValueChange={([v]) => onQualityTargetChange?.(v / 100)}
          min={50}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Tradeoff Chart */}
      <div className="mt-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          Quality vs Cost
        </h4>
        <TradeoffChart bids={bids} selectedId={selectedModelId || undefined} />
      </div>

      {/* Model Bids */}
      <div className="mt-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          Available Models
        </h4>
        <ScrollArea className="h-48">
          <div className="space-y-2 pr-2">
            {sortedBids.map(bid => (
              <ModelBidCard
                key={bid.modelId}
                bid={bid}
                isSelected={bid.modelId === selectedModelId}
                isBest={bid.modelId === bestValueModelId}
                onSelect={() => handleSelectModel(bid.modelId)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Negotiation Result */}
      {negotiationResult && (
        <div className="mt-4">
          <NegotiationResultDisplay result={negotiationResult} />
        </div>
      )}

      {/* Step Breakdown */}
      <div className="mt-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          Spending by Step
        </h4>
        <StepBreakdown steps={budget.allocatedSteps} total={budget.spentCents} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onNegotiate}
          className="flex-1"
        >
          <Zap className="w-3 h-3 mr-2" />
          Negotiate Best Price
        </Button>
      </div>
    </GlassCard>
  );
}

export default CostNegotiationPanel;
