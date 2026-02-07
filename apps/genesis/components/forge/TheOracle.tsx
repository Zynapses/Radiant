'use client';

// THE ORACLE — Right panel: Real-time telemetry from Shadow Omega
// Thermal Map, Power Budget, Stability Score, Coherence, Watcher Surprise

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Thermometer, Battery,
  Activity, Brain, Zap, Gauge, Eye, AlertTriangle,
} from 'lucide-react';
import { useForgeStore } from '@/lib/forge-store';

export function TheOracle() {
  const { oracleOpen, toggleOracle, telemetry, stabilityScore, connectedInstance } = useForgeStore();

  const tempColor = (temp: number) =>
    temp > 80 ? '#ef4444' : temp > 60 ? '#f97316' : temp > 40 ? '#22d3ee' : '#3b82f6';

  return (
    <AnimatePresence>
      {oracleOpen ? (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="absolute right-0 top-0 bottom-0 w-72 z-30
                     bg-[#050505]/90 backdrop-blur-[20px]
                     border-l border-white/[0.06]
                     flex flex-col overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] sticky top-0 bg-[#050505]/90 backdrop-blur-md z-10">
            <button
              onClick={toggleOracle}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-right">
              <h3 className="text-sm font-bold text-white/80 font-mono uppercase tracking-wider">
                The Oracle
              </h3>
              <p className="text-[10px] text-white/30 font-mono">Shadow Omega Telemetry</p>
            </div>
          </div>

          {/* Connection status */}
          <div className="px-4 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectedInstance ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-mono text-white/50">
                {connectedInstance ? `Connected: ${connectedInstance.name}` : 'No instance connected'}
              </span>
            </div>
          </div>

          {telemetry ? (
            <div className="flex flex-col gap-3 p-3">
              {/* Global Stability */}
              <MetricCard
                icon={<Gauge className="w-3.5 h-3.5" />}
                label="Stability Score"
                value={`${(stabilityScore * 100).toFixed(1)}%`}
                color={stabilityScore > 0.7 ? '#22c55e' : stabilityScore > 0.5 ? '#f97316' : '#ef4444'}
                bar={stabilityScore}
                warning={stabilityScore < 0.5}
              />

              {/* CPU Temperature */}
              <MetricCard
                icon={<Thermometer className="w-3.5 h-3.5" />}
                label="CPU Temperature"
                value={`${telemetry.cpuTemp.toFixed(1)}°C`}
                color={tempColor(telemetry.cpuTemp)}
                bar={telemetry.cpuTemp / 100}
              />

              {/* RAM Usage */}
              <MetricCard
                icon={<Activity className="w-3.5 h-3.5" />}
                label="RAM Usage"
                value={`${(telemetry.ramUsage * 100).toFixed(0)}%`}
                color={telemetry.ramUsage > 0.8 ? '#ef4444' : '#38bdf8'}
                bar={telemetry.ramUsage}
              />

              {/* Power Budget */}
              <MetricCard
                icon={<Battery className="w-3.5 h-3.5" />}
                label="Power Budget"
                value={`${telemetry.powerBudgetHours.toFixed(1)}h`}
                color={telemetry.powerBudgetHours < 2 ? '#ef4444' : '#22c55e'}
                bar={Math.min(telemetry.powerBudgetHours / 8, 1)}
              />

              {/* Coherence */}
              <MetricCard
                icon={<Brain className="w-3.5 h-3.5" />}
                label="Coherence"
                value={`${(telemetry.coherenceScore * 100).toFixed(1)}%`}
                color={telemetry.coherenceScore > 0.7 ? '#22c55e' : '#f97316'}
                bar={telemetry.coherenceScore}
              />

              {/* Inference Latency */}
              <MetricCard
                icon={<Zap className="w-3.5 h-3.5" />}
                label="Inference Latency"
                value={`${telemetry.inferenceLatencyMs.toFixed(0)}ms`}
                color={telemetry.inferenceLatencyMs > 50 ? '#f97316' : '#22d3ee'}
                bar={Math.min(telemetry.inferenceLatencyMs / 100, 1)}
              />

              {/* Bridge Injection Norm */}
              <MetricCard
                icon={<Zap className="w-3.5 h-3.5" />}
                label="Bridge Injection"
                value={`${telemetry.bridgeInjectionNorm.toFixed(2)}`}
                color="#a78bfa"
                bar={telemetry.bridgeInjectionNorm / 5}
              />

              {/* Watcher Surprise */}
              <MetricCard
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Watcher Surprise"
                value={`${telemetry.watcherSurprise.toFixed(3)}`}
                color={telemetry.watcherSurprise > 0.5 ? '#ef4444' : '#22c55e'}
                bar={telemetry.watcherSurprise}
              />

              {/* Thermal Map (8x8 grid) */}
              <div className="bg-white/[0.02] rounded-lg border border-white/[0.06] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">Thermal Map</span>
                </div>
                <div className="grid grid-cols-8 gap-[2px]">
                  {telemetry.thermalMap.slice(0, 64).map((temp, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-sm transition-colors duration-300"
                      style={{
                        backgroundColor: tempColor(temp),
                        opacity: 0.3 + (temp / 100) * 0.7,
                      }}
                      title={`${temp.toFixed(1)}°C`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[8px] font-mono text-white/20">
                  <span>Cool</span>
                  <span>Hot</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[11px] font-mono text-white/30">No telemetry data</p>
                <p className="text-[9px] font-mono text-white/15">Connect to an Omega instance</p>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={toggleOracle}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30
                     p-2 rounded-lg bg-[#050505]/80 backdrop-blur-md
                     border border-white/[0.06] hover:border-cyan-500/20
                     text-white/40 hover:text-white/70 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  bar,
  warning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bar: number;
  warning?: boolean;
}) {
  return (
    <div className={`bg-white/[0.02] rounded-lg border p-2.5 transition-colors ${warning ? 'border-red-500/30' : 'border-white/[0.06]'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span style={{ color }} className="opacity-60">{icon}</span>
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${Math.min(bar, 1) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
