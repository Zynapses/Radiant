'use client';

// OUTPUT SHARD — Hexagonal glass prism that glows Amber/Red based on power consumption
// Represents actuators: WiFi Transmitter, Motor Controller, Display, Speaker, GPIO

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import type { ShardData } from '@/lib/forge-store';

function OutputShardNode({ data, selected }: NodeProps<ShardData>) {
  // Power-based color: low power = amber, high power = red
  const powerRatio = Math.min(data.powerConsumption / 12, 1);
  const glowColor = powerRatio > 0.7 ? '#ef4444' : powerRatio > 0.4 ? '#f97316' : '#fbbf24';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative group"
    >
      {/* Outer glow — pulsates with power draw */}
      <motion.div
        className="absolute -inset-3 rounded-2xl blur-xl transition-colors duration-500"
        style={{ backgroundColor: glowColor }}
        animate={{
          opacity: [0.2 + powerRatio * 0.3, 0.4 + powerRatio * 0.3, 0.2 + powerRatio * 0.3],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Input handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300/50 !rounded-full"
        style={{ left: -6 }}
      />

      {/* Main body */}
      <div
        className={`
          relative w-44 px-4 py-3
          bg-[#0a0a0a]/80 backdrop-blur-[20px]
          border border-amber-500/30
          rounded-xl
          transition-all duration-300
          ${selected ? 'border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.3)]' : ''}
          ${data.errorMessage ? 'border-red-500/60' : ''}
        `}
        style={{
          clipPath: 'polygon(8% 0%, 92% 0%, 100% 15%, 100% 85%, 92% 100%, 8% 100%, 0% 85%, 0% 15%)',
        }}
      >
        {/* Power glow overlay */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{ backgroundColor: glowColor }}
          animate={{
            opacity: [0.03, 0.08 + powerRatio * 0.05, 0.03],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <motion.div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: glowColor }}
            animate={{
              boxShadow: [
                `0 0 4px ${glowColor}`,
                `0 0 12px ${glowColor}`,
                `0 0 4px ${glowColor}`,
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">
            Output
          </span>
        </div>

        {/* Name */}
        <div className="text-sm font-bold text-white/90 font-mono truncate">
          {data.capability.name}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-white/40">
          <span style={{ color: glowColor }}>
            {data.capability.powerDraw}W
          </span>
          <span>{data.temperature.toFixed(0)}°C</span>
          <span>{data.capability.latencyMs}ms</span>
        </div>

        {/* Power consumption bar */}
        <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: glowColor }}
            initial={{ width: 0 }}
            animate={{ width: `${powerRatio * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {data.errorMessage && (
          <div className="mt-1 text-[9px] text-red-400 font-mono truncate">
            {data.errorMessage}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const OutputShard = memo(OutputShardNode);
