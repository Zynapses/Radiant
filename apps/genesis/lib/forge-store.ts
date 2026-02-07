// Genesis Forge — Zustand Store
// High-frequency state updates for the Glass Foundry canvas
// Handles graph topology, telemetry stream, shard state, and Void Mode

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, Connection } from 'reactflow';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { OmegaInstance, OmegaTelemetry } from './omega-registry';

// ============================================================================
// Shard Types (Node Data)
// ============================================================================

export type ShardType = 'input' | 'logic' | 'output';

export interface ShardCapability {
  id: string;
  name: string;
  category: 'sensor' | 'processor' | 'actuator' | 'network' | 'ai' | 'safety';
  icon: string;
  shardType: ShardType;
  dataWeight: number;      // 0-1: affects wire sag (heavier = deeper catenary)
  powerDraw: number;       // Watts
  latencyMs: number;       // Processing latency
  description: string;
}

export interface ShardData {
  capability: ShardCapability;
  powerConsumption: number;
  isActive: boolean;
  temperature: number;     // Simulated thermal from Shadow Omega
  stabilityLocal: number;  // Per-shard stability
  errorMessage?: string;   // Set by Shadow Omega when connection is rejected
}

export interface WireData {
  dataWeight: number;      // Controls catenary sag depth
  frequency: number;       // Particle speed in wire
  bandwidth: number;       // Mbps
  rejected: boolean;       // Shadow Omega rejected this connection
  rejectReason?: string;
  suggestion?: string;     // Suggested fix from Shadow Omega
}

// ============================================================================
// Forge State
// ============================================================================

