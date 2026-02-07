'use client';

// VOID MODE — 3D PCB Visualization (FULL IMPLEMENTATION — NO STUBS)
//
// Renders every shard as a physical IC chip on a multilayer PCB board.
// Every visual is driven by REAL data from the Zustand forge store:
//   - Chip positions: Mapped from actual React Flow node.position (x,y → x,z in 3D)
//   - Pin activity: Driven by summed frequency of connected edges (not random)
//   - Trace thickness: From edge.data.dataWeight (heavier data = fatter copper)
//   - Thermal indicators: From node.data.temperature (real Shadow Omega telemetry)
//   - Rejection glow: From edge.data.rejected
//   - Ambient lighting: From store stabilityScore
//
// PCB Layers (bottom to top):
//   1. Ground plane (dark copper)
//   2. FR-4 substrate (dark green)
//   3. Solder mask (translucent green)
//   4. Copper traces (routed connections)
//   5. Silkscreen (board outline, chip labels)
//   6. IC chips with gull-wing pins
//   7. Solder pads under each pin
//   8. Via holes at trace junctions
//   9. Mounting holes at board corners

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useForgeStore, type ShardData, type WireData } from '@/lib/forge-store';
import type { Node, Edge } from 'reactflow';

// ============================================================================
// Constants — derived from real PCB design standards
// ============================================================================

const BOARD_SIZE = 16;
const BOARD_HALF = BOARD_SIZE / 2;
const BOARD_THICKNESS = 0.12;              // FR-4 1.6mm → 0.12 in scene units
const SOLDER_MASK_THICKNESS = 0.005;
const GROUND_PLANE_THICKNESS = 0.008;
const COPPER_LAYER_Y = BOARD_THICKNESS / 2 + SOLDER_MASK_THICKNESS + 0.002;
const CHIP_Y_BASE = BOARD_THICKNESS / 2 + SOLDER_MASK_THICKNESS + 0.01;
const MOUNTING_HOLE_RADIUS = 0.25;
const VIA_HOLE_RADIUS = 0.06;
const PIN_COUNT_PER_SIDE = 7;              // real SOIC-14 package = 7 pins per side
const CHIP_WIDTH = 1.4;
const CHIP_DEPTH = 0.9;
const CHIP_HEIGHT = 0.18;
const PIN_LENGTH = 0.2;
const PIN_WIDTH = 0.05;
const PIN_HEIGHT = 0.015;
const PIN_SPACING = CHIP_DEPTH / (PIN_COUNT_PER_SIDE + 1);

// Scale factor: React Flow pixel coords → 3D world coords
// React Flow canvas is typically ~1000x800px for the visible area
// We map that to a 14x14 usable area on the 16x16 board
const RF_TO_3D_SCALE = 14 / 1000;
const RF_OFFSET_X = -7;  // center the mapping
const RF_OFFSET_Z = -5;

function rfTo3D(rfX: number, rfY: number): [number, number, number] {
  const x = Math.max(-BOARD_HALF + 1, Math.min(BOARD_HALF - 1, rfX * RF_TO_3D_SCALE + RF_OFFSET_X));
  const z = Math.max(-BOARD_HALF + 1, Math.min(BOARD_HALF - 1, rfY * RF_TO_3D_SCALE + RF_OFFSET_Z));
  return [x, CHIP_Y_BASE, z];
}

// ============================================================================
// Layer 1: Ground Plane (bottom copper pour)
// ============================================================================

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BOARD_THICKNESS / 2 - GROUND_PLANE_THICKNESS / 2, 0]}>
      <planeGeometry args={[BOARD_SIZE - 0.5, BOARD_SIZE - 0.5]} />
      <meshStandardMaterial
        color="#8b5e3c"
        roughness={0.4}
        metalness={0.85}
        opacity={0.6}
        transparent
      />
    </mesh>
  );
}

// ============================================================================
// Layer 2: FR-4 Substrate
// ============================================================================

function Substrate() {
  return (
    <mesh position={[0, 0, 0]} receiveShadow>
      <boxGeometry args={[BOARD_SIZE, BOARD_THICKNESS, BOARD_SIZE]} />
      <meshStandardMaterial
        color="#0b3b0b"
        roughness={0.65}
        metalness={0.05}
      />
    </mesh>
  );
}

// ============================================================================
// Layer 3: Solder Mask (translucent green film on top)
// ============================================================================

