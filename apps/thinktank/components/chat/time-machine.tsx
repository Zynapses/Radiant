'use client';

/**
 * Time Machine / Reality Scrubber Component for Think Tank Consumer App
 * Video-editor style timeline for state snapshots
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Bookmark,
  GitBranch,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Snapshot {
  id: string;
  timestamp: Date;
  label?: string;
  isBookmarked: boolean;
  isBranch: boolean;
  branchName?: string;
  preview?: string;
}

interface TimeMachineProps {
  snapshots: Snapshot[];
  currentSnapshotId: string | null;
  onSelectSnapshot: (id: string) => void;
  onCreateBookmark: (id: string, label: string) => void;
  onCreateBranch: (id: string, branchName: string) => void;
  onRestoreSnapshot: (id: string) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  className?: string;
}

export function TimeMachine({
  snapshots,
  currentSnapshotId,
  onSelectSnapshot,
  onCreateBookmark,
  onCreateBranch,
  onRestoreSnapshot,
  isPlaying = false,
  onPlayPause,
  className,
}: TimeMachineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 0.25, 0.5));
  }, []);

  const handleSnapshotClick = useCallback((id: string) => {
    setSelectedSnapshot(id);
    setShowActions(true);
    onSelectSnapshot(id);
  }, [onSelectSnapshot]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatRelativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  // Scroll to current snapshot
  useEffect(() => {
    if (currentSnapshotId && timelineRef.current) {
      const element = timelineRef.current.querySelector(`[data-snapshot-id="${currentSnapshotId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [currentSnapshotId]);

  const currentIndex = snapshots.findIndex(s => s.id === currentSnapshotId);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < snapshots.length - 1;

  return (
    <div className={cn(
      'bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-zinc-100">Time Machine</span>
          <span className="text-xs text-zinc-500">
            {snapshots.length} snapshots
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback Controls */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => canGoBack && onSelectSnapshot(snapshots[currentIndex - 1].id)}
              disabled={!canGoBack}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                canGoBack 
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100' 
                  : 'text-zinc-700 cursor-not-allowed'
              )}
            >
              <SkipBack className="w-4 h-4" />
            </button>
            
            <button
              onClick={onPlayPause}
              className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => canGoForward && onSelectSnapshot(snapshots[currentIndex + 1].id)}
              disabled={!canGoForward}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                canGoForward 
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100' 
                  : 'text-zinc-700 cursor-not-allowed'
              )}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border-l border-zinc-700 pl-2">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-500 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div 
        ref={timelineRef}
        className={cn(
          'overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent',
          isExpanded ? 'max-h-48' : 'max-h-20'
        )}
      >
        <div 
          className="flex items-end gap-1 p-4 min-w-max"
          style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}
        >
          {snapshots.map((snapshot, index) => {
            const isSelected = snapshot.id === selectedSnapshot;
            const isCurrent = snapshot.id === currentSnapshotId;

            return (
              <motion.div
                key={snapshot.id}
                data-snapshot-id={snapshot.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleSnapshotClick(snapshot.id)}
                className={cn(
                  'relative cursor-pointer transition-all',
                  'group'
                )}
              >
                {/* Snapshot Bar */}
                <div className={cn(
                  'w-2 rounded-t transition-all',
                  isExpanded ? 'h-16' : 'h-8',
                  isCurrent 
                    ? 'bg-purple-500' 
                    : snapshot.isBookmarked
                      ? 'bg-yellow-500'
                      : snapshot.isBranch
                        ? 'bg-green-500'
                        : 'bg-zinc-700 group-hover:bg-zinc-600',
                  isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                )}>
                  {/* Bookmark/Branch Indicator */}
                  {(snapshot.isBookmarked || snapshot.isBranch) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      {snapshot.isBookmarked ? (
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      ) : (
                        <GitBranch className="w-3 h-3 text-green-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Tooltip */}
                <div className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded',
                  'bg-zinc-800 text-xs text-zinc-300 whitespace-nowrap',
                  'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10'
                )}>
                  <p className="font-medium">{formatTime(snapshot.timestamp)}</p>
                  {snapshot.label && (
                    <p className="text-zinc-500">{snapshot.label}</p>
                  )}
                  <p className="text-zinc-500">{formatRelativeTime(snapshot.timestamp)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Action Panel */}
      <AnimatePresence>
        {showActions && selectedSnapshot && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onRestoreSnapshot(selectedSnapshot)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm">Restore</span>
                </button>

                <button
                  onClick={() => {
                    const label = prompt('Enter bookmark label:');
                    if (label) onCreateBookmark(selectedSnapshot, label);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="text-sm">Bookmark</span>
                </button>

                <button
                  onClick={() => {
                    const name = prompt('Enter branch name:');
                    if (name) onCreateBranch(selectedSnapshot, name);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <GitBranch className="w-4 h-4" />
                  <span className="text-sm">Branch</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setShowActions(false);
                  setSelectedSnapshot(null);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TimeMachine;
