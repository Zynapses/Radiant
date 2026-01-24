'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  GitMerge,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Loader2,
  ChevronRight,
  Scale,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

type ResolutionType = 'supersede_old' | 'supersede_new' | 'merge' | 'context_dependent' | 'ignore';

interface Conflict {
  id: string;
  nodeAId: string;
  nodeBId: string;
  nodeALabel: string;
  nodeBLabel: string;
  nodeAContent: string;
  nodeBContent: string;
  conflictType: 'contradiction' | 'overlap' | 'temporal' | 'source_mismatch';
  description: string;
  priority: number;
  status: 'unresolved' | 'resolved' | 'deferred';
  resolution?: ResolutionType;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
  detectedAt: string;
}

function getConflictTypeConfig(type: string) {
  switch (type) {
    case 'contradiction':
      return { icon: XCircle, label: 'Contradiction', color: 'text-destructive', bgColor: 'bg-destructive/10' };
    case 'overlap':
      return { icon: GitMerge, label: 'Overlap', color: 'text-curator-gold', bgColor: 'bg-curator-gold/10' };
    case 'temporal':
      return { icon: Clock, label: 'Temporal', color: 'text-curator-sapphire', bgColor: 'bg-curator-sapphire/10' };
    case 'source_mismatch':
      return { icon: AlertTriangle, label: 'Source Mismatch', color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
    default:
      return { icon: AlertTriangle, label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted' };
  }
}

function getPriorityBadge(priority: number) {
  if (priority >= 80) return { label: 'Critical', color: 'bg-destructive text-white' };
  if (priority >= 60) return { label: 'High', color: 'bg-curator-gold text-white' };
  if (priority >= 40) return { label: 'Medium', color: 'bg-curator-sapphire text-white' };
  return { label: 'Low', color: 'bg-muted text-muted-foreground' };
}

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved' | 'deferred'>('unresolved');
  const [resolving, setResolving] = useState(false);
  const [resolutionReason, setResolutionReason] = useState('');
  const [mergedValue, setMergedValue] = useState('');

  useEffect(() => {
    async function fetchConflicts() {
      try {
        const res = await fetch(`/api/curator/conflicts?status=${filter === 'all' ? '' : filter}`);
        if (res.ok) {
          const data = await res.json();
          setConflicts(data.conflicts || []);
        }
      } catch (error) {
        console.error('Failed to fetch conflicts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConflicts();
  }, [filter]);

  const handleResolve = async (resolution: ResolutionType, winningNodeId?: string) => {
    if (!selectedConflict || !resolutionReason) {
      toast.error('Error', { description: 'Please provide a reason for this resolution.' });
      return;
    }

    setResolving(true);
    try {
      const res = await fetch(`/api/curator/conflicts/${selectedConflict.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution,
          winningNodeId,
          mergedValue: resolution === 'merge' ? mergedValue : undefined,
          reason: resolutionReason,
        }),
      });

      if (res.ok) {
        setConflicts((prev) =>
          prev.map((c) =>
            c.id === selectedConflict.id ? { ...c, status: 'resolved', resolution } : c
          )
        );
        toast.success('Conflict Resolved', {
          description: `Resolution: ${resolution.replace('_', ' ')}`,
        });
        setSelectedConflict(null);
        setResolutionReason('');
        setMergedValue('');
      } else {
        throw new Error('Failed to resolve');
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to resolve conflict. Please try again.' });
    } finally {
      setResolving(false);
    }
  };

  const filteredConflicts = conflicts.filter((c) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!c.nodeAContent?.toLowerCase().includes(query) &&
          !c.nodeBContent?.toLowerCase().includes(query) &&
          !c.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const unresolvedCount = conflicts.filter((c) => c.status === 'unresolved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-curator-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conflict Queue</h1>
          <p className="text-muted-foreground mt-1">
            Resolve conflicting knowledge discovered during ingestion.
          </p>
        </div>
        {unresolvedCount > 0 && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">{unresolvedCount} conflicts need resolution</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conflicts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'unresolved', 'resolved', 'deferred'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-accent'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Conflicts</p>
          <p className="text-2xl font-bold">{conflicts.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Unresolved</p>
          <p className="text-2xl font-bold text-destructive">{unresolvedCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Resolved</p>
          <p className="text-2xl font-bold text-curator-emerald">
            {conflicts.filter((c) => c.status === 'resolved').length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Deferred</p>
          <p className="text-2xl font-bold text-curator-gold">
            {conflicts.filter((c) => c.status === 'deferred').length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conflict List */}
        <div className="space-y-3">
          {filteredConflicts.length > 0 ? (
            filteredConflicts.map((conflict) => {
              const typeConfig = getConflictTypeConfig(conflict.conflictType);
              const priorityBadge = getPriorityBadge(conflict.priority);
              return (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflict(conflict)}
                  className={cn(
                    'w-full text-left transition-all',
                    selectedConflict?.id === conflict.id && 'ring-2 ring-primary',
                    conflict.status === 'resolved' && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('p-1.5 rounded', typeConfig.bgColor)}>
                          <typeConfig.icon className={cn('h-4 w-4', typeConfig.color)} />
                        </div>
                        <span className={cn('text-sm font-medium', typeConfig.color)}>
                          {typeConfig.label}
                        </span>
                        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', priorityBadge.color)}>
                          {priorityBadge.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {conflict.description || `${conflict.nodeALabel} vs ${conflict.nodeBLabel}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Detected: {new Date(conflict.detectedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </button>
              );
            })
          ) : (
            <GlassCard variant="default" padding="lg" className="text-center">
              <CheckCircle2 className="h-12 w-12 text-curator-emerald mx-auto mb-4" />
              <h3 className="font-semibold">No Conflicts Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === 'unresolved' ? 'All conflicts have been resolved!' : 'No conflicts match your filters'}
              </p>
            </GlassCard>
          )}
        </div>

        {/* Detail Panel - Side by Side Comparison */}
        <div className="lg:sticky lg:top-20">
          {selectedConflict ? (
            <GlassCard variant="elevated" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Conflict Resolution</h3>
                {selectedConflict.status === 'resolved' && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-curator-emerald/10 text-curator-emerald">
                    Resolved
                  </span>
                )}
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-curator-gold" />
                    <span className="text-sm font-medium">Version A</span>
                  </div>
                  <div className="p-3 bg-curator-gold/5 border border-curator-gold/20 rounded-lg min-h-[100px]">
                    <p className="text-sm font-medium">{selectedConflict.nodeALabel}</p>
                    <p className="text-sm text-muted-foreground mt-2">{selectedConflict.nodeAContent}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-curator-sapphire" />
                    <span className="text-sm font-medium">Version B</span>
                  </div>
                  <div className="p-3 bg-curator-sapphire/5 border border-curator-sapphire/20 rounded-lg min-h-[100px]">
                    <p className="text-sm font-medium">{selectedConflict.nodeBLabel}</p>
                    <p className="text-sm text-muted-foreground mt-2">{selectedConflict.nodeBContent}</p>
                  </div>
                </div>
              </div>

              {/* Resolution Actions */}
              {selectedConflict.status === 'unresolved' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Resolution Reason (required)</label>
                    <textarea
                      value={resolutionReason}
                      onChange={(e) => setResolutionReason(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-20 text-sm"
                      placeholder="Explain why you chose this resolution..."
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Choose Resolution:</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleResolve('supersede_new', selectedConflict.nodeAId)}
                        disabled={resolving || !resolutionReason}
                        className="p-3 border rounded-lg hover:bg-curator-gold/10 hover:border-curator-gold transition-colors disabled:opacity-50 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-4 w-4 text-curator-gold" />
                          <span className="font-medium text-sm">Keep A</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Version A supersedes B</p>
                      </button>
                      
                      <button
                        onClick={() => handleResolve('supersede_old', selectedConflict.nodeBId)}
                        disabled={resolving || !resolutionReason}
                        className="p-3 border rounded-lg hover:bg-curator-sapphire/10 hover:border-curator-sapphire transition-colors disabled:opacity-50 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-4 w-4 text-curator-sapphire" />
                          <span className="font-medium text-sm">Keep B</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Version B supersedes A</p>
                      </button>
                    </div>

                    <button
                      onClick={() => handleResolve('merge')}
                      disabled={resolving || !resolutionReason}
                      className="w-full p-3 border rounded-lg hover:bg-curator-emerald/10 hover:border-curator-emerald transition-colors disabled:opacity-50 text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <GitMerge className="h-4 w-4 text-curator-emerald" />
                        <span className="font-medium text-sm">Merge Both</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Combine information from both versions</p>
                      {mergedValue && (
                        <input
                          type="text"
                          value={mergedValue}
                          onChange={(e) => setMergedValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full mt-2 px-2 py-1 text-sm border rounded bg-background"
                          placeholder="Enter merged value..."
                        />
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleResolve('context_dependent')}
                        disabled={resolving || !resolutionReason}
                        className="p-3 border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Scale className="h-4 w-4" />
                          <span className="font-medium text-sm">Context Dep.</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Both valid in different contexts</p>
                      </button>
                      
                      <button
                        onClick={() => handleResolve('ignore')}
                        disabled={resolving || !resolutionReason}
                        className="p-3 border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <RotateCcw className="h-4 w-4" />
                          <span className="font-medium text-sm">Defer</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Review later</p>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Resolved Info */}
              {selectedConflict.status === 'resolved' && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Resolution:</span>{' '}
                    <span className="font-medium">{selectedConflict.resolution?.replace('_', ' ')}</span>
                  </p>
                  {selectedConflict.resolutionReason && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Reason:</span>{' '}
                      {selectedConflict.resolutionReason}
                    </p>
                  )}
                  {selectedConflict.resolvedBy && (
                    <p className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedConflict.resolvedBy}
                    </p>
                  )}
                  {selectedConflict.resolvedAt && (
                    <p className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {new Date(selectedConflict.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard variant="default" padding="lg" className="flex flex-col items-center justify-center text-center h-[400px]">
              <Scale className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Select a conflict to compare and resolve
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