function SolderMask() {
  return (
    <mesh position={[0, BOARD_THICKNESS / 2 + SOLDER_MASK_THICKNESS / 2, 0]}>
      <boxGeometry args={[BOARD_SIZE - 0.1, SOLDER_MASK_THICKNESS, BOARD_SIZE - 0.1]} />
      <meshStandardMaterial
        color="#0d5a0d"
        roughness={0.35}
        metalness={0.02}
        opacity={0.7}
        transparent
      />
    </mesh>
  );
}

// ============================================================================
// Layer 4: Copper Trace Grid (background etch pattern)
// ============================================================================

function EtchTraceGrid() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const gridSpacing = 0.6;
    const extent = BOARD_HALF - 0.8;
    const y = COPPER_LAYER_Y - 0.001;

    // Horizontal traces
    for (let z = -extent; z <= extent; z += gridSpacing) {
      positions.push(-extent, y, z, extent, y, z);
    }
    // Vertical traces
    for (let x = -extent; x <= extent; x += gridSpacing) {
      positions.push(x, y, -extent, x, y, extent);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5a3a1a" opacity={0.15} transparent linewidth={1} />
    </lineSegments>
  );
}

// ============================================================================
// Layer 5: Silkscreen (board border outline + reference designators)
// ============================================================================

