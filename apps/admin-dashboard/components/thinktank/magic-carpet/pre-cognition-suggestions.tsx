'use client';

/**
 * Pre-Cognition Suggestions
 * 
 * "Radiant answers before you ask. By the time you reach for a button, 
 * Radiant has already built it in the background. It's not just fast; 
 * it's anticipatory."
 * 
 * Shows predicted next actions that are already pre-computed.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Brain,
  Clock,
  Check,
  X,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';

// Types
interface Prediction {
  id: string;
  intent: string;
  prompt: string;
  confidence: number;
  isReady: boolean;
  computeTimeMs?: number;
  estimatedLatencySavedMs?: number;
  category: 'action' | 'navigation' | 'creation' | 'modification';
}

interface PreCognitionSuggestionsProps {
  predictions: Prediction[];
  telepathyScore: number;
  isActive?: boolean;
  onSelectPrediction?: (prediction: Prediction) => void;
  onDismiss?: (predictionId: string) => void;
  onToggleVisibility?: () => void;
  className?: string;
}

// Category icons and colors
const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  action: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  navigation: { icon: ChevronRight, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  creation: { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  modification: { icon: Lightbulb, color: 'text-green-500', bg: 'bg-green-500/10' },
};

export function PreCognitionSuggestions({
  predictions,
  telepathyScore,
  isActive = true,
  onSelectPrediction,
  onDismiss,
  onToggleVisibility: _onToggleVisibility,
  className,
}: PreCognitionSuggestionsProps) {
  void _onToggleVisibility; // Reserved for visibility toggle
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Calculate average confidence
  const avgConfidence = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
    : 0;

  // Ready predictions
  const readyCount = predictions.filter(p => p.isReady).length;

  if (!isActive || predictions.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          'bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-cyan-500/5',
          'border border-cyan-500/20 rounded-xl',
          'backdrop-blur-sm shadow-lg',
          'overflow-hidden',
          className
        )}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="h-5 w-5 text-cyan-500" />
              {isActive && (
                <motion.div
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2">
                Pre-Cognition
                <Badge variant="outline" className="text-xs gap-1 border-cyan-500/30">
                  <Sparkles className="h-3 w-3 text-cyan-500" />
                  {Math.round(telepathyScore * 100)}% telepathy
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                {readyCount} of {predictions.length} predictions ready
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Telepathy Score Bar */}
        <div className="px-4 py-2 border-b border-cyan-500/10">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Telepathy Accuracy</span>
            <span className={cn(
              'font-medium',
              telepathyScore > 0.7 && 'text-green-500',
              telepathyScore > 0.4 && telepathyScore <= 0.7 && 'text-amber-500',
              telepathyScore <= 0.4 && 'text-red-500',
            )}>
              {Math.round(telepathyScore * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${telepathyScore * 100}%` }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
        </div>

        {/* Predictions List */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              className="p-3 space-y-2"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {predictions.slice(0, 5).map((prediction, index) => {
                const config = CATEGORY_CONFIG[prediction.category] || CATEGORY_CONFIG.action;
                const Icon = config.icon;
                const isHovered = hoveredId === prediction.id;

                return (
                  <motion.div
                    key={prediction.id}
                    className={cn(
                      'relative flex items-center gap-3 p-3 rounded-lg',
                      'border transition-all cursor-pointer',
                      'hover:border-cyan-500/50',
                      prediction.isReady 
                        ? 'border-cyan-500/30 bg-cyan-500/5' 
                        : 'border-border/50 bg-muted/30',
                      isHovered && 'ring-1 ring-cyan-500/30'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    onMouseEnter={() => setHoveredId(prediction.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectPrediction?.(prediction)}
                  >
                    {/* Ready Indicator */}
                    {prediction.isReady && (
                      <motion.div
                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}

                    {/* Category Icon */}
                    <div className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      config.bg
                    )}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {prediction.prompt}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(prediction.confidence * 100)}% likely
                        </span>
                        {prediction.isReady && prediction.estimatedLatencySavedMs && (
                          <span className="text-xs text-cyan-500 flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {prediction.estimatedLatencySavedMs}ms saved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {prediction.isReady ? (
                        <Badge variant="secondary" className="text-xs gap-1 bg-cyan-500/10 text-cyan-500">
                          <Check className="h-3 w-3" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Clock className="h-3 w-3" />
                          Building
                        </Badge>
                      )}

                      {/* Dismiss */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss?.(prediction.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Hover Arrow */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          className="absolute right-3"
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                        >
                          <ChevronRight className="h-4 w-4 text-cyan-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Stats */}
        <div className="px-4 py-2 border-t border-cyan-500/10 bg-cyan-500/5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Avg confidence: <span className="font-medium text-foreground">{Math.round(avgConfidence * 100)}%</span>
              </span>
              <span className="text-muted-foreground">
                Ready: <span className="font-medium text-cyan-500">{readyCount}/{predictions.length}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Learning from your patterns</span>
            </div>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
