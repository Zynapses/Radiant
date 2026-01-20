'use client';

/**
 * Polymorphic View Router for Think Tank Consumer App
 * 
 * The UI physically transforms based on:
 * - Task Complexity → terminal (Sniper) vs mindmap/canvas (War Room)
 * - Domain Hint → Compliance views for medical/financial/legal
 * - Advanced Mode → Shows/hides power features
 * 
 * "Chat becomes App. App becomes whatever you need."
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Users, DollarSign, ArrowUp, Terminal, Map, FileCode, 
  LayoutDashboard, MessageSquare, HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui-store';

export type ViewType = 
  | 'chat'
  | 'terminal'
  | 'canvas'
  | 'dashboard'
  | 'diff_editor'
  | 'decision_cards';

export type ExecutionMode = 'sniper' | 'war_room';

export type DomainHint = 'medical' | 'financial' | 'legal' | 'technical' | 'creative' | 'general';

export interface ViewState {
  viewType: ViewType;
  executionMode: ExecutionMode;
  dataPayload: Record<string, unknown>;
  rationale?: string;
  estimatedCostCents?: number;
  domainHint?: DomainHint;
}

export interface ViewComponentProps {
  data: Record<string, unknown>;
  mode: ExecutionMode;
  domainHint?: DomainHint;
  onUpdateView: (state: Partial<ViewState>) => void;
  onEscalate: (reason: string, context?: string) => void;
}

const VIEW_CONFIG: Record<ViewType, { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  color: string;
}> = {
  chat: { 
    icon: MessageSquare, 
    label: 'Conversation', 
    description: 'Multi-turn dialogue',
    color: 'text-slate-400',
  },
  terminal: { 
    icon: Terminal, 
    label: 'Command Center', 
    description: 'Fast execution mode',
    color: 'text-green-400',
  },
  canvas: { 
    icon: Map, 
    label: 'Infinite Canvas', 
    description: 'Visual exploration',
    color: 'text-blue-400',
  },
  dashboard: { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    description: 'Analytics view',
    color: 'text-cyan-400',
  },
  diff_editor: { 
    icon: FileCode, 
    label: 'Verification', 
    description: 'Split-screen validation',
    color: 'text-orange-400',
  },
  decision_cards: { 
    icon: HelpCircle, 
    label: 'Mission Control', 
    description: 'Human-in-the-loop',
    color: 'text-yellow-400',
  },
};

export interface ViewRouterProps {
  initialView?: ViewType;
  initialMode?: ExecutionMode;
  onViewChange?: (viewState: ViewState) => void;
  onEscalate?: (reason: string, context?: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function ViewRouter({ 
  initialView = 'chat', 
  initialMode = 'sniper',
  onViewChange,
  onEscalate,
  className,
  children,
}: ViewRouterProps) {
  const { advancedMode } = useUIStore();
  
  const [viewState, setViewState] = useState<ViewState>({
    viewType: initialView,
    executionMode: initialMode,
    dataPayload: {},
    estimatedCostCents: initialMode === 'sniper' ? 1 : 50,
  });
  
  const [isTransitioning, setIsTransitioning] = useState(false);

  const updateViewState = useCallback((newState: Partial<ViewState>) => {
    setIsTransitioning(true);
    
    setViewState(prev => {
      const updated = { ...prev, ...newState };
      onViewChange?.(updated);
      return updated;
    });
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [onViewChange]);

  const handleModeToggle = useCallback((mode: ExecutionMode) => {
    updateViewState({
      executionMode: mode,
      estimatedCostCents: mode === 'sniper' ? 1 : 50,
      rationale: `Switched to ${mode === 'sniper' ? 'Sniper' : 'War Room'} mode`,
    });
  }, [updateViewState]);

  const handleEscalate = useCallback((reason: string, additionalContext?: string) => {
    updateViewState({
      executionMode: 'war_room',
      estimatedCostCents: 50,
      rationale: `Escalated: ${reason}`,
    });
    
    onEscalate?.(reason, additionalContext);
  }, [updateViewState, onEscalate]);

  const CurrentIcon = VIEW_CONFIG[viewState.viewType].icon;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Mode Indicator Bar - Only visible in Advanced Mode */}
      <AnimatePresence>
        {advancedMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {/* Execution Mode Badge */}
                <motion.div
                  layout
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    viewState.executionMode === 'sniper' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                  )}
                >
                  {viewState.executionMode === 'sniper' ? (
                    <><Zap className="w-3 h-3" /> Sniper</>
                  ) : (
                    <><Users className="w-3 h-3" /> War Room</>
                  )}
                </motion.div>
                
                {/* View Type Badge */}
                <Badge variant="outline" className={cn("gap-1.5 text-xs", VIEW_CONFIG[viewState.viewType].color)}>
                  <CurrentIcon className="w-3 h-3" />
                  {VIEW_CONFIG[viewState.viewType].label}
                </Badge>
                
                {/* Cost Badge */}
                {viewState.estimatedCostCents !== undefined && (
                  <Badge variant="outline" className="gap-1 text-[10px] text-slate-500">
                    <DollarSign className="w-2.5 h-2.5" />
                    {(viewState.estimatedCostCents / 100).toFixed(2)}
                  </Badge>
                )}
                
                {/* Domain Hint */}
                {viewState.domainHint && viewState.domainHint !== 'general' && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px]",
                      viewState.domainHint === 'medical' && 'border-red-500/30 text-red-400',
                      viewState.domainHint === 'financial' && 'border-yellow-500/30 text-yellow-400',
                      viewState.domainHint === 'legal' && 'border-blue-500/30 text-blue-400',
                      viewState.domainHint === 'technical' && 'border-cyan-500/30 text-cyan-400',
                      viewState.domainHint === 'creative' && 'border-pink-500/30 text-pink-400',
                    )}
                  >
                    {viewState.domainHint}
                  </Badge>
                )}
              </div>
              
              {/* Gearbox Controls */}
              <div className="flex items-center gap-2">
                {/* Mode Toggle */}
                <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-6 px-2 gap-1 text-[10px] rounded-md",
                      viewState.executionMode === 'sniper' && 'bg-green-500/20 text-green-400'
                    )}
                    onClick={() => handleModeToggle('sniper')}
                  >
                    <Zap className="w-3 h-3" /> Fast
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-6 px-2 gap-1 text-[10px] rounded-md",
                      viewState.executionMode === 'war_room' && 'bg-violet-500/20 text-violet-400'
                    )}
                    onClick={() => handleModeToggle('war_room')}
                  >
                    <Users className="w-3 h-3" /> Deep
                  </Button>
                </div>
                
                {/* Escalate Button */}
                {viewState.executionMode === 'sniper' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1 text-[10px] text-violet-400 hover:bg-violet-500/10"
                    onClick={() => handleEscalate('need_depth', 'User requested deeper analysis')}
                  >
                    <ArrowUp className="w-3 h-3" /> Escalate
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Dynamic View Area */}
      <motion.div
        className={cn(
          "flex-1 overflow-hidden transition-opacity duration-300",
          isTransitioning && "opacity-70"
        )}
        layout
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * ViewMorphTransition - Animated transition between view types
 */
export function ViewMorphTransition({ 
  children, 
  viewType 
}: { 
  children: React.ReactNode; 
  viewType: ViewType;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewType}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -10 }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 25,
          duration: 0.3 
        }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
