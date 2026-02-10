'use client';

// THE ARMORY — Left retractable glass drawer
// Contains the "Capability Library" — drag capabilities onto the canvas
// Categories: Sensor, Processor, AI, Safety, Network, Actuator

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Scan, Mic, Compass, Thermometer, MapPin,
  ScanFace, MessageSquare, FileVideo, Box, TrendingUp, Shield,
  Zap, Wifi, Cog, Monitor, Volume2, ToggleLeft,
  ChevronLeft, ChevronRight, Search, GripVertical,
} from 'lucide-react';
import { useForgeStore, CAPABILITY_LIBRARY, type ShardCapability } from '@/lib/forge-store';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Camera, Scan, Mic, Compass, Thermometer, MapPin,
  ScanFace, MessageSquare, FileVideo, Box, TrendingUp, Shield,
  Zap, Wifi, Cog, Monitor, Volume2, ToggleLeft,
};

const CATEGORY_COLORS: Record<string, string> = {
  sensor: '#22c55e',
  processor: '#a78bfa',
  ai: '#38bdf8',
  safety: '#ef4444',
  network: '#f97316',
  actuator: '#fbbf24',
};

const CATEGORY_LABELS: Record<string, string> = {
  sensor: 'Sensors',
  processor: 'Processors',
  ai: 'AI Engines',
  safety: 'Safety',
  network: 'Network',
  actuator: 'Actuators',
};

export function TheArmory() {
  const { armoryOpen, toggleArmory, addShard } = useForgeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCapabilities = CAPABILITY_LIBRARY.filter((cap) => {
    const matchesSearch = !searchQuery ||
      cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || cap.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(CAPABILITY_LIBRARY.map((c) => c.category)));

  const handleDragStart = useCallback((event: React.DragEvent, capability: ShardCapability) => {
    event.dataTransfer.setData('application/reactflow-capability', JSON.stringify(capability));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleClick = useCallback((capability: ShardCapability) => {
    // Place shard at a random position in the center area
    addShard(capability, {
      x: 300 + Math.random() * 400,
      y: 100 + Math.random() * 300,
    });
  }, [addShard]);

  return (
    <AnimatePresence>
      {armoryOpen ? (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="absolute left-0 top-0 bottom-0 w-72 z-30
                     bg-[#050505]/90 backdrop-blur-[20px]
                     border-r border-white/[0.06]
                     flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div>
              <h3 className="text-sm font-bold text-white/80 font-mono uppercase tracking-wider">
                The Armory
              </h3>
              <p className="text-[10px] text-white/30 font-mono">Capability Library</p>
            </div>
            <button
              onClick={toggleArmory}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search capabilities..."
                className="w-full pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.06]
                           rounded-lg text-xs text-white/80 placeholder-white/20 font-mono
                           focus:outline-none focus:border-cyan-500/30"
              />
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-1 px-3 pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors
                ${!selectedCategory ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/50'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors
                  ${selectedCategory === cat ? 'text-white/90' : 'text-white/30 hover:text-white/50'}`}
                style={{
                  backgroundColor: selectedCategory === cat ? `${CATEGORY_COLORS[cat]}20` : undefined,
                  borderColor: selectedCategory === cat ? `${CATEGORY_COLORS[cat]}40` : undefined,
                  border: selectedCategory === cat ? '1px solid' : undefined,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Capability list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {filteredCapabilities.map((cap) => {
              const IconComp = ICON_MAP[cap.icon] || Zap;
              const color = CATEGORY_COLORS[cap.category] || '#38bdf8';

              return (
                <div
                  key={cap.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cap)}
                  onClick={() => handleClick(cap)}
                  className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                             bg-white/[0.02] hover:bg-white/[0.05]
                             border border-transparent hover:border-white/[0.08]
                             cursor-grab active:cursor-grabbing transition-all"
                >
                  <GripVertical className="w-3 h-3 text-white/10 group-hover:text-white/30 flex-shrink-0" />
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}15`, border: `1px solid ${color}25` }}
                  >
                    <span style={{ color }}><IconComp className="w-3.5 h-3.5" /></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono text-white/70 truncate">{cap.name}</div>
                    <div className="text-[9px] font-mono text-white/25 truncate">{cap.description}</div>
                  </div>
                  <div className="text-[8px] font-mono text-white/20 flex-shrink-0">
                    {cap.powerDraw}W
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={toggleArmory}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30
                     p-2 rounded-lg bg-[#050505]/80 backdrop-blur-md
                     border border-white/[0.06] hover:border-cyan-500/20
                     text-white/40 hover:text-white/70 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
