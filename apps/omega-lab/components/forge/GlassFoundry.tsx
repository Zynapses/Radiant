'use client';

// THE GLASS FOUNDRY — Full-screen OMEGA Forge experience
// Bioluminescent Industrial: Deep charcoal (#050505), frosted glass panels,
// neon accents indicating "temperature" (Cool Blue = Safe, Hot Orange = High Load)
//
// Layout:
//   [The Armory]  [The Void (React Flow Canvas)]  [The Oracle]
//                 [Reactor Core (bottom center)]
//
// Global UI hue shifts based on stability_score from Shadow Omega:
//   > 70% = Cyan (safe)   |   50-70% = Orange (warning)   |   < 50% = Red (Emergency Mode)

import { useMemo, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useForgeStore, type ShardCapability } from '@/lib/forge-store';
import { useShadowOmega } from '@/hooks/useShadowOmega';
import { InputShard } from './nodes/InputShard';
import { LogicShard } from './nodes/LogicShard';
import { OutputShard } from './nodes/OutputShard';
import { CatenaryEdge } from './edges/CatenaryEdge';
import { TheArmory } from './TheArmory';
import { TheOracle } from './TheOracle';
import { OmegaSelector } from './OmegaSelector';
import { ReactorCore } from './ReactorCore';
import { VoidModePCB } from './VoidModePCB';

// Register custom node and edge types
const nodeTypes = {
  inputShard: InputShard,
  logicShard: LogicShard,
  outputShard: OutputShard,
};

const edgeTypes = {
  catenary: CatenaryEdge,
};

export function GlassFoundry({ onBack }: { onBack?: () => void } = {}) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addShard,
    stabilityScore,
    connectedInstance,
    voidMode,
    toggleVoidMode,
  } = useForgeStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Connect to Shadow Omega
  const { connected, requestForge } = useShadowOmega(connectedInstance);

  // Global hue based on stability score
  const globalHue = useMemo(() => {
    if (stabilityScore > 0.7) return { hue: 190, saturation: 80, name: 'Stable' };     // Cyan
    if (stabilityScore > 0.5) return { hue: 30, saturation: 80, name: 'Warning' };      // Orange
    return { hue: 0, saturation: 80, name: 'Emergency' };                                 // Red
  }, [stabilityScore]);

  const accentColor = `hsl(${globalHue.hue}, ${globalHue.saturation}%, 60%)`;
  const accentGlow = `hsl(${globalHue.hue}, ${globalHue.saturation}%, 40%)`;

  // Handle drop from Armory
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const capabilityData = event.dataTransfer.getData('application/reactflow-capability');
      if (!capabilityData || !reactFlowInstance.current) return;

      const capability: ShardCapability = JSON.parse(capabilityData);
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addShard(capability, position);
    },
    [addShard]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{
        background: voidMode
          ? '#000000'
          : `radial-gradient(ellipse at 50% 50%, hsl(${globalHue.hue}, 15%, 4%) 0%, #050505 70%)`,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        transition: 'background 1s ease',
      }}
    >
      {/* Global stability hue overlay */}
      {stabilityScore < 0.5 && (
        <div
          className="absolute inset-0 pointer-events-none z-50 mix-blend-color"
          style={{
            background: `radial-gradient(ellipse, hsla(0, 60%, 30%, ${0.15 * (1 - stabilityScore)}) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Top HUD Bar */}
      {!voidMode && (
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2
                        bg-[#050505]/70 backdrop-blur-md border-b border-white/[0.04]">
          {/* Left: Logo + Instance Selector */}
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                title="Back to OMEGA Lab"
                className="flex items-center justify-center w-7 h-7 rounded-md
                           bg-white/[0.04] border border-white/[0.08] text-white/40
                           hover:text-white/70 hover:border-white/15 hover:bg-white/[0.07]
                           transition-all cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentGlow}` }}
              />
              <span className="text-sm font-bold text-white/80 font-mono tracking-wider">
                OMEGA FORGE
              </span>
            </div>
            <div className="w-px h-6 bg-white/[0.06]" />
            <OmegaSelector />
          </div>

          {/* Center: Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-mono text-white/40">
                {connected ? 'SHADOW LINK ACTIVE' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] font-mono" style={{ color: accentColor }}>
                STABILITY: {(stabilityScore * 100).toFixed(0)}% [{globalHue.name.toUpperCase()}]
              </span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-white/40">
                SHARDS: {nodes.length} | WIRES: {edges.length}
              </span>
            </div>
          </div>

          {/* Right: Void Mode toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleVoidMode}
              className={`px-3 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider
                         border transition-all
                         ${voidMode
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/10'
                }`}
            >
              {voidMode ? 'Exit Void' : 'Enter The Void'}
            </button>
          </div>
        </div>
      )}

      {/* The Armory (left panel) */}
      {!voidMode && <TheArmory />}

      {/* The Void — 3D PCB view when Void Mode is active, React Flow canvas otherwise */}
      {voidMode ? (
        <VoidModePCB />
      ) : (
        <div
          ref={reactFlowWrapper}
          className="absolute inset-0"
          style={{ paddingTop: 48 }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'catenary' }}
            fitView
            proOptions={{ hideAttribution: true }}
            className="glass-foundry-canvas"
            style={{ background: 'transparent' }}
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={50}
              size={1}
              color={`hsla(${globalHue.hue}, 30%, 30%, 0.04)`}
            />
            <Controls
              className="!bg-[#0a0a0a]/80 !border-white/[0.08] !rounded-lg [&>button]:!bg-transparent [&>button]:!border-white/[0.06] [&>button]:!text-white/40 [&>button:hover]:!bg-white/[0.05]"
              position="bottom-left"
            />
            <MiniMap
              className="!bg-[#0a0a0a]/80 !border-white/[0.08] !rounded-lg"
              nodeColor={(node) => {
                if (node.type === 'inputShard') return '#22c55e';
                if (node.type === 'outputShard') return '#fbbf24';
                return '#a78bfa';
              }}
              maskColor="rgba(0,0,0,0.7)"
              position="bottom-left"
              style={{ marginBottom: 50 }}
            />
          </ReactFlow>
        </div>
      )}

      {/* The Oracle (right panel) */}
      {!voidMode && <TheOracle />}

      {/* Reactor Core (bottom center) */}
      <ReactorCore onForge={requestForge} />

      {/* Void Mode: minimal HUD overlay */}
      {voidMode && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleVoidMode}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
                       text-xs font-mono text-white/50 hover:text-white/80 transition-colors"
          >
            Exit The Void
          </button>
        </div>
      )}
    </div>
  );
}
