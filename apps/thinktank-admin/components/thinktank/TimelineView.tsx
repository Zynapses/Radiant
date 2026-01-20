'use client';

import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Clock,
  GitBranch,
  History,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';

export interface TimelineSnapshot {
  id: string;
  label: string | null;
  snapshotType: 'auto' | 'manual' | 'branch';
  messageCount: number;
  createdAt: string;
  parentSnapshotId: string | null;
}

interface TimelineViewProps {
  snapshots: TimelineSnapshot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
  onBranch: (id: string) => void;
}

export function TimelineView({
  snapshots,
  selectedId,
  onSelect,
  onRestore,
  onBranch,
}: TimelineViewProps) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const getSnapshotIcon = (type: TimelineSnapshot['snapshotType']) => {
    switch (type) {
      case 'auto':
        return <Clock className="h-3 w-3" />;
      case 'manual':
        return <History className="h-3 w-3" />;
      case 'branch':
        return <GitBranch className="h-3 w-3" />;
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

  const handleScroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 200;
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleScroll('left')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleScroll('right')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-auto pb-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="relative min-w-max"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'left top' }}
        >
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-border" />

          <div className="flex items-start gap-4 relative">
            {sortedSnapshots.map((snapshot, index) => {
              const isSelected = selectedId === snapshot.id;
              const isBranch = snapshot.snapshotType === 'branch';

              return (
                <div
                  key={snapshot.id}
                  className="flex flex-col items-center"
                  style={{ minWidth: 120 }}
                >
                  {isBranch && snapshot.parentSnapshotId && (
                    <div className="absolute top-4 w-8 h-8 border-l-2 border-t-2 border-dashed border-amber-500 rounded-tl-lg" />
                  )}

                  <button
                    onClick={() => onSelect(snapshot.id)}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                      'border-2 bg-background hover:scale-110',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : snapshot.snapshotType === 'manual'
                        ? 'border-blue-500'
                        : snapshot.snapshotType === 'branch'
                        ? 'border-amber-500'
                        : 'border-muted-foreground'
                    )}
                  >
                    {getSnapshotIcon(snapshot.snapshotType)}
                  </button>

                  <div className="mt-2 text-center max-w-[100px]">
                    <div className="text-xs font-medium truncate">
                      {snapshot.label || `Snapshot ${index + 1}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(snapshot.createdAt), 'HH:mm')}
                    </div>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {snapshot.messageCount} msgs
                    </Badge>
                  </div>

                  {isSelected && (
                    <div className="mt-2 flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => onRestore(snapshot.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => onBranch(snapshot.id)}
                      >
                        <GitBranch className="h-3 w-3 mr-1" />
                        Branch
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-muted-foreground" />
          <span>Auto</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
          <span>Manual</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-amber-500" />
          <span>Branch</span>
        </div>
      </div>
    </div>
  );
}
