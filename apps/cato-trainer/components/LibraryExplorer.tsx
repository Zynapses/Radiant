'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Library,
  Plus,
  Loader2,
  FileText,
  HardDrive,
  Hash,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useCatoTrainerStore } from '@/lib/cato-trainer-store';
import { fetchLibraries, createLibrary, type Library as LibraryType } from '@/lib/api';
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils';
import { useState } from 'react';

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending:   { icon: Clock,         color: 'text-white/20',   label: 'Pending' },
  ingesting: { icon: RefreshCw,     color: 'text-yellow-400', label: 'Ingesting' },
  indexing:  { icon: RefreshCw,     color: 'text-cato-400',   label: 'Indexing' },
  ready:     { icon: CheckCircle2,  color: 'text-ground-400', label: 'Ready' },
  error:     { icon: AlertCircle,   color: 'text-red-400',    label: 'Error' },
};

export function LibraryExplorer() {
  const { tenantId, libraries, setLibraries, activeLibrary, setActiveLibrary } = useCatoTrainerStore();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['libraries', tenantId],
    queryFn: () => fetchLibraries(tenantId),
    enabled: !!tenantId,
    select: (data) => {
      setLibraries(data.libraries);
      return data.libraries;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createLibrary(tenantId, { name: newName, description: newDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-cato-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Libraries</h2>
          <p className="text-xs text-white/30">Your knowledge bases. Each library is a separate corpus of documents.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cato-600 hover:bg-cato-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Library
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-panel rounded-xl p-5 space-y-3 card-reveal">
          <h3 className="text-sm font-semibold text-white">Create Library</h3>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Library name"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/15 focus:border-cato-500/30 focus:outline-none"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/15 resize-none focus:border-cato-500/30 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-white/30 hover:text-white/50 transition-colors">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-1.5 rounded-lg bg-cato-600 hover:bg-cato-500 text-white text-xs font-medium disabled:opacity-30 transition-colors"
            >
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Library cards */}
      {libraries.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {libraries.map((lib) => {
            const status = STATUS_META[lib.status] || STATUS_META.pending;
            const StatusIcon = status.icon;
            const isActive = activeLibrary?.id === lib.id;

            return (
              <button
                key={lib.id}
                onClick={() => setActiveLibrary(isActive ? null : lib)}
                className={cn(
                  'glass-panel rounded-xl p-5 text-left transition-all card-reveal',
                  isActive
                    ? 'border-cato-500/30 bg-cato-500/5 shadow-lg shadow-cato-500/5'
                    : 'hover:bg-white/[0.02]'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Library className={cn('w-4 h-4', isActive ? 'text-cato-400' : 'text-white/20')} />
                    <span className={cn('text-sm font-semibold', isActive ? 'text-white' : 'text-white/70')}>
                      {lib.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusIcon className={cn('w-3 h-3', status.color)} />
                    <span className={cn('text-[10px]', status.color)}>{status.label}</span>
                  </div>
                </div>

                {lib.description && (
                  <p className="text-[11px] text-white/30 mb-3 line-clamp-2">{lib.description}</p>
                )}

                <div className="flex items-center gap-4 text-[10px] text-white/15">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {lib.document_count} doc{lib.document_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" /> {lib.chunk_count} chunks
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> {formatFileSize(lib.total_size_bytes)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <Library className="w-16 h-16 text-white/[0.03] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/20">No Libraries Yet</h3>
          <p className="text-sm text-white/10 mt-1">Create your first library to start building your knowledge base</p>
        </div>
      )}
    </div>
  );
}
