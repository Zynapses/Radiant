'use client';

// INPUT SHARD — Hexagonal glass prism that pulses with a green "heartbeat"
// Represents sensors: Camera, LiDAR, Microphone, IMU, etc.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import type { ShardData } from '@/lib/forge-store';

function InputShardNode({ data, selected }: NodeProps<ShardData>) {
  const tempColor = data.temperature > 70 ? '#f97316' : data.temperature > 50 ? '#22d3ee' : '#22c55e';
  const isHot = data.temperature > 70;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative group"
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-3 rounded-2xl opacity-40 blur-xl transition-colors duration-500"
        style={{ backgroundColor: tempColor }}
      />

      {/* Hexagonal prism body */}
      <div
        className={`
          relative w-44 px-4 py-3
          bg-[#0a0a0a]/80 backdrop-blur-[20px]
          border border-green-500/30
          rounded-xl
          transition-all duration-300
          ${selected ? 'border-green-400/70 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : ''}
          ${data.errorMessage ? 'border-red-500/60' : ''}
        `}
        style={{
          clipPath: 'polygon(8% 0%, 92% 0%, 100% 15%, 100% 85%, 92% 100%, 8% 100%, 0% 85%, 0% 15%)',
        }}
      >
        {/* Heartbeat pulse overlay */}
        <motion.div
          className="absolute inset-0 rounded-xl bg-green-500/5"
          animate={{
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <motion.div
            className="w-2.5 h-2.5 rounded-full bg-green-500"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.6, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[10px] font-mono text-green-400/70 uppercase tracking-wider">
            Input
          </span>
        </div>

        {/* Name */}
        <div className="text-sm font-bold text-white/90 font-mono truncate">
          {data.capability.name}
        </div>

        {/* Metrics bar */}
        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-white/40">
          <span style={{ color: tempColor }}>
            {data.temperature.toFixed(0)}°C
          </span>
          <span>{data.capability.powerDraw}W</span>
          <span>{data.capability.latencyMs}ms</span>
        </div>

        {/* Data weight indicator */}
        <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500/50 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${data.capability.dataWeight * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Error message */}
        {data.errorMessage && (
          <div className="mt-1 text-[9px] text-red-400 font-mono truncate">
            {data.errorMessage}
          </div>
        )}
      </div>

      {/* Output handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-300/50 !rounded-full"
        style={{ right: -6 }}
      />
    </motion.div>
  );
}

export const InputShard = memo(InputShardNode);
