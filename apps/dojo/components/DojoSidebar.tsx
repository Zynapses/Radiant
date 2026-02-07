'use client';

import {
  Library,
  BookOpen,
  Swords,
  Trophy,
  Flame,
  Settings,
  Brain,
  Users,
  Scale,
  Network,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'library' | 'themes' | 'train' | 'progress' | 'decay' | 'scenario' | 'dialectic' | 'competency' | 'pulse' | 'settings';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const CORE_ITEMS: Array<{ tab: Tab; icon: LucideIcon; label: string }> = [
  { tab: 'library',  icon: Library,  label: 'Library' },
  { tab: 'themes',   icon: BookOpen, label: 'Themes' },
  { tab: 'train',    icon: Swords,   label: 'Train' },
  { tab: 'progress', icon: Trophy,   label: 'Progress' },
];

const ADVANCED_ITEMS: Array<{ tab: Tab; icon: LucideIcon; label: string }> = [
  { tab: 'decay',      icon: Brain,    label: 'Retention' },
  { tab: 'scenario',   icon: Users,    label: 'Scenarios' },
  { tab: 'dialectic',  icon: Scale,    label: 'Dialectic' },
  { tab: 'competency', icon: Network,  label: 'Competency' },
  { tab: 'pulse',      icon: Activity, label: 'Pulse' },
];

export function DojoSidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 border-r border-dojo-900/20 bg-[#0a0806]/80 backdrop-blur-md">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dojo-500 to-dojo-700 flex items-center justify-center discipline-glow">
          <Flame className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {CORE_ITEMS.map(({ tab, icon: Icon, label }) => (
          <SidebarButton key={tab} tab={tab} icon={Icon} label={label} isActive={activeTab === tab} onClick={() => onTabChange(tab)} />
        ))}

        {/* Separator */}
        <div className="w-6 mx-auto my-1 border-t border-dojo-900/30" />

        {ADVANCED_ITEMS.map(({ tab, icon: Icon, label }) => (
          <SidebarButton key={tab} tab={tab} icon={Icon} label={label} isActive={activeTab === tab} onClick={() => onTabChange(tab)} />
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
          ? 'bg-dojo-500/20 text-dojo-400 shadow-lg shadow-dojo-500/10'
          : 'text-white/30 hover:text-white/60 hover:bg-white/5'
      )}
      title={label}
    >
      <Icon className="w-4.5 h-4.5" />
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-dojo-400 rounded-r" />
      )}
      <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-[#1a1510] border border-dojo-900/30 text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
      </div>
    </button>
  );
}
