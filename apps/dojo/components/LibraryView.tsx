'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FolderPlus,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  BookOpen,
  Sparkles,
  Database,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import {
  fetchLibraries,
  createLibrary,
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  discoverThemes,
  type DojoLibrary,
  type DojoDocument,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRadiantDelightOptional } from '@radiant/delight-ui';

const STATUS_ICON: Record<string, { icon: typeof Loader2; color: string }> = {
  pending:   { icon: Loader2,      color: 'text-white/40' },
  ingesting: { icon: Loader2,      color: 'text-dojo-400 animate-spin' },
  analyzing: { icon: Sparkles,     color: 'text-purple-400 animate-pulse' },
  ready:     { icon: CheckCircle2, color: 'text-green-400' },
  error:     { icon: AlertCircle,  color: 'text-red-400' },
  chunked:   { icon: CheckCircle2, color: 'text-blue-400' },
  embedded:  { icon: CheckCircle2, color: 'text-green-400' },
};

export function LibraryView() {
  const { tenantId, activeLibrary, setActiveLibrary } = useDojoStore();
  const queryClient = useQueryClient();
  const delight = useRadiantDelightOptional();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: libData, isLoading: libLoading } = useQuery({
    queryKey: ['dojo-libraries', tenantId],
    queryFn: () => fetchLibraries(tenantId),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: () => createLibrary(tenantId, { name: newName, description: newDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dojo-libraries', tenantId] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      delight?.triggerDelight('action_complete');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const { data: docData } = useQuery({
    queryKey: ['dojo-documents', activeLibrary?.id],
    queryFn: () => fetchDocuments(activeLibrary!.id),
    enabled: !!activeLibrary,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(activeLibrary!.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dojo-documents', activeLibrary?.id] });
      delight?.triggerDelight('action_complete');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deleteDocument(activeLibrary!.id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dojo-documents', activeLibrary?.id] });
      delight?.triggerDelight('action_complete');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const discoverMutation = useMutation({
    mutationFn: () => discoverThemes(activeLibrary!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dojo-libraries', tenantId] });
      delight?.triggerDelight('milestone');
    },
    onError: () => { delight?.triggerDelight('error_recovery'); },
  });

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      files.forEach((f) => uploadMutation.mutate(f));
    },
    [uploadMutation]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((f) => uploadMutation.mutate(f));
    },
    [uploadMutation]
  );

  const libraries = libData?.libraries || [];
  const documents = docData?.documents || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Document Libraries</h1>
          <p className="text-sm text-white/40 mt-1">
            Upload documents to create a knowledge base for thematic training
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dojo-600 hover:bg-dojo-500 text-white text-sm font-medium transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          New Library
        </button>
      </div>

      {/* Create Library Modal */}
      {showCreate && (
        <div className="glass-panel rounded-xl p-6 card-reveal">
          <h3 className="text-lg font-semibold text-white mb-4">Create Library</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Order Taking Procedures"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-dojo-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wider">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What does this library cover?"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-dojo-500/50 focus:outline-none transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dojo-600 hover:bg-dojo-500 disabled:opacity-30 text-white text-sm font-medium transition-all"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Library Grid */}
      {libLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-dojo-500 animate-spin" />
        </div>
      ) : libraries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Database className="w-12 h-12 text-white/10 mb-4" />
          <h3 className="text-lg font-medium text-white/40">No libraries yet</h3>
          <p className="text-sm text-white/25 mt-1">Create a library to start uploading documents</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraries.map((lib) => {
            const isActive = activeLibrary?.id === lib.id;
            const statusMeta = STATUS_ICON[lib.status] || STATUS_ICON.pending;
            const StatusIcon = statusMeta.icon;
            return (
              <button
                key={lib.id}
                onClick={() => setActiveLibrary(isActive ? null : lib)}
                className={cn(
                  'text-left p-5 rounded-xl border transition-all duration-200 card-reveal',
                  isActive
                    ? 'bg-dojo-500/10 border-dojo-500/30 discipline-glow'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <BookOpen className={cn('w-5 h-5', isActive ? 'text-dojo-400' : 'text-white/30')} />
                  <StatusIcon className={cn('w-4 h-4', statusMeta.color)} />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{lib.name}</h3>
                <p className="text-xs text-white/40 line-clamp-2 mb-3">{lib.description}</p>
                <div className="flex items-center gap-3 text-xs text-white/30">
                  <span>{lib.document_count} docs</span>
                  <span>·</span>
                  <span>{lib.chunk_count} chunks</span>
                  <span>·</span>
                  <span>{lib.theme_count} themes</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Library Detail */}
      {activeLibrary && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {activeLibrary.name} — Documents
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => discoverMutation.mutate()}
                disabled={discoverMutation.isPending || activeLibrary.status !== 'ready'}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-600/30 disabled:opacity-30 transition-all"
              >
                {discoverMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Discover Themes
              </button>
            </div>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="relative border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-dojo-500/30 hover:bg-dojo-500/[0.02] transition-colors cursor-pointer"
          >
            <input
              type="file"
              multiple
              accept=".pdf,.md,.txt,.csv,.docx"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40">
              {uploadMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-dojo-400" />
                  Uploading...
                </span>
              ) : (
                <>Drop files here or <span className="text-dojo-400 underline">browse</span> — PDF, MD, TXT, CSV</>
              )}
            </p>
          </div>

          {/* Document List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => {
                const docStatus = STATUS_ICON[doc.status] || STATUS_ICON.pending;
                const DocIcon = docStatus.icon;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-white/30" />
                      <div>
                        <p className="text-sm text-white font-medium">{doc.filename}</p>
                        <p className="text-xs text-white/30">
                          {(doc.size_bytes / 1024).toFixed(1)} KB · {doc.chunk_count} chunks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <DocIcon className={cn('w-3.5 h-3.5', docStatus.color)} />
                      <button
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
