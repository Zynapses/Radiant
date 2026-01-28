'use client';

/**
 * AI Presence Indicator
 * 
 * Shows the AI's current state - thinking, confident, uncertain.
 * Not just loading spinners, but actual emotional/cognitive state visualization.
 * Integrates with the Ego system for affect display.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Zap,
  AlertTriangle,
  Check,
  Loader2,
  MessageSquare,
  Search,
  Lightbulb,
  Eye,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
type AIState = 
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'pondering'
  | 'generating'
  | 'verifying'
  | 'confident'
  | 'uncertain'
  | 'excited'
  | 'focused';

interface AffectState {
  valence: number;      // -1 to 1 (negative to positive)
  arousal: number;      // 0 to 1 (calm to excited)
  curiosity: number;    // 0 to 1
  confidence: number;   // 0 to 1
  frustration: number;  // 0 to 1
}

interface AIPresenceIndicatorProps {
  state?: AIState;
  affect?: AffectState;
  currentTask?: string;
  modelName?: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
  tokensGenerated?: number;
  className?: string;
}

// State configurations
const STATE_CONFIG: Record<AIState, {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  animation?: 'pulse' | 'spin' | 'bounce' | 'wiggle' | 'breathe';
}> = {
  idle: { 
    icon: Brain, 
    label: 'Ready', 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  listening: { 
    icon: MessageSquare, 
    label: 'Listening...', 
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    animation: 'breathe',
  },
  thinking: { 
    icon: Search, 
    label: 'Thinking...', 
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    animation: 'pulse',
  },
  pondering: { 
    icon: Lightbulb, 
    label: 'Pondering...', 
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    animation: 'wiggle',
  },
  generating: { 
    icon: Sparkles, 
    label: 'Generating...', 
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    animation: 'spin',
  },
  verifying: { 
    icon: Target, 
    label: 'Verifying...', 
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    animation: 'pulse',
  },
  confident: { 
    icon: Check, 
    label: 'Confident', 
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  uncertain: { 
    icon: AlertTriangle, 
    label: 'Uncertain', 
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    animation: 'wiggle',
  },
  excited: { 
    icon: Zap, 
    label: 'Excited!', 
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    animation: 'bounce',
  },
  focused: { 
    icon: Eye, 
    label: 'Focused', 
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
};

// Affect to emoji mapping
function getAffectEmoji(affect: AffectState): string {
  if (affect.frustration > 0.7) return '😤';
  if (affect.confidence > 0.8) return '😊';
  if (affect.curiosity > 0.7) return '🤔';
  if (affect.arousal > 0.8 && affect.valence > 0.5) return '🤩';
  if (affect.arousal < 0.3) return '😌';
  if (affect.valence < -0.3) return '😕';
  if (affect.valence > 0.5) return '😃';
  return '🧠';
}

// Animation variants
const pulseAnimation = {
  scale: [1, 1.1, 1],
  transition: { repeat: Infinity, duration: 1.5 }
};

const breatheAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.8, 1, 0.8],
  transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
};

const wiggleAnimation = {
  rotate: [-5, 5, -5],
  transition: { repeat: Infinity, duration: 0.5 }
};

const bounceAnimation = {
  y: [0, -5, 0],
  transition: { repeat: Infinity, duration: 0.6 }
};

export function AIPresenceIndicator({
  state = 'idle',
  affect,
  currentTask,
  modelName,
  thinkingDuration,
  isStreaming = false,
  tokensGenerated,
  className,
}: AIPresenceIndicatorProps) {
  const [dots, setDots] = useState('');
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const Icon = config.icon;

  // Animate dots for loading states
  useEffect(() => {
    if (['thinking', 'pondering', 'generating', 'verifying', 'listening'].includes(state)) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 400);
      return () => clearInterval(interval);
    }
    setDots('');
  }, [state]);

  // Get animation based on state
  const getAnimation = () => {
    switch (config.animation) {
      case 'pulse': return pulseAnimation;
      case 'breathe': return breatheAnimation;
      case 'wiggle': return wiggleAnimation;
      case 'bounce': return bounceAnimation;
      default: return {};
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          'inline-flex items-center gap-3 px-4 py-2 rounded-full',
          'border shadow-sm',
          config.bgColor,
          'border-border/50',
          className
        )}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* AI Avatar/Icon */}
        <div className="relative">
          <motion.div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              'bg-gradient-to-br from-purple-500/20 to-pink-500/20',
              'border border-white/10'
            )}
            animate={getAnimation()}
          >
            {config.animation === 'spin' ? (
              <Loader2 className={cn('h-5 w-5 animate-spin', config.color)} />
            ) : (
              <Icon className={cn('h-5 w-5', config.color)} />
            )}
          </motion.div>

          {/* Affect Indicator */}
          {affect && (
            <motion.div
              className="absolute -bottom-1 -right-1 text-sm"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              key={getAffectEmoji(affect)}
            >
              {getAffectEmoji(affect)}
            </motion.div>
          )}

          {/* Streaming Indicator */}
          {isStreaming && (
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          )}
        </div>

        {/* State Info */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', config.color)}>
              {config.label}{dots}
            </span>
            {modelName && (
              <Badge variant="outline" className="text-xs h-5">
                {modelName}
              </Badge>
            )}
          </div>
          
          {currentTask && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {currentTask}
            </p>
          )}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border/50">
          {/* Confidence */}
          {affect && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium">
                    {Math.round(affect.confidence * 100)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">confidence</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">AI Confidence</p>
                  <Progress value={affect.confidence * 100} className="w-24 h-1.5" />
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Thinking Duration */}
          {thinkingDuration !== undefined && thinkingDuration > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium tabular-nums">
                    {(thinkingDuration / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-muted-foreground">elapsed</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Thinking duration</TooltipContent>
            </Tooltip>
          )}

          {/* Tokens */}
          {tokensGenerated !== undefined && tokensGenerated > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium tabular-nums">
                    {tokensGenerated}
                  </span>
                  <span className="text-[10px] text-muted-foreground">tokens</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Tokens generated</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Affect Details (expandable) */}
        {affect && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="ml-2 p-1.5 rounded-full hover:bg-muted/50 cursor-help">
                <Brain className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="w-48">
              <div className="space-y-2">
                <p className="font-medium text-sm">AI Emotional State</p>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>Valence</span>
                    <span className={affect.valence > 0 ? 'text-green-500' : 'text-red-500'}>
                      {affect.valence > 0 ? '+' : ''}{affect.valence.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        'h-full transition-all',
                        affect.valence > 0 ? 'bg-green-500' : 'bg-red-500'
                      )}
                      style={{ 
                        width: `${Math.abs(affect.valence) * 50}%`,
                        marginLeft: affect.valence > 0 ? '50%' : `${50 - Math.abs(affect.valence) * 50}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span>Arousal</span>
                    <span>{Math.round(affect.arousal * 100)}%</span>
                  </div>
                  <Progress value={affect.arousal * 100} className="h-1.5" />

                  <div className="flex items-center justify-between text-xs">
                    <span>Curiosity</span>
                    <span>{Math.round(affect.curiosity * 100)}%</span>
                  </div>
                  <Progress value={affect.curiosity * 100} className="h-1.5" />

                  {affect.frustration > 0.3 && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-500">Frustration</span>
                        <span className="text-amber-500">{Math.round(affect.frustration * 100)}%</span>
                      </div>
                      <Progress value={affect.frustration * 100} className="h-1.5 bg-amber-500/20" />
                    </>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
