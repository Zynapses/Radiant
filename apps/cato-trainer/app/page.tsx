'use client';

import { useState } from 'react';
import {
  Library,
  Search,
  MessageSquare,
  FileText,
  FolderOpen,
  Layers,
  Settings,
  Shield,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useCatoTrainerStore } from '@/lib/cato-trainer-store';
import { CatoSidebar, type Tab } from '@/components/CatoSidebar';
import { LibraryExplorer } from '@/components/LibraryExplorer';
import { DocumentViewer } from '@/components/DocumentViewer';
import { SearchPanel } from '@/components/SearchPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { DigestPanel } from '@/components/DigestPanel';
import { cn } from '@/lib/utils';

const TAB_META: Record<Tab, { label: string; icon: typeof Library; description: string }> = {
  library:   { label: 'Libraries',  icon: Library,       description: 'Knowledge bases' },
  documents: { label: 'Documents',  icon: FileText,      description: 'Browse & upload files' },
  spaces:    { label: 'Spaces',     icon: FolderOpen,    description: 'Organize by project' },
  search:    { label: 'Search',     icon: Search,        description: 'Semantic & full-text search' },
  chat:      { label: 'Ask Cato',   icon: MessageSquare, description: 'Grounded Q&A with citations' },
  digest:    { label: 'Digest',     icon: Layers,        description: 'Multi-document synthesis' },
  settings:  { label: 'Settings',   icon: Settings,      description: 'Configuration' },
};

export default function CatoTrainerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const { tenantId, setIdentity, activeLibrary, selectedDocumentIds } = useCatoTrainerStore();

  if (!tenantId) {
    setIdentity('default-tenant', 'default-user');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <CatoSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-cato-900/30 bg-[#060a10]/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cato-500" />
              <span className="text-lg font-semibold text-white tracking-tight">
                Cato Trainer
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20" />
            <div className="flex items-center gap-2 text-sm text-white/60">
              {(() => {
                const meta = TAB_META[activeTab];
                const Icon = meta.icon;
                return (
                  <>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{meta.label}</span>
                  </>
                );
              })()}
            </div>
            {activeLibrary && (
              <>
                <ChevronRight className="w-4 h-4 text-white/20" />
                <span className="text-sm text-cato-400 font-mono">{activeLibrary.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedDocumentIds.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cato-500/10 border border-cato-500/20">
                <FileText className="w-3.5 h-3.5 text-cato-400" />
                <span className="text-xs text-cato-300">{selectedDocumentIds.length} selected</span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <BookOpen className="w-3.5 h-3.5 text-cato-400" />
              <span className="text-xs font-mono text-white/60">{tenantId}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? (
            <ChatPanel />
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'library' && <LibraryExplorer />}
              {activeTab === 'documents' && <DocumentViewer />}
              {activeTab === 'search' && <SearchPanel />}
              {activeTab === 'digest' && <DigestPanel />}
              {activeTab === 'spaces' && <SpacesPlaceholder />}
              {activeTab === 'settings' && <SettingsPlaceholder />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SpacesPlaceholder() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Spaces</h2>
          <p className="text-xs text-white/30">Organize documents into project-based collections</p>
        </div>
      </div>
      <div className="text-center py-20">
        <FolderOpen className="w-16 h-16 text-white/[0.03] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white/20">Spaces organize your knowledge</h3>
        <p className="text-sm text-white/10 max-w-md mx-auto mt-2">
          Group documents by project, topic, or team. Each space gets its own scoped search and chat context.
        </p>
      </div>
    </div>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6">Settings</h2>
      <div className="glass-panel rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">AI Model</p>
            <p className="text-[10px] text-white/25">Model used for grounded Q&A and digestion</p>
          </div>
          <span className="text-xs font-mono text-cato-400">claude-sonnet-4-20250514</span>
        </div>
        <div className="border-t border-white/[0.04]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Embedding Model</p>
            <p className="text-[10px] text-white/25">Used for semantic search and smart linking</p>
          </div>
          <span className="text-xs font-mono text-cato-400">text-embedding-3-large</span>
        </div>
        <div className="border-t border-white/[0.04]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Citation Threshold</p>
            <p className="text-[10px] text-white/25">Minimum confidence to include a citation</p>
          </div>
          <span className="text-xs font-mono text-ground-400">0.70</span>
        </div>
        <div className="border-t border-white/[0.04]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Auto-Tagging</p>
            <p className="text-[10px] text-white/25">Automatically tag uploaded documents with AI</p>
          </div>
          <div className="w-10 h-5 rounded-full bg-ground-500 relative">
            <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow" />
          </div>
        </div>
        <div className="border-t border-white/[0.04]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Smart Linking</p>
            <p className="text-[10px] text-white/25">Auto-discover relationships between documents</p>
          </div>
          <div className="w-10 h-5 rounded-full bg-ground-500 relative">
            <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow" />
          </div>
        </div>
      </div>
    </div>
  );
}