export interface ForgeState {
  // Graph
  nodes: Node<ShardData>[];
  edges: Edge<WireData>[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addShard: (capability: ShardCapability, position: { x: number; y: number }) => void;
  removeShard: (nodeId: string) => void;

  // Omega Instance Connection
  connectedInstance: OmegaInstance | null;
  setConnectedInstance: (instance: OmegaInstance | null) => void;

  // Telemetry (high-frequency updates from Shadow Omega)
  telemetry: OmegaTelemetry | null;
  setTelemetry: (telemetry: OmegaTelemetry) => void;
  stabilityScore: number;  // Global stability — drives UI hue shift
  setStabilityScore: (score: number) => void;

  // Shadow Omega feedback
  rejectEdge: (edgeId: string, reason: string, suggestion?: string) => void;
  clearRejection: (edgeId: string) => void;
  updateShardTemp: (nodeId: string, temp: number) => void;

  // Forge / Compile
  isForging: boolean;
  forgeProgress: number;   // 0-1
  forgeResult: { success: boolean; binUrl?: string; error?: string } | null;
  startForge: () => void;
  setForgeProgress: (progress: number) => void;
  completeForge: (result: { success: boolean; binUrl?: string; error?: string }) => void;
  resetForge: () => void;

  // Void Mode
  voidMode: boolean;
  toggleVoidMode: () => void;

  // Armory
  armoryOpen: boolean;
  toggleArmory: () => void;

  // Oracle (telemetry panel)
  oracleOpen: boolean;
  toggleOracle: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

let nodeIdCounter = 0;

export const useForgeStore = create<ForgeState>()(
  subscribeWithSelector((set, get) => ({
    // Graph
    nodes: [],
    edges: [],

    onNodesChange: (changes) => {
      set({ nodes: applyNodeChanges(changes, get().nodes) });
    },

    onEdgesChange: (changes) => {
      set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    onConnect: (connection: Connection) => {
      const sourceNode = get().nodes.find((n) => n.id === connection.source);
      const targetNode = get().nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const dataWeight = Math.max(
        sourceNode.data.capability.dataWeight,
        targetNode.data.capability.dataWeight
      );

      const newEdge: Edge<WireData> = {
        id: `wire-${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'catenary',
        data: {
          dataWeight,
          frequency: 0.5 + Math.random() * 0.5,
          bandwidth: 100 * (1 - dataWeight) + 10,
          rejected: false,
        },
      };

      set({ edges: addEdge(newEdge, get().edges) });
    },

    addShard: (capability, position) => {
      const id = `shard-${++nodeIdCounter}-${Date.now()}`;
      const newNode: Node<ShardData> = {
        id,
        type: capability.shardType === 'input' ? 'inputShard' :
              capability.shardType === 'output' ? 'outputShard' : 'logicShard',
        position,
        data: {
          capability,
          powerConsumption: capability.powerDraw,
          isActive: true,
          temperature: 35 + Math.random() * 20,
          stabilityLocal: 0.8 + Math.random() * 0.2,
        },
      };
      set({ nodes: [...get().nodes, newNode] });
    },

    removeShard: (nodeId) => {
      set({
        nodes: get().nodes.filter((n) => n.id !== nodeId),
        edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      });
    },

    // Omega Instance
    connectedInstance: null,
    setConnectedInstance: (instance) => set({ connectedInstance: instance }),

    // Telemetry
    telemetry: null,
    setTelemetry: (telemetry) => set({ telemetry, stabilityScore: telemetry.stabilityScore }),
    stabilityScore: 1.0,
    setStabilityScore: (score) => set({ stabilityScore: score }),

    // Shadow Omega feedback
    rejectEdge: (edgeId, reason, suggestion) => {
      set({
        edges: get().edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data!, rejected: true, rejectReason: reason, suggestion } }
            : e
        ),
      });
    },

    clearRejection: (edgeId) => {
      set({
        edges: get().edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data!, rejected: false, rejectReason: undefined, suggestion: undefined } }
            : e
        ),
      });
    },

    updateShardTemp: (nodeId, temp) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, temperature: temp } } : n
        ),
      });
    },

    // Forge
    isForging: false,
    forgeProgress: 0,
    forgeResult: null,
    startForge: () => set({ isForging: true, forgeProgress: 0, forgeResult: null }),
    setForgeProgress: (progress) => set({ forgeProgress: progress }),
    completeForge: (result) => set({ isForging: false, forgeProgress: 1, forgeResult: result }),
    resetForge: () => set({ isForging: false, forgeProgress: 0, forgeResult: null }),

    // Void Mode
    voidMode: false,
    toggleVoidMode: () => set({ voidMode: !get().voidMode }),

    // Panels
    armoryOpen: true,
    toggleArmory: () => set({ armoryOpen: !get().armoryOpen }),
    oracleOpen: true,
    toggleOracle: () => set({ oracleOpen: !get().oracleOpen }),
  }))
);

// ============================================================================
// Capability Library (The Armory)
// ============================================================================

export const CAPABILITY_LIBRARY: ShardCapability[] = [
  // Sensors (Input Shards)
  { id: 'camera', name: 'Camera', category: 'sensor', icon: 'Camera', shardType: 'input', dataWeight: 0.85, powerDraw: 2.5, latencyMs: 16, description: 'RGB camera sensor (1080p @ 60fps)' },
  { id: 'lidar', name: 'LiDAR', category: 'sensor', icon: 'Scan', shardType: 'input', dataWeight: 0.7, powerDraw: 3.8, latencyMs: 33, description: '3D point cloud scanner (10k pts/frame)' },
  { id: 'microphone', name: 'Microphone', category: 'sensor', icon: 'Mic', shardType: 'input', dataWeight: 0.2, powerDraw: 0.3, latencyMs: 1, description: 'Audio input (48kHz stereo)' },
  { id: 'imu', name: 'IMU', category: 'sensor', icon: 'Compass', shardType: 'input', dataWeight: 0.05, powerDraw: 0.1, latencyMs: 0.5, description: '9-axis inertial measurement unit' },
  { id: 'temperature', name: 'Temp Sensor', category: 'sensor', icon: 'Thermometer', shardType: 'input', dataWeight: 0.01, powerDraw: 0.01, latencyMs: 100, description: 'Ambient temperature probe' },
  { id: 'gps', name: 'GPS', category: 'sensor', icon: 'MapPin', shardType: 'input', dataWeight: 0.02, powerDraw: 0.5, latencyMs: 1000, description: 'GNSS positioning module' },

  // Processors (Logic Shards)
  { id: 'face_detect', name: 'Face Detection', category: 'ai', icon: 'ScanFace', shardType: 'logic', dataWeight: 0.6, powerDraw: 4.2, latencyMs: 25, description: 'Real-time face detection (YOLO v8)' },
  { id: 'nlp', name: 'NLP Engine', category: 'ai', icon: 'MessageSquare', shardType: 'logic', dataWeight: 0.4, powerDraw: 5.0, latencyMs: 50, description: 'Natural language processing pipeline' },
  { id: 'video_compress', name: 'Video Compressor', category: 'processor', icon: 'FileVideo', shardType: 'logic', dataWeight: 0.3, powerDraw: 3.0, latencyMs: 8, description: 'H.265 hardware encoder' },
  { id: 'point_cloud', name: 'Point Cloud Proc', category: 'processor', icon: 'Box', shardType: 'logic', dataWeight: 0.5, powerDraw: 3.5, latencyMs: 20, description: 'LiDAR point cloud processor' },
  { id: 'kalman', name: 'Kalman Filter', category: 'processor', icon: 'TrendingUp', shardType: 'logic', dataWeight: 0.1, powerDraw: 0.5, latencyMs: 1, description: 'Sensor fusion & state estimation' },
  { id: 'helix_gate', name: 'Helix Safety Gate', category: 'safety', icon: 'Shield', shardType: 'logic', dataWeight: 0.15, powerDraw: 1.0, latencyMs: 2, description: 'Destructive interference safety filter' },
  { id: 'neural_bridge', name: 'Neural Bridge', category: 'ai', icon: 'Zap', shardType: 'logic', dataWeight: 0.75, powerDraw: 8.0, latencyMs: 35, description: 'NeuralTransducer: Complex^2048 → [8,4096] soft tokens' },

  // Actuators & Output (Output Shards)
  { id: 'wifi_tx', name: 'WiFi Transmitter', category: 'network', icon: 'Wifi', shardType: 'output', dataWeight: 0.4, powerDraw: 2.0, latencyMs: 5, description: 'WiFi 6E radio (up to 150 Mbps)' },
  { id: 'motor_ctrl', name: 'Motor Controller', category: 'actuator', icon: 'Cog', shardType: 'output', dataWeight: 0.1, powerDraw: 12.0, latencyMs: 1, description: 'Brushless DC motor driver' },
  { id: 'display', name: 'Display Output', category: 'actuator', icon: 'Monitor', shardType: 'output', dataWeight: 0.7, powerDraw: 5.0, latencyMs: 8, description: 'HDMI 2.1 display output' },
  { id: 'speaker', name: 'Speaker', category: 'actuator', icon: 'Volume2', shardType: 'output', dataWeight: 0.15, powerDraw: 1.5, latencyMs: 2, description: 'Audio output (DAC + amplifier)' },
  { id: 'gpio', name: 'GPIO', category: 'actuator', icon: 'ToggleLeft', shardType: 'output', dataWeight: 0.01, powerDraw: 0.01, latencyMs: 0, description: 'General purpose I/O pins' },
];
