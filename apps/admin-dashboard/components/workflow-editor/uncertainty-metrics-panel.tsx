'use client';

/**
 * Uncertainty Metrics Panel
 * RADIANT v5.53.0
 * 
 * UI for displaying enhanced semantic entropy with surprise metrics:
 * - Entropy visualization
 * - Surprise score display
 * - Cluster distribution
 * - Reflexion trigger indicators
 * - Sample comparison
 * 
 * Uses glass UI design system.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GlassCard } from '@/components/ui/glass-card';
import {
  AlertTriangle,
  CheckCircle2,
  Brain,
  Sparkles,
  Activity,
  BarChart3,
  Layers,
  GitBranch,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
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

export interface UncertaintyMetrics {
  semanticEntropy: number;
  surpriseScore: number;
  confidenceInterval: [number, number];
  clusterCount: number;
  dominantClusterRatio: number;
  sampleAgreement: number;
  triggerReflexion: boolean;
  reflexionReason?: string;
}

export interface SampleData {
  content: string;
  clusterId: number;
  localSurprise: number;
}

export interface EnhancedEntropyResult {
  response: string;
  uncertainty: UncertaintyMetrics;
  samples: SampleData[];
  processingTimeMs: number;
  tokensUsed: number;
}

// =============================================================================
// Entropy Gauge
// =============================================================================

function EntropyGauge({
  value,
  label,
  color,
  icon: Icon,
  description,
}: {
  value: number;
  label: string;
  color: 'emerald' | 'violet' | 'amber' | 'cyan' | 'red';
  icon: React.ElementType;
  description: string;
}) {
  const percent = value * 100;
  const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-400',
    violet: 'from-violet-500 to-violet-400',
    amber: 'from-amber-500 to-amber-400',
    cyan: 'from-cyan-500 to-cyan-400',
    red: 'from-red-500 to-red-400',
  };

  const textColors = {
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    red: 'text-red-400',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {label}
              </span>
              <span className={cn('text-sm font-mono font-medium', textColors[color])}>
                {percent.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full bg-gradient-to-r', colorClasses[color])}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Cluster Distribution
// =============================================================================

function ClusterDistribution({
  samples,
  clusterCount,
}: {
  samples: SampleData[];
  clusterCount: number;
}) {
  const clusterSizes = useMemo(() => {
    const sizes: Record<number, number> = {};
    samples.forEach(s => {
      sizes[s.clusterId] = (sizes[s.clusterId] || 0) + 1;
    });
    return Object.entries(sizes)
      .map(([id, size]) => ({ id: Number(id), size }))
      .sort((a, b) => b.size - a.size);
  }, [samples]);

  const colors = [
    'bg-violet-500',
    'bg-cyan-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-blue-500',
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Cluster Distribution
        </span>
        <Badge variant="outline" className="text-[10px]">
          {clusterCount} clusters
        </Badge>
      </div>
      
      <div className="flex h-6 rounded-lg overflow-hidden">
        {clusterSizes.map((cluster, idx) => {
          const percent = (cluster.size / samples.length) * 100;
          return (
            <TooltipProvider key={cluster.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    className={cn(colors[idx % colors.length], 'h-full')}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Cluster {cluster.id}: {cluster.size} samples ({percent.toFixed(0)}%)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {clusterSizes.slice(0, 4).map((cluster, idx) => (
          <div key={cluster.id} className="flex items-center gap-1.5 text-[10px]">
            <div className={cn('w-2 h-2 rounded-full', colors[idx % colors.length])} />
            <span className="text-muted-foreground">
              C{cluster.id}: {cluster.size}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Reflexion Alert
// =============================================================================

function ReflexionAlert({
  triggered,
  reason,
}: {
  triggered: boolean;
  reason?: string;
}) {
  if (!triggered) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 rounded-lg border',
        'bg-amber-500/10 border-amber-500/30'
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
        <div>
          <div className="font-medium text-sm text-amber-300">
            System 2 Reflexion Triggered
          </div>
          {reason && (
            <p className="text-xs text-amber-300/80 mt-1">{reason}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-300/60">
              Deep reasoning mode activated for improved accuracy
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Sample Viewer
// =============================================================================

function SampleViewer({
  samples,
  selectedResponse,
}: {
  samples: SampleData[];
  selectedResponse: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSample, setSelectedSample] = useState<number | null>(null);

  const sortedSamples = useMemo(() =>
    [...samples].sort((a, b) => a.localSurprise - b.localSurprise),
    [samples]
  );

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          Sample Comparison ({samples.length} samples)
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ScrollArea className="h-48 rounded-lg border border-white/10 p-2">
              <div className="space-y-2">
                {sortedSamples.map((sample, idx) => {
                  const isSelected = selectedSample === idx;
                  const surprisePercent = sample.localSurprise * 100;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedSample(isSelected ? null : idx)}
                      className={cn(
                        'w-full p-2 rounded-lg text-left transition-all',
                        'border border-white/5',
                        isSelected 
                          ? 'bg-violet-500/10 border-violet-500/30' 
                          : 'hover:bg-white/5'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="text-[10px] px-1.5 py-0"
                          >
                            C{sample.clusterId}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Sample {idx + 1}
                          </span>
                        </div>
                        <span className={cn(
                          'text-[10px] font-mono',
                          surprisePercent > 50 ? 'text-amber-400' : 'text-emerald-400'
                        )}>
                          {surprisePercent.toFixed(0)}% surprise
                        </span>
                      </div>
                      <p className={cn(
                        'text-xs line-clamp-2',
                        isSelected && 'line-clamp-none'
                      )}>
                        {sample.content}
                      </p>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Confidence Interval Display
// =============================================================================

function ConfidenceInterval({
  interval,
  value,
}: {
  interval: [number, number];
  value: number;
}) {
  const [low, high] = interval;
  const lowPercent = low * 100;
  const highPercent = high * 100;
  const valuePercent = value * 100;
  const rangePercent = highPercent - lowPercent;
  const valuePosition = ((value - low) / (high - low)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">95% Confidence Interval</span>
        <span className="font-mono text-muted-foreground">
          {lowPercent.toFixed(0)}% - {highPercent.toFixed(0)}%
        </span>
      </div>
      <div className="relative h-3 bg-white/5 rounded-full">
        <div
          className="absolute h-full bg-violet-500/30 rounded-full"
          style={{
            left: `${lowPercent}%`,
            width: `${rangePercent}%`,
          }}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-violet-500 rounded-full"
          style={{ left: `${valuePercent}%` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Main Panel
// =============================================================================

export interface UncertaintyMetricsPanelProps {
  result: EnhancedEntropyResult;
  onRecompute?: () => void;
  isComputing?: boolean;
  className?: string;
}

export function UncertaintyMetricsPanel({
  result,
  onRecompute,
  isComputing,
  className,
}: UncertaintyMetricsPanelProps) {
  const { uncertainty, samples, response, processingTimeMs, tokensUsed } = result;
  
  const isHighUncertainty = uncertainty.semanticEntropy > 0.6;
  const isHighSurprise = uncertainty.surpriseScore > 0.7;

  return (
    <GlassCard className={cn('p-4', className)} variant="elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            uncertainty.triggerReflexion 
              ? 'bg-amber-500/20' 
              : isHighUncertainty 
              ? 'bg-violet-500/20' 
              : 'bg-emerald-500/20'
          )}>
            <Brain className={cn(
              'w-4 h-4',
              uncertainty.triggerReflexion 
                ? 'text-amber-400' 
                : isHighUncertainty 
                ? 'text-violet-400' 
                : 'text-emerald-400'
            )} />
          </div>
          <div>
            <h3 className="font-medium text-sm">Uncertainty Analysis</h3>
            <p className="text-xs text-muted-foreground">
              Enhanced Semantic Entropy
            </p>
          </div>
        </div>
        <Badge 
          variant={uncertainty.triggerReflexion ? 'destructive' : 'outline'}
          className="text-[10px]"
        >
          {uncertainty.triggerReflexion ? 'Reflexion Active' : 'Normal'}
        </Badge>
      </div>

      {/* Reflexion Alert */}
      <ReflexionAlert 
        triggered={uncertainty.triggerReflexion} 
        reason={uncertainty.reflexionReason} 
      />

      {/* Main Metrics */}
      <div className="space-y-3 mt-4">
        <EntropyGauge
          value={uncertainty.semanticEntropy}
          label="Semantic Entropy"
          color={isHighUncertainty ? 'amber' : 'emerald'}
          icon={Activity}
          description="Measures diversity of meaning across generated samples. Higher = more uncertain."
        />
        
        <EntropyGauge
          value={uncertainty.surpriseScore}
          label="Surprise Score"
          color={isHighSurprise ? 'red' : 'violet'}
          icon={Sparkles}
          description="How unexpected the outputs are compared to the dominant cluster."
        />
        
        <EntropyGauge
          value={uncertainty.sampleAgreement}
          label="Sample Agreement"
          color="cyan"
          icon={CheckCircle2}
          description="How much the generated samples agree with each other."
        />
      </div>

      {/* Confidence Interval */}
      <div className="mt-4">
        <ConfidenceInterval
          interval={uncertainty.confidenceInterval}
          value={uncertainty.semanticEntropy}
        />
      </div>

      {/* Cluster Distribution */}
      <div className="mt-4">
        <ClusterDistribution
          samples={samples}
          clusterCount={uncertainty.clusterCount}
        />
      </div>

      {/* Sample Viewer */}
      <div className="mt-4">
        <SampleViewer samples={samples} selectedResponse={response} />
      </div>

      {/* Stats Footer */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{samples.length} samples</span>
          <span>{processingTimeMs}ms</span>
          <span>{tokensUsed.toLocaleString()} tokens</span>
        </div>
        {onRecompute && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecompute}
            disabled={isComputing}
            className="h-6 text-[10px]"
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', isComputing && 'animate-spin')} />
            Recompute
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

export default UncertaintyMetricsPanel;
