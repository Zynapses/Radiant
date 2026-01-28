'use client';

/**
 * Polymorphic View Router (PROMPT-41)
 * 
 * Routes UI rendering based on Economic Governor decisions.
 * The UI physically morphs based on:
 * - Task Complexity → terminal_simple (Sniper) vs mindmap/diff_editor (War Room)
 * - Domain Hint → Compliance views for medical/financial/legal
 * - Drive Profile → Scout (exploration), Sage (verification), Sniper (execution)
 * 
 * Integrates with existing Think Tank Agentic Morphing Interface.
 */

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Users, DollarSign, ArrowUp, Terminal, Map, FileCode, LayoutDashboard, MessageSquare, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Import types from shared package
import type { 
  ViewType, 
  ExecutionMode, 
  ViewState as SharedViewState,
  PolymorphicRouteDecision as SharedPolymorphicRouteDecision
} from '@radiant/shared';

// Import view components
import { TerminalView } from './views/terminal-view';
import { MindMapView } from './views/mindmap-view';
import { DiffEditorView } from './views/diff-editor-view';
import { DashboardView } from './views/dashboard-view';
import { DecisionCardsView } from './views/decision-cards-view';
import { ChatView } from './views/chat-view';

// ============================================================================
// Types - Re-export from shared for component consumers
// ============================================================================

export type { ViewType, ExecutionMode, DomainHint } from '@radiant/shared';

export interface ViewState extends SharedViewState {}

export interface PolymorphicRouteDecision extends SharedPolymorphicRouteDecision {}

export interface ViewRouterProps {
  projectId: string;
  sessionId: string;
  initialView?: ViewType;
  initialMode?: ExecutionMode;
  onEscalate?: (reason: string, context?: string) => void;
  onViewChange?: (viewState: ViewState) => void;
  className?: string;
}

// ============================================================================
// View Icons & Labels
// ============================================================================

