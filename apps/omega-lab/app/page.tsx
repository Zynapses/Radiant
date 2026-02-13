'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Cpu, Dna, Activity, Settings, FlaskConical, Waves, Flame, UtensilsCrossed, Shield } from 'lucide-react';
import { getHealth } from '@/lib/proving-ground';
import { CortexExplorer } from '@/components/CortexExplorer';
import { OmegaForge } from '@/components/OmegaForge';
import { GlassFoundry } from '@/components/forge/GlassFoundry';
import { Dashboard } from '@/components/Dashboard';
import { QNodeViz } from '@/components/QNodeViz';
import { GenesisForge } from '@/components/GenesisForge';
import dynamic from 'next/dynamic';

const DriveThrough = dynamic(
  () => import('@/components/DriveThrough').then(mod => ({ default: mod.DriveThrough })),
  { ssr: false },
);

type Tab = 'dashboard' | 'qnode' | 'cortex' | 'genesis' | 'firmware' | 'forge' | 'drivethru';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const { data: health } = useQuery({
    queryKey: ['app-health'],
    queryFn: getHealth,
    refetchInterval: 8000,
    retry: 1,
  });

  const serverOnline = !!health?.status;
  const brainBooted = !!health?.brain_booted;

  // Full-screen experiences — no header/container
  if (activeTab === 'forge') {
    return <GlassFoundry onBack={() => setActiveTab('dashboard')} />;
  }
  if (activeTab === 'drivethru') {
    return <DriveThrough onBack={() => setActiveTab('dashboard')} />;
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-omega-800/50 bg-omega-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Dna className="w-8 h-8 text-omega-400 phase-ring" />
                <div className="absolute inset-0 blur-md bg-omega-400/30 rounded-full" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">OMEGA Lab</h1>
                <p className="text-xs text-omega-400">OMEGA Brain Management</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                icon={<Activity className="w-4 h-4" />}
                label="Dashboard"
              />
              <TabButton
                active={activeTab === 'qnode'}
                onClick={() => setActiveTab('qnode')}
                icon={<Waves className="w-4 h-4" />}
                label="Q-Node Live"
              />
              <TabButton
                active={activeTab === 'cortex'}
                onClick={() => setActiveTab('cortex')}
                icon={<Brain className="w-4 h-4" />}
                label="Cortex Explorer"
              />
              <TabButton
                active={activeTab === 'genesis'}
                onClick={() => setActiveTab('genesis')}
                icon={<Flame className="w-4 h-4" />}
                label="Genesis Forge"
              />
              <TabButton
                active={activeTab === 'firmware'}
                onClick={() => setActiveTab('firmware')}
                icon={<Shield className="w-4 h-4" />}
                label="Firmware"
              />
              <TabButton
                active={(activeTab as Tab) === 'forge'}
                onClick={() => setActiveTab('forge')}
                icon={<FlaskConical className="w-4 h-4" />}
                label="OMEGA Forge"
              />
              <TabButton
                active={(activeTab as Tab) === 'drivethru'}
                onClick={() => setActiveTab('drivethru')}
                icon={<UtensilsCrossed className="w-4 h-4" />}
                label="McDonald's Drive-Thru"
              />
            </nav>

            {/* Status */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                serverOnline
                  ? brainBooted
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  serverOnline
                    ? brainBooted ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
                    : 'bg-red-500'
                }`} />
                <span className={`text-xs ${
                  serverOnline
                    ? brainBooted ? 'text-green-400' : 'text-amber-400'
                    : 'text-red-400'
                }`}>
                  {serverOnline ? (brainBooted ? 'Brain Online' : 'Server Up') : 'Offline'}
                </span>
                {health?.device && (
                  <span className="text-xs text-omega-500 font-mono ml-1">{health.device.toUpperCase()}</span>
                )}
              </div>
              <button className="p-2 rounded-lg hover:bg-omega-800/50 transition-colors">
                <Settings className="w-5 h-5 text-omega-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'qnode' && <QNodeViz />}
        {activeTab === 'cortex' && <CortexExplorer />}
        {activeTab === 'genesis' && <GenesisForge />}
        {activeTab === 'firmware' && <OmegaForge />}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all
        ${active
          ? 'bg-omega-600 text-white shadow-lg shadow-omega-500/20'
          : 'text-omega-300 hover:bg-omega-800/50 hover:text-white'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
