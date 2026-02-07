'use client';

import { useState } from 'react';
import {
  BookOpen,
  Swords,
  Trophy,
  Library,
  MessageCircle,
  ChevronRight,
  GraduationCap,
  Flame,
  Brain,
  Users,
  Scale,
  Network,
  Activity,
  Settings,
} from 'lucide-react';
import { useDojoStore } from '@/lib/dojo-store';
import { DojoSidebar } from '@/components/DojoSidebar';
import { LibraryView } from '@/components/LibraryView';
import { ThemeSelector } from '@/components/ThemeSelector';
import { TrainingArena } from '@/components/TrainingArena';
import { ProgressDashboard } from '@/components/ProgressDashboard';
import { MobotPanel } from '@/components/MobotPanel';
import { DecayEngine } from '@/components/DecayEngine';
import { ScenarioArena } from '@/components/ScenarioArena';
import { DialecticArena } from '@/components/DialecticArena';
import { CompetencyMeshView } from '@/components/CompetencyMesh';
import { KnowledgePulseView } from '@/components/KnowledgePulse';
import { ArchytasSettings } from '@/components/ArchytasSettings';
import { cn } from '@/lib/utils';

type Tab = 'library' | 'themes' | 'train' | 'progress' | 'decay' | 'scenario' | 'dialectic' | 'competency' | 'pulse' | 'settings';

const TAB_META: Record<Tab, { label: string; icon: typeof BookOpen; description: string }> = {
  library:    { label: 'Library',     icon: Library,   description: 'Manage document libraries' },
  themes:     { label: 'Themes',      icon: BookOpen,  description: 'Discover central themes' },
  train:      { label: 'Train',       icon: Swords,    description: 'Lecture & Sparring' },
  progress:   { label: 'Progress',    icon: Trophy,    description: 'Rank & Certifications' },
  decay:      { label: 'Retention',   icon: Brain,     description: 'Ebbinghaus Decay Engine' },
  scenario:   { label: 'Scenarios',   icon: Users,     description: 'Digital Twin Sparring' },
  dialectic:  { label: 'Dialectic',   icon: Scale,     description: 'Socratic Multi-Agent Debate' },
  competency: { label: 'Competency',  icon: Network,   description: 'Predictive Skill Mesh' },
  pulse:      { label: 'Pulse',       icon: Activity,  description: 'Org Knowledge Health' },
  settings:   { label: 'Settings',    icon: Settings,  description: 'Archytas & Configuration' },
};

export default function DojoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const { mobotOpen, toggleMobot, tenantId, setIdentity, activeLibrary } = useDojoStore();

  // Auto-set identity for dev if not set
  if (!tenantId) {
    setIdentity('default-tenant', 'default-user');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <DojoSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-dojo-900/30 bg-[#0f0c08]/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-dojo-500" />
              <span className="text-lg font-semibold text-white tracking-tight">
                Aurelius Dojo
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
                <span className="text-sm text-dojo-400 font-mono">{activeLibrary.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleMobot}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                mobotOpen
                  ? 'bg-dojo-500/20 text-dojo-300 border border-dojo-500/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70'
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Mobot
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <GraduationCap className="w-3.5 h-3.5 text-dojo-400" />
              <span className="text-xs font-mono text-white/60">{tenantId}</span>
            </div>
          </div>
        </header>

        {/* Content + Mobot */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'library' && <LibraryView />}
            {activeTab === 'themes' && <ThemeSelector />}
            {activeTab === 'train' && <TrainingArena />}
            {activeTab === 'progress' && <ProgressDashboard />}
            {activeTab === 'decay' && <DecayEngine />}
            {activeTab === 'scenario' && <ScenarioArena />}
            {activeTab === 'dialectic' && <DialecticArena />}
            {activeTab === 'competency' && <CompetencyMeshView />}
            {activeTab === 'pulse' && <KnowledgePulseView />}
            {activeTab === 'settings' && <ArchytasSettings />}
          </div>

          {/* Mobot Conversational Sidebar */}
          {mobotOpen && <MobotPanel />}
        </div>
      </main>
    </div>
  );
}
