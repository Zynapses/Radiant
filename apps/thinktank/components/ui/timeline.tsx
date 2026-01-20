'use client';

/**
 * InteractiveTimeline - Beautiful Timeline Navigation
 * 
 * Modern 2026+ timeline with:
 * - Smooth scrolling
 * - Animated nodes
 * - Glassmorphism styling
 * - Gesture support
 * - Time grouping
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Star, Clock, ChevronLeft, ChevronRight,
  Sparkles, Zap, Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  title: string;
  preview?: string;
  timestamp: Date;
  type?: 'conversation' | 'artifact' | 'milestone';
  isFavorite?: boolean;
  messageCount?: number;
  mode?: 'auto' | 'advanced';
  domainHint?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  onSelect: (item: TimelineItem) => void;
  selectedId?: string;
  className?: string;
}

type TimeGroup = {
  label: string;
  items: TimelineItem[];
};

function groupByDate(items: TimelineItem[]): TimeGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: Record<string, TimelineItem[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Older': [],
  };

  items.forEach(item => {
    const itemDate = new Date(item.timestamp);
    if (itemDate >= today) {
      groups['Today'].push(item);
    } else if (itemDate >= yesterday) {
      groups['Yesterday'].push(item);
    } else if (itemDate >= weekAgo) {
      groups['This Week'].push(item);
    } else if (itemDate >= monthAgo) {
      groups['This Month'].push(item);
    } else {
      groups['Older'].push(item);
    }
  });

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const typeIcons = {
  conversation: MessageSquare,
  artifact: Brain,
  milestone: Sparkles,
};

export function InteractiveTimeline({
  items,
  onSelect,
  selectedId,
  className,
}: TimelineProps) {
  const groups = groupByDate(items);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className={cn('relative', className)}>
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/50 via-fuchsia-500/30 to-transparent" />
      
      {/* Groups */}
      <div ref={containerRef} className="space-y-6 pl-2">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Group header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-violet-500/50 border-2 border-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {group.label}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-2 ml-1.5">
              {group.items.map((item, index) => {
                const Icon = typeIcons[item.type || 'conversation'];
                const isSelected = selectedId === item.id;
                const isHovered = hoveredId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <motion.button
                      onClick={() => onSelect(item)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200',
                        'bg-white/[0.02] border border-white/[0.04]',
                        'hover:bg-white/[0.06] hover:border-white/[0.1]',
                        isSelected && 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                      )}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Timeline node */}
                      <div className="relative">
                        <motion.div 
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center',
                            isSelected ? 'bg-violet-500/30' : 'bg-slate-800/80'
                          )}
                          animate={isSelected ? { scale: [1, 1.1, 1] } : undefined}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Icon className={cn(
                            'h-4 w-4',
                            isSelected ? 'text-violet-300' : 'text-slate-400'
                          )} />
                        </motion.div>
                        {item.isFavorite && (
                          <Star className="absolute -top-1 -right-1 h-3 w-3 text-amber-400 fill-amber-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-medium truncate',
                            isSelected ? 'text-white' : 'text-slate-200'
                          )}>
                            {item.title}
                          </span>
                          {item.mode === 'advanced' && (
                            <Zap className="h-3 w-3 text-violet-400 shrink-0" />
                          )}
                        </div>
                        {item.preview && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {item.preview}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-500">
                            {formatTime(item.timestamp)}
                          </span>
                          {item.messageCount && (
                            <>
                              <span className="text-slate-700">•</span>
                              <span className="text-[10px] text-slate-500">
                                {item.messageCount} messages
                              </span>
                            </>
                          )}
                          {item.domainHint && (
                            <>
                              <span className="text-slate-700">•</span>
                              <span className="text-[10px] text-violet-400">
                                {item.domainHint}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Hover indicator */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="text-slate-400"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * HorizontalTimeline - Horizontal scrollable timeline
 */
export interface HorizontalTimelineProps {
  items: TimelineItem[];
  onSelect: (item: TimelineItem) => void;
  selectedId?: string;
  className?: string;
}

export function HorizontalTimeline({
  items,
  onSelect,
  selectedId,
  className,
}: HorizontalTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <div className={cn('relative group', className)}>
      {/* Scroll buttons */}
      <AnimatePresence>
        {canScrollLeft && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/90 border border-white/10 flex items-center justify-center text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {canScrollRight && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900/90 border border-white/10 flex items-center justify-center text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Timeline track */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-6 py-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, index) => {
          const Icon = typeIcons[item.type || 'conversation'];
          const isSelected = selectedId === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onSelect(item)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex-shrink-0 w-48 p-4 rounded-xl text-left transition-all duration-200',
                'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
                'hover:bg-white/[0.06] hover:border-white/[0.12]',
                isSelected && 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.2)]'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center',
                  isSelected ? 'bg-violet-500/30' : 'bg-slate-800'
                )}>
                  <Icon className="h-3 w-3 text-slate-300" />
                </div>
                {item.isFavorite && (
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                )}
              </div>
              <h4 className="font-medium text-sm text-white truncate">
                {item.title}
              </h4>
              {item.preview && (
                <p className="text-xs text-slate-500 truncate mt-1">
                  {item.preview}
                </p>
              )}
              <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                {formatTime(item.timestamp)}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom timeline line */}
      <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
    </div>
  );
}
