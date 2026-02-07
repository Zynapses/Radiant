'use client';

// OMEGA INSTANCE SELECTOR — Registry picker in the top HUD
// Each Omega instance has an ID and Name. The Forge can talk to any instance.
// Shows status, coherence, and thermal state for each registered instance.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ChevronDown, Wifi, WifiOff, Moon, Flame } from 'lucide-react';
import { useForgeStore } from '@/lib/forge-store';
import { fetchOmegaInstances, type OmegaInstance } from '@/lib/omega-registry';

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Wifi; label: string }> = {
  online: { color: '#22c55e', icon: Wifi, label: 'Online' },
  offline: { color: '#6b7280', icon: WifiOff, label: 'Offline' },
  dreaming: { color: '#a78bfa', icon: Moon, label: 'Dreaming' },
  forging: { color: '#f97316', icon: Flame, label: 'Forging' },
};

export function OmegaSelector() {
  const { connectedInstance, setConnectedInstance } = useForgeStore();
  const [instances, setInstances] = useState<OmegaInstance[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOmegaInstances().then((data) => {
      setInstances(data);
      setLoading(false);
      // Auto-connect to first online instance
      if (!connectedInstance) {
        const firstOnline = data.find((i) => i.status === 'online');
        if (firstOnline) setConnectedInstance(firstOnline);
      }
    });
  }, [connectedInstance, setConnectedInstance]);

  const handleSelect = (instance: OmegaInstance) => {
    setConnectedInstance(instance);
    setIsOpen(false);
  };

  const selected = connectedInstance;
  const selectedStatus = selected ? STATUS_CONFIG[selected.status] : null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5
                   bg-white/[0.03] backdrop-blur-md
                   border border-white/[0.08] hover:border-cyan-500/20
                   rounded-lg transition-all group"
      >
        <Radio className="w-3.5 h-3.5 text-cyan-400/60" />
        {selected ? (
          <>
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: selectedStatus?.color }}
            />
            <span className="text-xs font-mono text-white/70">{selected.name}</span>
            <span className="text-[9px] font-mono text-white/30">{selected.id}</span>
          </>
        ) : (
          <span className="text-xs font-mono text-white/40">
            {loading ? 'Loading registry...' : 'Select Omega Instance'}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-80 z-50
                       bg-[#0a0a0a]/95 backdrop-blur-[20px]
                       border border-white/[0.08] rounded-xl
                       shadow-2xl shadow-black/50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                Omega Instance Registry
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {instances.map((instance) => {
                const status = STATUS_CONFIG[instance.status] || STATUS_CONFIG.offline;
                const StatusIcon = status.icon;
                const isSelected = selected?.id === instance.id;

                return (
                  <button
                    key={instance.id}
                    onClick={() => handleSelect(instance)}
                    disabled={instance.status === 'offline'}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                      transition-colors
                      ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/[0.03]'}
                      ${instance.status === 'offline' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      border-b border-white/[0.03] last:border-b-0
                    `}
                  >
                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      <StatusIcon className="w-4 h-4" style={{ color: status.color }} />
                    </div>

                    {/* Instance info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-white/80 font-bold truncate">
                          {instance.name}
                        </span>
                        {isSelected && (
                          <span className="text-[8px] font-mono text-cyan-400 bg-cyan-400/10 px-1 rounded">
                            CONNECTED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-mono text-white/30">{instance.id}</span>
                        <span className="text-[9px] font-mono text-white/20">{instance.region}</span>
                        <span className="text-[9px] font-mono text-white/20">fw:{instance.firmwareVersion}</span>
                      </div>
                    </div>

                    {/* Quick metrics */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-[10px] font-mono" style={{ color: instance.coherenceScore > 0.7 ? '#22c55e' : '#f97316' }}>
                        {(instance.coherenceScore * 100).toFixed(0)}% coh
                      </div>
                      <div className="text-[9px] font-mono text-white/20">
                        {instance.cpuTemp.toFixed(0)}°C
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-1.5 border-t border-white/[0.06] bg-white/[0.02]">
              <span className="text-[9px] font-mono text-white/20">
                {instances.length} instances registered • {instances.filter((i) => i.status === 'online').length} online
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
