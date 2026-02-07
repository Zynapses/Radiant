'use client';

import {
  Library,
  Search,
  MessageSquare,
  FileText,
  FolderOpen,
  Layers,
  Settings,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tab = 'library' | 'search' | 'chat' | 'documents' | 'spaces' | 'digest' | 'settings';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const MAIN_ITEMS: Array<{ tab: Tab; icon: LucideIcon; label: string }> = [
  { tab: 'library',   icon: Library,      label: 'Libraries' },
  { tab: 'documents', icon: FileText,     label: 'Documents' },
  { tab: 'spaces',    icon: FolderOpen,   label: 'Spaces' },
  { tab: 'search',    icon: Search,       label: 'Search' },
  { tab: 'chat',      icon: MessageSquare, label: 'Ask Cato' },
  { tab: 'digest',    icon: Layers,       label: 'Digest' },
];

export function CatoSidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 border-r border-cato-900/20 bg-[#060a10]/80 backdrop-blur-md">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cato-500 to-cato-700 flex items-center justify-center cato-glow">
          <Shield className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {MAIN_ITEMS.map(({ tab, icon: Icon, label }) => (
          <SidebarButton
            key={tab}
            tab={tab}
            icon={Icon}
            label={label}
            isActive={activeTab === tab}
            onClick={() => onTabChange(tab)}
          />
        ))}
      </nav>

      {/* Bottom Settings */}
      <SidebarButton
        tab="settings"
        icon={Settings}
        label="Settings"
        isActive={activeTab === 'settings'}
        onClick={() => onTabChange('settings')}
      />
    </aside>
  );
}

function SidebarButton({ tab, icon: Icon, label, isActive, onClick }: {
  tab: string; icon: LucideIcon; label: string; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
        isActive
          ? 'bg-cato-500/20 text-cato-400 shadow-lg shadow-cato-500/10'
          : 'text-white/30 hover:text-white/60 hover:bg-white/5'
      )}
      title={label}
    >
      <Icon className="w-4.5 h-4.5" />
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cato-400 rounded-r" />
      )}
      <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#0a1020] border border-cato-900/30 text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
      </div>
    </button>
  );
}
