'use client';

/**
 * Reality Scrubber Timeline
 * 
 * "We replaced 'Undo' with Time Travel. Did a decision lead to a dead end? 
 * Grab the timeline and scrub reality back to 10:45 AM. The data, the logic, 
 * and the interface all rewind instantly."
 * 
 * Video-editor-style timeline for navigating through state snapshots.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Play,
  Pause,
  Bookmark,
  BookmarkCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Camera,
  Database,
  Code,
  MessageSquare,
  Layout,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format, formatDistanceToNow } from 'date-fns';

// Types
interface RealitySnapshot {
  id: string;
  position: number;
  timestamp: Date;
  triggerEvent: 'user_action' | 'ai_generation' | 'db_mutation' | 'morph_transition' | 'checkpoint' | 'auto_interval';
  label?: string;
  isBookmark: boolean;
  thumbnail?: string;
  stats: {
    filesChanged: number;
    dbMutations: number;
    ghostBindings: number;
  };
}

interface RealityScrubberTimelineProps {
  snapshots: RealitySnapshot[];
  currentPosition: number;
  isPlaying?: boolean;
  onScrubTo: (position: number) => void;
  onCreateBookmark: (label: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  className?: string;
}

// Event type icons and colors
const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  user_action: { icon: Camera, color: 'bg-blue-500', label: 'User Action' },
  ai_generation: { icon: MessageSquare, color: 'bg-purple-500', label: 'AI Generated' },
  db_mutation: { icon: Database, color: 'bg-green-500', label: 'Database Change' },
  morph_transition: { icon: Layout, color: 'bg-pink-500', label: 'UI Morph' },
  checkpoint: { icon: BookmarkCheck, color: 'bg-amber-500', label: 'Checkpoint' },
  auto_interval: { icon: Clock, color: 'bg-gray-500', label: 'Auto Snapshot' },
};

export function RealityScrubberTimeline({
  snapshots,
  currentPosition,
  isPlaying = false,
  onScrubTo,
  onCreateBookmark,
  onPlay,
  onPause,
  className,
}: RealityScrubberTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [hoveredSnapshot, setHoveredSnapshot] = useState<RealitySnapshot | null>(null);
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);

  const totalSnapshots = snapshots.length;
  const currentSnapshot = snapshots[currentPosition];

  // Calculate timeline width based on zoom
  const timelineWidth = Math.max(100, totalSnapshots * 40 * zoom);

  // Handle scrubbing
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = Math.round(percentage * (totalSnapshots - 1));
    onScrubTo(Math.max(0, Math.min(totalSnapshots - 1, newPosition)));
  }, [totalSnapshots, onScrubTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onScrubTo(Math.max(0, currentPosition - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onScrubTo(Math.min(totalSnapshots - 1, currentPosition + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        isPlaying ? onPause?.() : onPlay?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPosition, totalSnapshots, isPlaying, onScrubTo, onPlay, onPause]);

  // Handle bookmark creation
  const handleCreateBookmark = () => {
    if (bookmarkLabel.trim()) {
      onCreateBookmark(bookmarkLabel.trim());
      setBookmarkLabel('');
      setShowBookmarkInput(false);
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          'bg-background/95 backdrop-blur-xl',
          'border-t border-border/50',
          'shadow-lg',
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Reality Scrubber</span>
            </div>
            
            {currentSnapshot && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {format(currentSnapshot.timestamp, 'HH:mm:ss')}
              </Badge>
            )}

            <Badge variant="secondary" className="text-xs">
              {currentPosition + 1} / {totalSnapshots}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Bookmark Button */}
            <Popover open={showBookmarkInput} onOpenChange={setShowBookmarkInput}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" />
                  Bookmark
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Create Bookmark</p>
                  <input
                    type="text"
                    placeholder="e.g., Before risky change"
                    value={bookmarkLabel}
                    onChange={(e) => setBookmarkLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateBookmark()}
                    className="w-full px-3 py-2 text-sm border rounded-md"
                    autoFocus
                  />
                  <Button size="sm" className="w-full" onClick={handleCreateBookmark}>
                    Create
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-4 py-3">
          <div className="relative">
            {/* Time Labels */}
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              {snapshots.length > 0 && (
                <>
                  <span>{format(snapshots[0].timestamp, 'HH:mm')}</span>
                  {snapshots.length > 2 && (
                    <span>{format(snapshots[Math.floor(snapshots.length / 2)].timestamp, 'HH:mm')}</span>
                  )}
                  <span>{format(snapshots[snapshots.length - 1].timestamp, 'HH:mm')}</span>
                </>
              )}
            </div>

            {/* Scrollable Timeline */}
            <div className="overflow-x-auto pb-2">
              <div
                ref={timelineRef}
                className="relative h-16 bg-muted/30 rounded-lg cursor-pointer"
                style={{ width: `${timelineWidth}%`, minWidth: '100%' }}
                onClick={handleTimelineClick}
              >
                {/* Track */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-muted-foreground/20 rounded-full" />

                {/* Progress Fill */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{ left: 0 }}
                  animate={{ width: `${(currentPosition / Math.max(1, totalSnapshots - 1)) * 100}%` }}
                  transition={{ type: 'spring', damping: 20 }}
                />

                {/* Snapshot Markers */}
                {snapshots.map((snapshot, index) => {
                  const config = EVENT_CONFIG[snapshot.triggerEvent] || EVENT_CONFIG.auto_interval;
                  const Icon = config.icon;
                  const left = (index / Math.max(1, totalSnapshots - 1)) * 100;
                  const isCurrent = index === currentPosition;
                  const isHovered = hoveredSnapshot?.id === snapshot.id;

                  return (
                    <Tooltip key={snapshot.id}>
                      <TooltipTrigger asChild>
                        <motion.div
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                            'cursor-pointer transition-transform',
                            isCurrent && 'z-20',
                            snapshot.isBookmark && 'z-10'
                          )}
                          style={{ left: `${left}%` }}
                          onHoverStart={() => setHoveredSnapshot(snapshot)}
                          onHoverEnd={() => setHoveredSnapshot(null)}
                          whileHover={{ scale: 1.3 }}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onScrubTo(index);
                          }}
                        >
                          {snapshot.isBookmark ? (
                            <div className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center',
                              'bg-amber-500 text-white shadow-lg',
                              'ring-2 ring-amber-500/30'
                            )}>
                              <BookmarkCheck className="h-3 w-3" />
                            </div>
                          ) : (
                            <div className={cn(
                              'w-3 h-3 rounded-full',
                              config.color,
                              isCurrent && 'ring-2 ring-offset-2 ring-offset-background ring-primary w-4 h-4'
                            )} />
                          )}
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            <span className="font-medium">{config.label}</span>
                            {snapshot.isBookmark && snapshot.label && (
                              <Badge variant="secondary" className="text-xs">
                                {snapshot.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(snapshot.timestamp, 'MMM d, HH:mm:ss')}
                          </p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{snapshot.stats.filesChanged} files</span>
                            <span>{snapshot.stats.dbMutations} db ops</span>
                            <span>{snapshot.stats.ghostBindings} bindings</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Current Position Indicator */}
                <motion.div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg shadow-primary/50 z-30"
                  style={{ left: `${(currentPosition / Math.max(1, totalSnapshots - 1)) * 100}%` }}
                  animate={{ x: '-50%' }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary" />
                </motion.div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onScrubTo(0)}
                disabled={currentPosition === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onScrubTo(Math.max(0, currentPosition - 5))}
                disabled={currentPosition === 0}
              >
                <Rewind className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onScrubTo(Math.max(0, currentPosition - 1))}
                disabled={currentPosition === 0}
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>

              <Button
                variant="default"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={isPlaying ? onPause : onPlay}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onScrubTo(Math.min(totalSnapshots - 1, currentPosition + 1))}
                disabled={currentPosition === totalSnapshots - 1}
              >
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onScrubTo(Math.min(totalSnapshots - 1, currentPosition + 5))}
                disabled={currentPosition === totalSnapshots - 1}
              >
                <FastForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onScrubTo(totalSnapshots - 1)}
                disabled={currentPosition === totalSnapshots - 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Snapshot Preview on Hover */}
        <AnimatePresence>
          {hoveredSnapshot && hoveredSnapshot.thumbnail && (
            <motion.div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
            >
              <div className="bg-background border rounded-lg shadow-xl p-2">
                <Image
                  src={hoveredSnapshot.thumbnail}
                  alt="Snapshot preview"
                  width={192}
                  height={128}
                  className="object-cover rounded"
                />
                <p className="text-xs text-center mt-1 text-muted-foreground">
                  {format(hoveredSnapshot.timestamp, 'HH:mm:ss')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}
