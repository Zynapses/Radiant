'use client';

/**
 * Quantum Split View
 * 
 * "Indecision kills speed. Why choose one strategy? Radiant lets you split 
 * the timeline. Run 'Aggressive Plan' in the left window and 'Conservative Plan' 
 * in the right. Watch them compete side-by-side, then collapse reality into the winner."
 * 
 * Side-by-side comparison of parallel realities.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  GitMerge,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  MousePointer,
  Clock,
  DollarSign,
  Sparkles,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Archive,
  Trash2,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

// Types
interface QuantumBranch {
  id: string;
  name: string;
  description?: string;
  color: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  metrics: {
    completionPercent: number;
    estimatedCost: number;
    interactions: number;
    timeSpent: number;
  };
  highlights: string[];
  warnings: string[];
  content?: React.ReactNode;
}

interface QuantumSplitViewProps {
  branches: QuantumBranch[];
  activeBranchId?: string;
  viewMode?: 'split' | 'tabs' | 'carousel';
  onSelectBranch?: (branchId: string) => void;
  onCollapse?: (winnerId: string, archiveLoser?: boolean) => void;
  onArchive?: (branchId: string) => void;
  onDelete?: (branchId: string) => void;
  className?: string;
}

// Branch colors
const BRANCH_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  blue: { 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/50', 
    text: 'text-blue-500',
    glow: 'shadow-blue-500/20',
  },
  purple: { 
    bg: 'bg-purple-500/10', 
    border: 'border-purple-500/50', 
    text: 'text-purple-500',
    glow: 'shadow-purple-500/20',
  },
  green: { 
    bg: 'bg-green-500/10', 
    border: 'border-green-500/50', 
    text: 'text-green-500',
    glow: 'shadow-green-500/20',
  },
  amber: { 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/50', 
    text: 'text-amber-500',
    glow: 'shadow-amber-500/20',
  },
  pink: { 
    bg: 'bg-pink-500/10', 
    border: 'border-pink-500/50', 
    text: 'text-pink-500',
    glow: 'shadow-pink-500/20',
  },
  cyan: { 
    bg: 'bg-cyan-500/10', 
    border: 'border-cyan-500/50', 
    text: 'text-cyan-500',
    glow: 'shadow-cyan-500/20',
  },
};

export function QuantumSplitView({
  branches,
  activeBranchId,
  viewMode = 'split',
  onSelectBranch,
  onCollapse,
  onArchive,
  onDelete,
  className,
}: QuantumSplitViewProps) {
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCollapseConfirm, setShowCollapseConfirm] = useState<string | null>(null);

  // Get the best performing branch
  const getBestBranch = useCallback(() => {
    return branches.reduce((best, current) => {
      if (!best) return current;
      if (current.metrics.completionPercent > best.metrics.completionPercent) return current;
      if (current.metrics.interactions > best.metrics.interactions) return current;
      return best;
    }, branches[0]);
  }, [branches]);

  const bestBranch = getBestBranch();

  // Handle collapse
  const handleCollapse = useCallback((winnerId: string, archive: boolean = true) => {
    onCollapse?.(winnerId, archive);
    setShowCollapseConfirm(null);
  }, [onCollapse]);

  // Render a single branch card
  const renderBranchCard = (branch: QuantumBranch, index: number) => {
    const colorConfig = BRANCH_COLORS[branch.color] || BRANCH_COLORS.blue;
    const isBest = branch.id === bestBranch?.id && branches.length > 1;
    const isFocused = focusedBranchId === branch.id;
    const isActive = activeBranchId === branch.id;

    return (
      <motion.div
        key={branch.id}
        className={cn(
          'relative flex flex-col h-full',
          'border rounded-xl',
          'bg-background/50 backdrop-blur-sm',
          colorConfig.border,
          isFocused && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          isActive && colorConfig.glow,
          'shadow-lg'
        )}
        initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 20, delay: index * 0.1 }}
        onMouseEnter={() => setFocusedBranchId(branch.id)}
        onMouseLeave={() => setFocusedBranchId(null)}
      >
        {/* Branch Header */}
        <div className={cn(
          'flex items-center justify-between px-4 py-3',
          'border-b',
          colorConfig.border
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-3 h-3 rounded-full',
              branch.status === 'active' && 'animate-pulse',
              branch.color === 'blue' && 'bg-blue-500',
              branch.color === 'purple' && 'bg-purple-500',
              branch.color === 'green' && 'bg-green-500',
              branch.color === 'amber' && 'bg-amber-500',
              branch.color === 'pink' && 'bg-pink-500',
              branch.color === 'cyan' && 'bg-cyan-500',
            )} />
            <div>
              <h3 className="font-semibold text-sm">{branch.name}</h3>
              {branch.description && (
                <p className="text-xs text-muted-foreground">{branch.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBest && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Trophy className="h-3 w-3 text-amber-500" />
                Leading
              </Badge>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelectBranch?.(branch.id)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Focus on this reality
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(branch.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy branch ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchive?.(branch.id)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive to Dream Memory
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete?.(branch.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete branch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className={cn('px-4 py-2 border-b', colorConfig.border, colorConfig.bg)}>
          <div className="grid grid-cols-4 gap-4 text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="text-lg font-bold">{branch.metrics.completionPercent}%</p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Completion progress</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="text-lg font-bold">${branch.metrics.estimatedCost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Cost</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Estimated API cost</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="text-lg font-bold">{branch.metrics.interactions}</p>
                  <p className="text-xs text-muted-foreground">Interactions</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>User interactions in this branch</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="text-lg font-bold">{Math.round(branch.metrics.timeSpent / 60)}m</p>
                  <p className="text-xs text-muted-foreground">Time</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Time spent in this reality</TooltipContent>
            </Tooltip>
          </div>

          <Progress 
            value={branch.metrics.completionPercent} 
            className="h-1.5 mt-2"
          />
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 p-4">
          {branch.content ? (
            branch.content
          ) : (
            <div className="space-y-3">
              {/* Highlights */}
              {branch.highlights.length > 0 && (
                <div className="space-y-1">
                  {branch.highlights.map((highlight, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {branch.warnings.length > 0 && (
                <div className="space-y-1 mt-2">
                  {branch.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-amber-600">
                      <span>⚠</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Collapse Button */}
        <div className={cn('p-3 border-t', colorConfig.border)}>
          {showCollapseConfirm === branch.id ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => handleCollapse(branch.id, true)}
              >
                <Trophy className="h-4 w-4 mr-1" />
                Keep & Archive Others
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCollapseConfirm(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowCollapseConfirm(branch.id)}
            >
              <Trophy className={cn('h-4 w-4', colorConfig.text)} />
              Keep This Reality
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          'relative',
          isFullscreen && 'fixed inset-0 z-50 bg-background p-4',
          className
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Quantum Futures</h2>
            </div>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {branches.length} parallel realities
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Split View */}
        {viewMode === 'split' && branches.length === 2 && (
          <ResizablePanelGroup direction="horizontal" className="min-h-[500px]">
            <ResizablePanel defaultSize={50} minSize={30}>
              {renderBranchCard(branches[0], 0)}
            </ResizablePanel>
            
            <ResizableHandle className="w-2 bg-border/50 hover:bg-primary/20 transition-colors">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </ResizableHandle>
            
            <ResizablePanel defaultSize={50} minSize={30}>
              {renderBranchCard(branches[1], 1)}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* Grid View for more than 2 branches */}
        {(viewMode !== 'split' || branches.length !== 2) && (
          <div className={cn(
            'grid gap-4',
            branches.length === 1 && 'grid-cols-1',
            branches.length === 2 && 'grid-cols-2',
            branches.length === 3 && 'grid-cols-3',
            branches.length >= 4 && 'grid-cols-2 lg:grid-cols-4'
          )}>
            {branches.map((branch, index) => (
              <div key={branch.id} className="min-h-[400px]">
                {renderBranchCard(branch, index)}
              </div>
            ))}
          </div>
        )}

        {/* Comparison Summary */}
        {branches.length > 1 && (
          <motion.div
            className="mt-4 p-4 rounded-lg border bg-muted/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <GitMerge className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {bestBranch?.name} is currently leading
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Based on completion progress and user interactions
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => bestBranch && handleCollapse(bestBranch.id, true)}
              >
                <Trophy className="h-4 w-4" />
                Collapse to Winner
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
