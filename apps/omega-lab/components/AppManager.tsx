'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen, Plus, Pencil, Trash2, Database, Image,
  FileText, ChevronRight, X, Check, Loader2, AlertTriangle,
} from 'lucide-react';
import { listApps, createApp, renameApp, deleteApp } from '@/lib/proving-ground';
import type { PGApp } from '@/lib/proving-ground';

export function AppManager() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [renamingApp, setRenamingApp] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingApp, setDeletingApp] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pg-apps'],
    queryFn: listApps,
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createApp(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pg-apps'] });
      setNewAppName('');
      setShowCreate(false);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) => renameApp(oldName, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pg-apps'] });
      setRenamingApp(null);
      setRenameValue('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteApp(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pg-apps'] });
      setDeletingApp(null);
    },
  });

  const apps = data?.apps || [];

  const handleCreate = () => {
    if (newAppName.trim()) createMutation.mutate(newAppName.trim());
  };

  const handleRename = (oldName: string) => {
    if (renameValue.trim() && renameValue.trim() !== oldName) {
      renameMutation.mutate({ oldName, newName: renameValue.trim() });
    } else {
      setRenamingApp(null);
    }
  };

  const startRename = (app: PGApp) => {
    setRenamingApp(app.name);
    setRenameValue(app.name);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-omega-400" />
            Proving Ground Apps
          </h2>
          <p className="text-omega-400 mt-1">
            Each app contains its own datasets, images, and training data
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-omega-600 hover:bg-omega-500 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New App
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="border border-omega-700 rounded-lg bg-omega-900/50 p-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newAppName}
              onChange={e => setNewAppName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="App name (e.g. Pizza Ordering Demo)"
              className="flex-1 bg-omega-800 border border-omega-700 rounded-lg px-4 py-2.5 text-white placeholder-omega-500 focus:outline-none focus:border-omega-500"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newAppName.trim() || createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-omega-700 disabled:text-omega-500 text-white rounded-lg transition-colors"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewAppName(''); }}
              className="p-2.5 text-omega-400 hover:text-white hover:bg-omega-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {createMutation.isError && (
            <p className="text-red-400 text-sm mt-2">{(createMutation.error as Error).message}</p>
          )}
          <p className="text-omega-500 text-xs mt-2">
            Creates: apps/&lt;slug&gt;/datasets/, apps/&lt;slug&gt;/menu-img/, apps/&lt;slug&gt;/README.md
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-omega-400 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-800/50 rounded-lg bg-red-900/20 p-4 flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Failed to load apps. Is the proving ground server running?</span>
        </div>
      )}

      {/* App List */}
      {!isLoading && !error && apps.length === 0 && (
        <div className="border border-omega-800 border-dashed rounded-lg p-12 text-center">
          <FolderOpen className="w-12 h-12 text-omega-600 mx-auto mb-3" />
          <p className="text-omega-400">No proving ground apps yet</p>
          <p className="text-omega-600 text-sm mt-1">Click "New App" to create one</p>
        </div>
      )}

      <div className="space-y-3">
        {apps.map(app => (
          <div key={app.name} className="border border-omega-800 rounded-lg bg-omega-900/30 overflow-hidden">
            {/* App Row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setExpandedApp(expandedApp === app.name ? null : app.name)}
                className="p-1 text-omega-400 hover:text-white transition-colors"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedApp === app.name ? 'rotate-90' : ''}`} />
              </button>

              {/* Name or Rename Input */}
              {renamingApp === app.name ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(app.name);
                      if (e.key === 'Escape') setRenamingApp(null);
                    }}
                    className="flex-1 bg-omega-800 border border-omega-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-omega-400"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRename(app.name)}
                    disabled={renameMutation.isPending}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    {renameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setRenamingApp(null)} className="p-1 text-omega-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setExpandedApp(expandedApp === app.name ? null : app.name)}
                  className="flex-1 text-left"
                >
                  <span className="text-white font-medium font-mono">{app.name}</span>
                </button>
              )}

              {/* Stats Badges */}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-omega-400">
                  <Database className="w-3.5 h-3.5" />
                  {app.dataset_count} datasets
                </span>
                <span className="flex items-center gap-1.5 text-omega-400">
                  <Image className="w-3.5 h-3.5" />
                  {app.image_count} images
                </span>
              </div>

              {/* Actions */}
              {renamingApp !== app.name && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startRename(app)}
                    className="p-2 text-omega-500 hover:text-omega-300 hover:bg-omega-800 rounded transition-colors"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingApp(app.name)}
                    className="p-2 text-omega-500 hover:text-red-400 hover:bg-omega-800 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Delete Confirmation */}
            {deletingApp === app.name && (
              <div className="border-t border-omega-800 px-4 py-3 bg-red-900/10 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-300 text-sm">Archive <strong>{app.name}</strong>?</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => deleteMutation.mutate(app.name)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
                  >
                    {deleteMutation.isPending ? 'Archiving...' : 'Archive'}
                  </button>
                  <button
                    onClick={() => setDeletingApp(null)}
                    className="px-3 py-1 text-omega-400 hover:text-white text-sm rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Expanded Details */}
            {expandedApp === app.name && (
              <div className="border-t border-omega-800 px-4 py-3 space-y-3">
                {/* Datasets */}
                {app.datasets.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-omega-400 uppercase tracking-wider mb-2">Datasets</h4>
                    <div className="space-y-1">
                      {app.datasets.map(ds => (
                        <div key={ds.name} className="flex items-center gap-2 text-sm">
                          <FileText className="w-3.5 h-3.5 text-omega-500" />
                          <span className="text-omega-300 font-mono text-xs">{ds.name}</span>
                          <span className="text-omega-600 text-xs ml-auto">{ds.size_mb} MB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Images */}
                {app.image_count > 0 && (
                  <div className="flex items-center gap-2 text-sm text-omega-400">
                    <Image className="w-3.5 h-3.5 text-omega-500" />
                    <span>{app.image_count} images in menu-img/</span>
                  </div>
                )}

                {/* Path */}
                <div className="text-xs text-omega-600 font-mono">
                  apps/{app.name}/
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
