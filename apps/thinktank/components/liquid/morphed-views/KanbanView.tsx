'use client';

/**
 * Kanban View - Multi-Variant Implementation
 * 
 * Supports multiple Kanban frameworks:
 * - Standard: Traditional Kanban board
 * - Scrumban: Scrum structure + Kanban flow
 * - Enterprise: Hierarchical, multi-lane portfolio management
 * - Personal: Simple WIP limiting for individuals
 * - Pomodoro: Timer-integrated productivity Kanban
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, MoreVertical, GripVertical, Settings, BarChart3,
  Play, Pause, RotateCcw, Users, Target, Layers, Timer,
  ChevronDown, ChevronRight, Circle, Calendar, TrendingUp, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type KanbanVariant = 
  | 'standard' 
  | 'scrumban' 
  | 'enterprise' 
  | 'personal' 
  | 'pomodoro';

interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: string;
  points?: number;
  tags?: string[];
  subtasks?: { id: string; title: string; done: boolean }[];
  pomodorosCompleted?: number;
  pomodorosEstimated?: number;
  blockedBy?: string[];
  lane?: string; // For enterprise multi-lane
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  wipLimit?: number;
  color?: string;
}

interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  velocity?: number;
}

interface Lane {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
}

// ============================================================================
// Variant Configurations
// ============================================================================

const VARIANT_CONFIG: Record<KanbanVariant, {
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
}> = {
  standard: {
    label: 'Standard Kanban',
    icon: Layers,
    description: 'Traditional Kanban board with columns',
    color: 'text-blue-400',
  },
  scrumban: {
    label: 'Scrumban',
    icon: Target,
    description: 'Scrum sprints + Kanban continuous flow',
    color: 'text-green-400',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Users,
    description: 'Hierarchical multi-lane portfolio boards',
    color: 'text-purple-400',
  },
  personal: {
    label: 'Personal Kanban',
    icon: Circle,
    description: 'Simple WIP limiting for individuals',
    color: 'text-amber-400',
  },
  pomodoro: {
    label: 'Pomodoro Kanban',
    icon: Timer,
    description: 'Timer-integrated productivity board',
    color: 'text-red-400',
  },
};

// Default data for each variant
const getDefaultColumns = (variant: KanbanVariant): KanbanColumn[] => {
  switch (variant) {
    case 'personal':
      return [
        { id: 'todo', title: 'To Do', cards: [], wipLimit: undefined },
        { id: 'doing', title: 'Doing', cards: [], wipLimit: 3 },
        { id: 'done', title: 'Done', cards: [] },
      ];
    case 'scrumban':
      return [
        { id: 'backlog', title: 'Backlog', cards: [], color: 'bg-slate-500' },
        { id: 'ready', title: 'Ready', cards: [], wipLimit: 5, color: 'bg-blue-500' },
        { id: 'progress', title: 'In Progress', cards: [], wipLimit: 3, color: 'bg-amber-500' },
        { id: 'review', title: 'Review', cards: [], wipLimit: 2, color: 'bg-purple-500' },
        { id: 'done', title: 'Done', cards: [], color: 'bg-green-500' },
      ];
    case 'enterprise':
      return [
        { id: 'proposed', title: 'Proposed', cards: [], color: 'bg-slate-500' },
        { id: 'approved', title: 'Approved', cards: [], color: 'bg-blue-500' },
        { id: 'active', title: 'Active', cards: [], color: 'bg-amber-500' },
        { id: 'completed', title: 'Completed', cards: [], color: 'bg-green-500' },
      ];
    case 'pomodoro':
      return [
        { id: 'today', title: "Today's Focus", cards: [], wipLimit: 5 },
        { id: 'pomodoro', title: 'In Pomodoro', cards: [], wipLimit: 1 },
        { id: 'break', title: 'On Break', cards: [] },
        { id: 'completed', title: 'Completed', cards: [] },
      ];
    default:
      return [
        { id: 'todo', title: 'To Do', cards: [] },
        { id: 'progress', title: 'In Progress', cards: [] },
        { id: 'review', title: 'Review', cards: [] },
        { id: 'done', title: 'Done', cards: [] },
      ];
  }
};

const DEFAULT_LANES: Lane[] = [
  { id: 'strategic', name: 'Strategic Initiatives', color: 'bg-purple-500/20' },
  { id: 'operations', name: 'Operations', color: 'bg-blue-500/20' },
  { id: 'support', name: 'Support & Maintenance', color: 'bg-green-500/20' },
];

const DEFAULT_SPRINT: Sprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  startDate: '2026-01-20',
  endDate: '2026-02-03',
  goal: 'Complete MVP features',
  velocity: 21,
};

// ============================================================================
// Pomodoro Timer Hook
// ============================================================================

function usePomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      if (!isBreak) {
        setCompletedPomodoros(c => c + 1);
        setIsBreak(true);
        setTimeLeft(5 * 60); // 5 minute break
      } else {
        setIsBreak(false);
        setTimeLeft(25 * 60);
      }
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak]);

  const toggle = () => setIsRunning(!isRunning);
  const reset = () => {
    setIsRunning(false);
    setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
  };

  return { timeLeft, isRunning, isBreak, completedPomodoros, toggle, reset };
}

// ============================================================================
// Sub-Components
// ============================================================================

function VariantSelector({ 
  current, 
  onChange 
}: { 
  current: KanbanVariant; 
  onChange: (v: KanbanVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const config = VARIANT_CONFIG[current];
  const Icon = config.icon;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-2"
      >
        <Icon className={cn("h-4 w-4", config.color)} />
        {config.label}
        <ChevronDown className="h-3 w-3" />
      </Button>
      
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50"
          >
            {(Object.keys(VARIANT_CONFIG) as KanbanVariant[]).map((variant) => {
              const cfg = VARIANT_CONFIG[variant];
              const VIcon = cfg.icon;
              return (
                <button
                  key={variant}
                  onClick={() => { onChange(variant); setOpen(false); }}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors text-left",
                    current === variant && "bg-white/10"
                  )}
                >
                  <VIcon className={cn("h-5 w-5 mt-0.5", cfg.color)} />
                  <div>
                    <div className="text-sm font-medium text-white">{cfg.label}</div>
                    <div className="text-xs text-slate-400">{cfg.description}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PomodoroTimer({ timer }: { timer: ReturnType<typeof usePomodoroTimer> }) {
  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-lg",
      timer.isBreak ? "bg-green-500/20" : "bg-red-500/20"
    )}>
      <div className="text-2xl font-mono text-white">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={timer.toggle}>
          {timer.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={timer.reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <Badge variant="outline" className="text-xs">
        {timer.isBreak ? 'Break' : 'Focus'} • {timer.completedPomodoros} 🍅
      </Badge>
    </div>
  );
}

function SprintHeader({ sprint }: { sprint: Sprint }) {
  const daysLeft = Math.ceil(
    (new Date(sprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-green-500/10 border-b border-green-500/20">
      <div className="flex items-center gap-3">
        <Target className="h-5 w-5 text-green-400" />
        <div>
          <span className="font-medium text-white">{sprint.name}</span>
          <span className="text-xs text-slate-400 ml-2">• {sprint.goal}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">
          <Calendar className="h-4 w-4 inline mr-1" />
          {daysLeft} days left
        </span>
        <span className="text-green-400">
          <TrendingUp className="h-4 w-4 inline mr-1" />
          Velocity: {sprint.velocity}
        </span>
      </div>
    </div>
  );
}

function WipIndicator({ current, limit }: { current: number; limit?: number }) {
  if (!limit) return null;
  const isOver = current > limit;
  const isAt = current === limit;

  return (
    <span className={cn(
      "text-xs px-1.5 py-0.5 rounded",
      isOver && "bg-red-500/20 text-red-400",
      isAt && "bg-amber-500/20 text-amber-400",
      !isOver && !isAt && "bg-slate-700/50 text-slate-400"
    )}>
      {current}/{limit}
    </span>
  );
}

function KanbanCardComponent({ 
  card, 
  variant,
  onStartPomodoro,
}: { 
  card: KanbanCard; 
  variant: KanbanVariant;
  onStartPomodoro?: () => void;
}) {
  const priorityColors = {
    low: 'border-l-slate-500',
    medium: 'border-l-blue-500',
    high: 'border-l-amber-500',
    critical: 'border-l-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 bg-slate-700/50 rounded-lg cursor-pointer',
        'hover:bg-slate-700 transition-colors',
        'border border-transparent hover:border-violet-500/30',
        card.priority && `border-l-2 ${priorityColors[card.priority]}`
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-slate-500 mt-0.5 cursor-grab" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">{card.title}</h4>
          {card.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{card.description}</p>
          )}
          
          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {card.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Pomodoro specific */}
          {variant === 'pomodoro' && card.pomodorosEstimated && (
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <Timer className="h-3 w-3" />
              {card.pomodorosCompleted || 0}/{card.pomodorosEstimated} 🍅
              {onStartPomodoro && (
                <Button size="sm" variant="ghost" className="h-5 px-2 text-xs" onClick={onStartPomodoro}>
                  Start
                </Button>
              )}
            </div>
          )}
          
          {/* Points (Scrumban) */}
          {variant === 'scrumban' && card.points && (
            <div className="flex items-center justify-between mt-2">
              <Badge variant="outline" className="text-xs">{card.points} pts</Badge>
              {card.assignee && (
                <span className="text-xs text-slate-400">{card.assignee}</span>
              )}
            </div>
          )}
          
          {/* Subtasks progress */}
          {card.subtasks && card.subtasks.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Subtasks</span>
                <span>{card.subtasks.filter(s => s.done).length}/{card.subtasks.length}</span>
              </div>
              <div className="h-1 bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${(card.subtasks.filter(s => s.done).length / card.subtasks.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0">
          <MoreVertical className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface KanbanViewProps {
  initialVariant?: KanbanVariant;
}

export function KanbanView({ initialVariant = 'standard' }: KanbanViewProps) {
  const [variant, setVariant] = useState<KanbanVariant>(initialVariant);
  const [columns, setColumns] = useState<KanbanColumn[]>(() => getDefaultColumns(initialVariant));
  const [lanes] = useState<Lane[]>(DEFAULT_LANES);
  const [sprint] = useState<Sprint>(DEFAULT_SPRINT);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const pomodoroTimer = usePomodoroTimer();

  // Reset columns when variant changes
  useEffect(() => {
    setColumns(getDefaultColumns(variant));
  }, [variant]);

  const addCard = useCallback((columnId: string, laneId?: string) => {
    setColumns(cols => cols.map(col => {
      if (col.id === columnId) {
        const newCard: KanbanCard = {
          id: Date.now().toString(),
          title: 'New Task',
          description: 'Click to edit',
          lane: laneId,
          pomodorosEstimated: variant === 'pomodoro' ? 2 : undefined,
          points: variant === 'scrumban' ? 3 : undefined,
        };
        return { ...col, cards: [...col.cards, newCard] };
      }
      return col;
    }));
  }, [variant]);

  const getTotalCards = () => columns.reduce((sum, col) => sum + col.cards.length, 0);
  const getDoneCards = () => columns.find(c => c.id === 'done' || c.id === 'completed')?.cards.length || 0;

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <VariantSelector current={variant} onChange={setVariant} />
          
          {variant === 'pomodoro' && (
            <PomodoroTimer timer={pomodoroTimer} />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAnalytics(!showAnalytics)}>
            <BarChart3 className="h-4 w-4 mr-1" />
            Analytics
          </Button>
          <Button size="sm" variant="outline">
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
          <Button size="sm" variant="outline">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sprint Header (Scrumban only) */}
      {variant === 'scrumban' && <SprintHeader sprint={sprint} />}

      {/* Analytics Panel */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 overflow-hidden"
          >
            <div className="p-4 grid grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">Total Tasks</div>
                <div className="text-2xl font-bold text-white">{getTotalCards()}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">Completed</div>
                <div className="text-2xl font-bold text-green-400">{getDoneCards()}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">Cycle Time (avg)</div>
                <div className="text-2xl font-bold text-white">2.3d</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">Throughput</div>
                <div className="text-2xl font-bold text-white">12/wk</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto">
        {variant === 'enterprise' ? (
          // Enterprise: Multi-lane view
          <div className="min-w-max">
            {lanes.map(lane => (
              <div key={lane.id} className={cn("border-b border-white/10", lane.color)}>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/30">
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-white">{lane.name}</span>
                </div>
                <div className="flex gap-4 p-4">
                  {columns.map(column => (
                    <div key={`${lane.id}-${column.id}`} className="flex-shrink-0 w-72">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">{column.title}</span>
                      </div>
                      <div className="space-y-2 min-h-[100px] bg-slate-800/30 rounded-lg p-2">
                        {column.cards
                          .filter(c => c.lane === lane.id)
                          .map(card => (
                            <KanbanCardComponent key={card.id} card={card} variant={variant} />
                          ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-slate-500 hover:text-white"
                          onClick={() => addCard(column.id, lane.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Standard column view
          <div className="flex gap-4 p-4 h-full">
            {columns.map(column => (
              <div
                key={column.id}
                className="flex-shrink-0 w-72 flex flex-col bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center justify-between p-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    {column.color && (
                      <div className={cn("w-2 h-2 rounded-full", column.color)} />
                    )}
                    <h3 className="font-medium text-white">{column.title}</h3>
                  </div>
                  <WipIndicator current={column.cards.length} limit={column.wipLimit} />
                </div>
                
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {column.cards.map(card => (
                    <KanbanCardComponent 
                      key={card.id} 
                      card={card} 
                      variant={variant}
                      onStartPomodoro={variant === 'pomodoro' ? pomodoroTimer.toggle : undefined}
                    />
                  ))}
                </div>
                
                <div className="p-2 border-t border-white/10">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-white"
                    onClick={() => addCard(column.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Card
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