const VIEW_CONFIG: Record<ViewType, { icon: React.ElementType; label: string; description: string }> = {
  terminal_simple: { 
    icon: Terminal, 
    label: 'Command Center', 
    description: 'Fast execution mode - quick commands and lookups' 
  },
  mindmap: { 
    icon: Map, 
    label: 'Infinite Canvas', 
    description: 'Research and exploration with visual mapping' 
  },
  diff_editor: { 
    icon: FileCode, 
    label: 'Verification View', 
    description: 'Split-screen validation with source attribution' 
  },
  dashboard: { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    description: 'Analytics and metrics visualization' 
  },
  decision_cards: { 
    icon: HelpCircle, 
    label: 'Mission Control', 
    description: 'Human-in-the-loop decision interface' 
  },
  chat: { 
    icon: MessageSquare, 
    label: 'Conversation', 
    description: 'Standard multi-agent conversation' 
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function ViewRouter({ 
  projectId, 
  sessionId,
  initialView = 'chat', 
  initialMode = 'sniper',
  onEscalate,
  onViewChange,
  className
}: ViewRouterProps) {
  const [viewState, setViewState] = useState<ViewState>({
    viewType: initialView,
    executionMode: initialMode,
    dataPayload: {},
    estimatedCostCents: initialMode === 'sniper' ? 1 : 50,
  });
  
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showGearbox, _setShowGearbox] = useState(true);
  void _setShowGearbox; // Reserved for gearbox toggle

  // Handle view state changes
  const updateViewState = useCallback((newState: Partial<ViewState>) => {
    setIsTransitioning(true);
    
    setViewState(prev => {
      const updated = { ...prev, ...newState };
      
      // Show toast for view changes with rationale
      if (newState.rationale && newState.viewType !== prev.viewType) {
        toast.info(newState.rationale, {
          description: `Switching to ${VIEW_CONFIG[updated.viewType].label}`,
          duration: 3000,
        });
      }
      
      onViewChange?.(updated);
      return updated;
    });
    
    // Animation delay
    setTimeout(() => setIsTransitioning(false), 300);
  }, [onViewChange]);

  // Handle mode toggle (Gearbox)
  const handleModeToggle = useCallback((mode: ExecutionMode) => {
    updateViewState({
      executionMode: mode,
      estimatedCostCents: mode === 'sniper' ? 1 : 50,
      rationale: `Manual switch to ${mode === 'sniper' ? 'Sniper' : 'War Room'} mode`,
    });
  }, [updateViewState]);

  // Handle escalation from Sniper to War Room
  const handleEscalate = useCallback((reason: string, additionalContext?: string) => {
    toast.info('Escalating to War Room...', {
      description: reason,
    });
    
    updateViewState({
      executionMode: 'war_room',
      estimatedCostCents: 50,
      rationale: `Escalated: ${reason}`,
    });
    
    onEscalate?.(reason, additionalContext);
  }, [updateViewState, onEscalate]);

  // Get the appropriate view component
  const ViewComponent = {
    terminal_simple: TerminalView,
    mindmap: MindMapView,
    diff_editor: DiffEditorView,
    dashboard: DashboardView,
    decision_cards: DecisionCardsView,
    chat: ChatView,
  }[viewState.viewType];

  const CurrentIcon = VIEW_CONFIG[viewState.viewType].icon;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* ================================================================== */}
      {/* Mode Indicator Bar (The Gearbox) */}
      {/* ================================================================== */}
      {showGearbox && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            {/* Execution Mode Badge */}
            <Badge 
              variant="outline"
              className={cn(
                "gap-1.5 transition-all duration-300",
                viewState.executionMode === 'sniper' 
                  ? 'bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400' 
                  : 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400'
              )}
            >
              {viewState.executionMode === 'sniper' ? (
                <><Zap className="w-3 h-3" /> Sniper Mode</>
              ) : (
                <><Users className="w-3 h-3" /> War Room</>
              )}
            </Badge>
            
            {/* View Type Badge */}
            <Badge variant="secondary" className="gap-1.5">
              <CurrentIcon className="w-3 h-3" />
              {VIEW_CONFIG[viewState.viewType].label}
            </Badge>
            
            {/* Cost Badge */}
            {viewState.estimatedCostCents !== undefined && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <DollarSign className="w-3 h-3" />
                {viewState.estimatedCostCents < 100 
                  ? `$${(viewState.estimatedCostCents / 100).toFixed(2)}`
                  : `$${(viewState.estimatedCostCents / 100).toFixed(2)}`
                }
              </Badge>
            )}
            
            {/* Domain Hint Badge */}
            {viewState.domainHint && viewState.domainHint !== 'general' && (
              <Badge 
                variant="outline" 
                className={cn(
                  viewState.domainHint === 'medical' && 'border-red-500/30 text-red-600 dark:text-red-400',
                  viewState.domainHint === 'financial' && 'border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
                  viewState.domainHint === 'legal' && 'border-blue-500/30 text-blue-600 dark:text-blue-400',
                )}
              >
                {viewState.domainHint.charAt(0).toUpperCase() + viewState.domainHint.slice(1)}
              </Badge>
            )}
          </div>
          
          {/* Gearbox Controls */}
          <div className="flex items-center gap-2">
            {/* Mode Toggle Buttons */}
            <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
              <Button
                variant={viewState.executionMode === 'sniper' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  "h-7 px-2.5 gap-1 text-xs",
                  viewState.executionMode === 'sniper' && 'bg-green-600 hover:bg-green-700 text-white'
                )}
                onClick={() => handleModeToggle('sniper')}
              >
                <Zap className="w-3 h-3" /> Sniper
              </Button>
              <Button
                variant={viewState.executionMode === 'war_room' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  "h-7 px-2.5 gap-1 text-xs",
                  viewState.executionMode === 'war_room' && 'bg-purple-600 hover:bg-purple-700 text-white'
                )}
                onClick={() => handleModeToggle('war_room')}
              >
                <Users className="w-3 h-3" /> War Room
              </Button>
            </div>
            
            {/* Escalate Button (only in Sniper mode) */}
            {viewState.executionMode === 'sniper' && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 gap-1 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
                onClick={() => handleEscalate('insufficient_depth', 'User requested deeper analysis')}
              >
                <ArrowUp className="w-3 h-3" /> Escalate
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* ================================================================== */}
      {/* Dynamic View Area */}
      {/* ================================================================== */}
      <div className={cn(
        "flex-1 overflow-hidden transition-opacity duration-300",
        isTransitioning && "opacity-50"
      )}>
        <ViewComponent 
          data={viewState.dataPayload} 
          projectId={projectId}
          sessionId={sessionId}
          mode={viewState.executionMode}
          domainHint={viewState.domainHint}
          onUpdateView={updateViewState}
          onEscalate={handleEscalate}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Export types for use in view components
// ============================================================================

export interface ViewComponentProps {
  data: Record<string, unknown>;
  projectId: string;
  sessionId: string;
  mode: ExecutionMode;
  domainHint?: string;
  onUpdateView: (state: Partial<ViewState>) => void;
  onEscalate: (reason: string, context?: string) => void;
}
