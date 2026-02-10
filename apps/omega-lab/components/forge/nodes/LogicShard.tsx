'use client';

// LOGIC SHARD — Hexagonal glass prism that spins mechanically when processing
// Represents processors: Face Detection, NLP, Video Compressor, Neural Bridge, etc.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import type { ShardData } from '@/lib/forge-store';

function LogicShardNode({ data, selected }: NodeProps<ShardData>) {
  const tempColor = data.temperature > 70 ? '#f97316' : data.temperature > 50 ? '#38bdf8' : '#a78bfa';
  const isSafety = data.capability.category === 'safety';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, rotate: -90 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', damping: 15 }}
      className="relative group"
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-3 rounded-2xl opacity-30 blur-xl transition-colors duration-500"
        style={{ backgroundColor: isSafety ? '#ef4444' : tempColor }}
      />

      {/* Input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-violet-300/50 !rounded-full"
        style={{ left: -6 }}
      />

      {/* Main body */}
      <div
        className={`
          relative w-48 px-4 py-3
          bg-[#0a0a0a]/80 backdrop-blur-[20px]
          border rounded-xl
          transition-all duration-300
          ${isSafety ? 'border-red-500/40' : 'border-violet-500/30'}
          ${selected ? 'border-violet-400/70 shadow-[0_0_30px_rgba(167,139,250,0.3)]' : ''}
          ${data.errorMessage ? 'border-red-500/60' : ''}
        `}
        style={{
          clipPath: 'polygon(8% 0%, 92% 0%, 100% 15%, 100% 85%, 92% 100%, 8% 100%, 0% 85%, 0% 15%)',
        }}
      >
        {/* Spinning gear overlay — active when processing */}
        {data.isActive && (
          <motion.div
            className="absolute top-2 right-2 w-5 h-5 border border-violet-500/30 rounded-sm"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: isSafety ? '#ef4444' : '#a78bfa' }}
          />
          <span className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: isSafety ? 'rgba(239,68,68,0.7)' : 'rgba(167,139,250,0.7)' }}>
            {isSafety ? 'Safety' : 'Logic'}
          </span>
        </div>

        {/* Name */}
        <div className="text-sm font-bold text-white/90 font-mono truncate">
          {data.capability.name}
        </div>

        {/* Description */}
        <div className="text-[9px] text-white/30 font-mono mt-0.5 truncate">
          {data.capability.description}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-white/40">
          <span style={{ color: tempColor }}>
            {data.temperature.toFixed(0)}°C
          </span>
          <span>{data.capability.powerDraw}W</span>
          <span>{data.capability.latencyMs}ms</span>
        </div>

        {/* Processing bar */}
        <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: isSafety ? 'rgba(239,68,68,0.5)' : 'rgba(167,139,250,0.5)' }}
            animate={{
              width: data.isActive ? ['0%', '100%', '0%'] : '0%',
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        {data.errorMessage && (
          <div className="mt-1 text-[9px] text-red-400 font-mono truncate">
            {data.errorMessage}
          </div>
        )}
      </div>

      {/* Output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-violet-300/50 !rounded-full"
        style={{ right: -6 }}
      />
    </motion.div>
  );
}

export const LogicShard = memo(LogicShardNode);