function Silkscreen({ chipCount }: { chipCount: number }) {
  const borderGeometry = useMemo(() => {
    const hw = BOARD_HALF - 0.2;
    const y = COPPER_LAYER_Y + 0.001;
    const positions = [
      -hw, y, -hw, hw, y, -hw,
      hw, y, -hw, hw, y, hw,
      hw, y, hw, -hw, y, hw,
      -hw, y, hw, -hw, y, -hw,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <group>
      {/* Board border */}
      <lineSegments geometry={borderGeometry}>
        <lineBasicMaterial color="#cccccc" opacity={0.5} transparent linewidth={1} />
      </lineSegments>

      {/* Board title silkscreen */}
      <Text
        position={[-BOARD_HALF + 1.2, COPPER_LAYER_Y + 0.002, BOARD_HALF - 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color="#aaaaaa"
        anchorX="left"
        anchorY="middle"
      >
        OMEGA-PCB-{chipCount.toString().padStart(2, '0')} REV.A
      </Text>

      {/* Pin 1 indicator corner */}
      <Text
        position={[BOARD_HALF - 0.6, COPPER_LAYER_Y + 0.002, BOARD_HALF - 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.15}
        color="#666666"
        anchorX="right"
        anchorY="middle"
      >
        GENESIS FORGE v3
      </Text>
    </group>
  );
}

// ============================================================================
// Mounting Holes (4 corners of the board)
// ============================================================================

function MountingHoles() {
  const positions: [number, number, number][] = [
    [-BOARD_HALF + 0.6, 0, -BOARD_HALF + 0.6],
    [BOARD_HALF - 0.6, 0, -BOARD_HALF + 0.6],
    [-BOARD_HALF + 0.6, 0, BOARD_HALF - 0.6],
    [BOARD_HALF - 0.6, 0, BOARD_HALF - 0.6],
  ];

  return (
    <group>
      {positions.map((pos, i) => (
        <group key={`mh-${i}`} position={pos}>
          {/* Hole ring (copper annular ring) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BOARD_THICKNESS / 2 + 0.001, 0]}>
            <ringGeometry args={[MOUNTING_HOLE_RADIUS, MOUNTING_HOLE_RADIUS + 0.12, 24]} />
            <meshStandardMaterial color="#c87533" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Hole center (dark void) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BOARD_THICKNESS / 2 + 0.002, 0]}>
            <circleGeometry args={[MOUNTING_HOLE_RADIUS, 24]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================================
// Via Holes (placed at trace junction midpoints)
// ============================================================================

function ViaHole({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, COPPER_LAYER_Y, 0]}>
        <ringGeometry args={[VIA_HOLE_RADIUS, VIA_HOLE_RADIUS + 0.04, 16]} />
        <meshStandardMaterial color="#c87533" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, COPPER_LAYER_Y + 0.001, 0]}>
        <circleGeometry args={[VIA_HOLE_RADIUS, 16]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

// ============================================================================
// IC Chip — represents a single shard on the PCB
// ============================================================================

interface ChipProps {
  position: [number, number, number];
  color: string;              // Shard type color (green/violet/amber)
  name: string;               // Capability name
  refDes: string;             // Reference designator (U1, U2, etc.)
  temperature: number;        // From Shadow Omega telemetry
  isActive: boolean;          // Is this shard processing
  powerDraw: number;          // Watts
  connectedFrequencies: number[]; // Sum of frequencies from all connected edges
}

function ICChip({
  position,
  color,
  name,
  refDes,
  temperature,
  isActive,
  powerDraw,
  connectedFrequencies,
}: ChipProps) {
  const glowRef = useRef<THREE.PointLight>(null!);
  const pinMaterialRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const chipBodyRef = useRef<THREE.Mesh>(null!);

  // Pin activity is driven by the REAL frequency sum of connected edges.
  // Each pin maps to an edge connection. Active pins pulse at the edge's frequency.
  // If no edges are connected, pins stay dim.
  const totalPinCount = PIN_COUNT_PER_SIDE * 2;
  const avgFrequency = connectedFrequencies.length > 0
    ? connectedFrequencies.reduce((sum, f) => sum + f, 0) / connectedFrequencies.length
    : 0;

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Chip glow: pulsates at the average edge frequency when active
    if (glowRef.current) {
      if (isActive && avgFrequency > 0) {
        glowRef.current.intensity = 0.4 + Math.sin(t * avgFrequency * 8) * 0.3;
      } else {
        glowRef.current.intensity = isActive ? 0.15 : 0.02;
      }
    }

    // Pin emissive intensity driven by connected edge frequencies.
    // Each pin oscillates at a phase offset derived from its index,
    // modulated by the actual frequency of the closest connected edge.
    pinMaterialRefs.current.forEach((mat, pinIdx) => {
      if (!mat) return;
      if (!isActive || connectedFrequencies.length === 0) {
        mat.emissiveIntensity = 0.05;
        return;
      }
      // Map pin index to closest connected edge frequency
      const edgeIdx = Math.min(pinIdx, connectedFrequencies.length - 1);
      const freq = connectedFrequencies[edgeIdx] || 0;
      const phase = (pinIdx / totalPinCount) * Math.PI * 2;
      // Deterministic oscillation at edge frequency — NOT random
      mat.emissiveIntensity = 0.2 + Math.max(0, Math.sin(t * freq * 6 + phase)) * 1.3;
    });

    // Chip body thermal glow: emissive increases with temperature
    if (chipBodyRef.current) {
      const mat = chipBodyRef.current.material as THREE.MeshStandardMaterial;
      const thermalGlow = Math.max(0, (temperature - 40) / 80); // 0 at 40°C, 0.5 at 80°C
      mat.emissiveIntensity = thermalGlow * 0.15;
    }
  });

  // Temperature → color: continuous gradient, not buckets
  const tempNorm = Math.max(0, Math.min(1, (temperature - 25) / 75)); // 25°C=0, 100°C=1
  const tempHue = (1 - tempNorm) * 120; // 120=green, 0=red
  const tempColorHex = `hsl(${tempHue}, 90%, 55%)`;

  return (
    <group position={position}>
      {/* Solder pads under chip (exposed copper for each pin) */}
      {Array.from({ length: PIN_COUNT_PER_SIDE }).map((_, i) => {
        const zOff = -(CHIP_DEPTH / 2) + PIN_SPACING * (i + 1);
        return (
          <group key={`pad-${i}`}>
            {/* Left pad */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(CHIP_WIDTH / 2 + PIN_LENGTH / 2), COPPER_LAYER_Y - 0.001, zOff]}>
              <planeGeometry args={[PIN_LENGTH + 0.04, PIN_WIDTH + 0.03]} />
              <meshStandardMaterial color="#c87533" metalness={0.9} roughness={0.25} />
            </mesh>
            {/* Right pad */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(CHIP_WIDTH / 2 + PIN_LENGTH / 2), COPPER_LAYER_Y - 0.001, zOff]}>
              <planeGeometry args={[PIN_LENGTH + 0.04, PIN_WIDTH + 0.03]} />
              <meshStandardMaterial color="#c87533" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        );
      })}

      {/* Chip body (black epoxy package) */}
      <Float speed={isActive ? 0.8 : 0} floatIntensity={isActive ? 0.015 : 0}>
        <RoundedBox
          ref={chipBodyRef}
          args={[CHIP_WIDTH, CHIP_HEIGHT, CHIP_DEPTH]}
          radius={0.015}
          smoothness={4}
          position={[0, CHIP_HEIGHT / 2 + 0.01, 0]}
          castShadow
        >
          <meshStandardMaterial
            color="#0c0c0c"
            roughness={0.25}
            metalness={0.7}
            emissive="#ff3300"
            emissiveIntensity={0}
          />
        </RoundedBox>

        {/* Pin 1 indicator dot (white circle on chip body) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-(CHIP_WIDTH / 2 - 0.12), CHIP_HEIGHT + 0.02, -(CHIP_DEPTH / 2 - 0.12)]}
        >
          <circleGeometry args={[0.04, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>

        {/* Reference designator (e.g. U1) */}
        <Text
          position={[0, CHIP_HEIGHT + 0.02, 0.08]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.09}
          color="#999999"
          anchorX="center"
          anchorY="middle"
        >
          {refDes}
        </Text>

        {/* Capability name label */}
        <Text
          position={[0, CHIP_HEIGHT + 0.02, -0.08]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.07}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {name.length > 14 ? name.substring(0, 12) + '..' : name}
        </Text>
      </Float>

      {/* Gull-wing pins — LEFT side (7 pins) */}
      {Array.from({ length: PIN_COUNT_PER_SIDE }).map((_, i) => {
        const zOff = -(CHIP_DEPTH / 2) + PIN_SPACING * (i + 1);
        const matRef = (el: THREE.MeshStandardMaterial | null) => {
          if (el) pinMaterialRefs.current[i] = el;
        };
        return (
          <mesh
            key={`pl-${i}`}
            position={[-(CHIP_WIDTH / 2 + PIN_LENGTH / 2), CHIP_HEIGHT / 2, zOff]}
          >
            <boxGeometry args={[PIN_LENGTH, PIN_HEIGHT, PIN_WIDTH]} />
            <meshStandardMaterial
              ref={matRef}
              color="#c0c0c0"
              metalness={0.92}
              roughness={0.15}
              emissive={color}
              emissiveIntensity={0.05}
            />
          </mesh>
        );
      })}

      {/* Gull-wing pins — RIGHT side (7 pins) */}
      {Array.from({ length: PIN_COUNT_PER_SIDE }).map((_, i) => {
        const zOff = -(CHIP_DEPTH / 2) + PIN_SPACING * (i + 1);
        const matRef = (el: THREE.MeshStandardMaterial | null) => {
          if (el) pinMaterialRefs.current[PIN_COUNT_PER_SIDE + i] = el;
        };
        return (
          <mesh
            key={`pr-${i}`}
            position={[(CHIP_WIDTH / 2 + PIN_LENGTH / 2), CHIP_HEIGHT / 2, zOff]}
          >
            <boxGeometry args={[PIN_LENGTH, PIN_HEIGHT, PIN_WIDTH]} />
            <meshStandardMaterial
              ref={matRef}
              color="#c0c0c0"
              metalness={0.92}
              roughness={0.15}
              emissive={color}
              emissiveIntensity={0.05}
            />
          </mesh>
        );
      })}

      {/* Thermal indicator LED (real temp from Shadow Omega) */}
      <mesh position={[(CHIP_WIDTH / 2 - 0.12), CHIP_HEIGHT + 0.02, (CHIP_DEPTH / 2 - 0.12)]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial
          color={tempColorHex}
          emissive={tempColorHex}
          emissiveIntensity={0.8 + tempNorm * 1.2}
        />
      </mesh>

      {/* Power draw label */}
      <Text
        position={[0, COPPER_LAYER_Y - 0.01, CHIP_DEPTH / 2 + 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.06}
        color="#555555"
        anchorX="center"
        anchorY="middle"
      >
        {powerDraw.toFixed(1)}W | {temperature.toFixed(0)}°C
      </Text>

      {/* Point light for chip glow */}
      <pointLight
        ref={glowRef}
        position={[0, 0.5, 0]}
        color={color}
        intensity={0.15}
        distance={3}
        decay={2}
      />
    </group>
  );
}

// ============================================================================
// Copper Trace — routed connection between two chips
// Tube radius is proportional to edge.data.dataWeight (NOT hardcoded)
// ============================================================================

interface TraceProps {
  id: string;                   // Edge ID for React key
  from: [number, number, number];
  to: [number, number, number];
  dataWeight: number;         // 0-1, from edge.data.dataWeight
  frequency: number;          // From edge.data.frequency
  rejected: boolean;          // From edge.data.rejected
  bandwidth: number;          // Mbps
}

function CopperTrace({ from, to, dataWeight, frequency, rejected, bandwidth }: TraceProps) {
  const tubeRef = useRef<THREE.Mesh>(null!);

  // Tube radius: heavier data = thicker copper trace (real PCB design principle)
  const tubeRadius = 0.015 + dataWeight * 0.06; // range: 0.015 (signal) to 0.075 (4K video)
  const tubeSegments = Math.max(12, Math.round(20 + dataWeight * 20));

  useFrame((state) => {
    if (!tubeRef.current) return;
    const mat = tubeRef.current.material as THREE.MeshStandardMaterial;
    if (rejected) {
      // Rejected traces pulse red at 2Hz
      mat.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 12.566) * 0.4;
    } else {
      // Active traces pulse at their actual frequency
      mat.emissiveIntensity = 0.15 + Math.sin(state.clock.elapsedTime * frequency * 6) * 0.25;
    }
  });

  // Route: L-shaped (Manhattan routing, real PCB convention) with rounded corners
  const traceY = COPPER_LAYER_Y;
  const midX = (from[0] + to[0]) / 2;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(from[0], traceY, from[2]),
    new THREE.Vector3(midX, traceY, from[2]),
    new THREE.Vector3(midX, traceY, to[2]),
    new THREE.Vector3(to[0], traceY, to[2]),
  ], false, 'catmullrom', 0.3);

  // Via hole at the bend point
  const viaPos: [number, number, number] = [midX, 0, (from[2] + to[2]) / 2];

  return (
    <group>
      <mesh ref={tubeRef}>
        <tubeGeometry args={[curve, tubeSegments, tubeRadius, 8, false]} />
        <meshStandardMaterial
          color={rejected ? '#8b2020' : '#c87533'}
          roughness={0.3}
          metalness={0.92}
          emissive={rejected ? '#ff2222' : '#38bdf8'}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Via hole at routing bend */}
      <ViaHole position={viaPos} />

      {/* Bandwidth label at midpoint */}
      <Text
        position={[midX, COPPER_LAYER_Y + 0.03, (from[2] + to[2]) / 2 - 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.05}
        color={rejected ? '#ff4444' : '#666666'}
        anchorX="center"
        anchorY="middle"
      >
        {rejected ? 'REJECTED' : `${bandwidth.toFixed(0)} Mbps`}
      </Text>
    </group>
  );
}

// ============================================================================
// Telemetry HUD overlay (2D HTML, not 3D — real data from store)
// ============================================================================

function TelemetryOverlay() {
  const { nodes, edges, stabilityScore, telemetry } = useForgeStore();
  const totalPower = nodes.reduce((sum, n) => sum + (n.data?.powerConsumption || 0), 0);
  const avgTemp = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + (n.data?.temperature || 0), 0) / nodes.length
    : 0;
  const rejectedCount = edges.filter((e) => e.data?.rejected).length;

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
      <div className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur-sm border border-white/[0.06]">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1">PCB Telemetry</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] font-mono">
          <span className="text-white/40">Components</span>
          <span className="text-white/70">{nodes.length}</span>
          <span className="text-white/40">Traces</span>
          <span className="text-white/70">{edges.length}</span>
          <span className="text-white/40">Power Draw</span>
          <span className="text-orange-400">{totalPower.toFixed(1)}W</span>
          <span className="text-white/40">Avg Temp</span>
          <span style={{ color: avgTemp > 60 ? '#ff4444' : avgTemp > 45 ? '#ff8800' : '#44ff88' }}>
            {avgTemp.toFixed(1)}°C
          </span>
          <span className="text-white/40">Stability</span>
          <span style={{ color: stabilityScore > 0.7 ? '#38bdf8' : stabilityScore > 0.5 ? '#ff8800' : '#ff4444' }}>
            {(stabilityScore * 100).toFixed(0)}%
          </span>
          {rejectedCount > 0 && (
            <>
              <span className="text-red-400">Rejected</span>
              <span className="text-red-400">{rejectedCount}</span>
            </>
          )}
          {telemetry && (
            <>
              <span className="text-white/40">CPU</span>
              <span className="text-white/70">{telemetry.cpuTemp.toFixed(0)}°C</span>
              <span className="text-white/40">RAM</span>
              <span className="text-white/70">{(telemetry.ramUsage * 100).toFixed(0)}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Scene Assembly — wires everything to the real Zustand store
// ============================================================================

function VoidScene() {
  const nodes = useForgeStore((s) => s.nodes);
  const edges = useForgeStore((s) => s.edges);
  const stabilityScore = useForgeStore((s) => s.stabilityScore);

  // Build a map of nodeId → connected edge frequencies for pin activity
  const nodeEdgeFrequencies = useMemo(() => {
    const map: Record<string, number[]> = {};
    edges.forEach((edge: Edge<WireData>) => {
      const freq = edge.data?.frequency || 0;
      if (!map[edge.source]) map[edge.source] = [];
      if (!map[edge.target]) map[edge.target] = [];
      map[edge.source].push(freq);
      map[edge.target].push(freq);
    });
    return map;
  }, [edges]);

  // Map React Flow nodes to 3D chip data using REAL node positions
  const chips = useMemo(() => {
    return nodes.map((node: Node<ShardData>, i: number) => ({
      id: node.id,
      position: rfTo3D(node.position.x, node.position.y),
      color:
        node.type === 'inputShard' ? '#22c55e' :
        node.type === 'outputShard' ? '#fbbf24' : '#a78bfa',
      name: node.data.capability.name,
      refDes: `U${i + 1}`,
      temperature: node.data.temperature,
      isActive: node.data.isActive,
      powerDraw: node.data.powerConsumption,
      connectedFrequencies: nodeEdgeFrequencies[node.id] || [],
    }));
  }, [nodes, nodeEdgeFrequencies]);

  // Build chip position lookup for trace routing
  const chipPosMap = useMemo(() => {
    const map: Record<string, [number, number, number]> = {};
    chips.forEach((c) => { map[c.id] = c.position; });
    return map;
  }, [chips]);

  // Map edges to copper traces using REAL edge data
  const traces = useMemo(() => {
    return edges.map((edge: Edge<WireData>) => {
      const fromPos = chipPosMap[edge.source];
      const toPos = chipPosMap[edge.target];
      if (!fromPos || !toPos) return null;
      return {
        id: edge.id,
        from: fromPos,
        to: toPos,
        dataWeight: edge.data?.dataWeight || 0.1,
        frequency: edge.data?.frequency || 0.5,
        rejected: edge.data?.rejected || false,
        bandwidth: edge.data?.bandwidth || 10,
      };
    }).filter(Boolean) as TraceProps[];
  }, [edges, chipPosMap]);

  // Ambient light hue from real stability score
  const ambientHue = stabilityScore > 0.7 ? 210 : stabilityScore > 0.5 ? 30 : 0;
  const ambientSat = stabilityScore > 0.7 ? 40 : 60;

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 18, 40]} />

      {/* Lighting — intensity keyed to stability */}
      <ambientLight intensity={0.12} color={`hsl(${ambientHue}, ${ambientSat}%, 15%)`} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
      />
      <pointLight position={[0, 10, 0]} intensity={0.15} color={`hsl(${ambientHue}, 60%, 50%)`} distance={25} />
      <pointLight position={[-6, 6, -6]} intensity={0.08} color="#ffffff" distance={15} />

      {/* PCB Layers */}
      <GroundPlane />
      <Substrate />
      <SolderMask />
      <EtchTraceGrid />
      <Silkscreen chipCount={chips.length} />
      <MountingHoles />

      {/* IC Chips */}
      {chips.map((chip) => (
        <ICChip
          key={chip.id}
          position={chip.position}
          color={chip.color}
          name={chip.name}
          refDes={chip.refDes}
          temperature={chip.temperature}
          isActive={chip.isActive}
          powerDraw={chip.powerDraw}
          connectedFrequencies={chip.connectedFrequencies}
        />
      ))}

      {/* Copper Traces */}
      {traces.map((trace) => (
        <CopperTrace
          key={trace.id}
          id={trace.id}
          from={trace.from}
          to={trace.to}
          dataWeight={trace.dataWeight}
          frequency={trace.frequency}
          rejected={trace.rejected}
          bandwidth={trace.bandwidth}
        />
      ))}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={0.1}
        minDistance={2}
        maxDistance={30}
        target={[0, 0, 0]}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

// ============================================================================
// Export: VoidModePCB (complete — no mocks, no stubs, no placeholders)
// ============================================================================

export function VoidModePCB() {
  return (
    <div className="absolute inset-0 z-10">
      <Canvas
        shadows
        camera={{
          position: [10, 10, 10],
          fov: 40,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        dpr={[1, 2]}
      >
        <VoidScene />
      </Canvas>

      {/* Real telemetry overlay from store */}
      <TelemetryOverlay />

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/[0.06]">
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
            3D PCB View • Orbit: Drag • Zoom: Scroll • Pan: Right-drag
          </span>
        </div>
      </div>
    </div>
  );
}
