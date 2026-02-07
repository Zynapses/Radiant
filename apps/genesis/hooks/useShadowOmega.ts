// useShadowOmega() — Persistent WebSocket connection to Shadow Omega
// Bi-directional feedback loop between the Glass Foundry UI and the Simulation Kernel
//
// OUTBOUND: Send graph topology updates to Shadow Omega for analysis
// INBOUND:  Receive telemetry_stream, edge_rejection, shard_thermal, stability_score
//
// Visual Mapping: stability_score drives global UI hue (Cyan → Red Emergency Mode)

import { useEffect, useRef, useCallback, useState } from 'react';
import { useForgeStore } from '@/lib/forge-store';
import type { OmegaInstance, OmegaTelemetry } from '@/lib/omega-registry';
import { getWebSocketUrl } from '@/lib/omega-registry';

export interface ShadowOmegaMessage {
  type: 'telemetry_stream' | 'edge_rejection' | 'shard_thermal' | 'forge_result' | 'stability_update' | 'suggestion';
  payload: Record<string, any>;
}

export interface GraphTopologyUpdate {
  type: 'graph_update';
  nodes: Array<{ id: string; capabilityId: string; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; dataWeight: number }>;
  instanceId: string;
  timestamp: number;
}

export function useShadowOmega(instance: OmegaInstance | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ShadowOmegaMessage | null>(null);

  const {
    nodes,
    edges,
    setTelemetry,
    setStabilityScore,
    rejectEdge,
    updateShardTemp,
    completeForge,
    setForgeProgress,
  } = useForgeStore();

  // Handle incoming messages from Shadow Omega
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: ShadowOmegaMessage = JSON.parse(event.data);
      setLastMessage(msg);

      switch (msg.type) {
        case 'telemetry_stream': {
          const telemetry = msg.payload as OmegaTelemetry;
          setTelemetry(telemetry);
          break;
        }

        case 'stability_update': {
          setStabilityScore(msg.payload.stabilityScore);
          break;
        }

        case 'edge_rejection': {
          // Shadow Omega analyzed a connection and rejected it
          // The wire sparks red and vibrates on the UI
          rejectEdge(
            msg.payload.edgeId,
            msg.payload.reason,
            msg.payload.suggestion
          );
          break;
        }

        case 'shard_thermal': {
          // Update individual shard temperature from simulation
          updateShardTemp(msg.payload.nodeId, msg.payload.temperature);
          break;
        }

        case 'forge_result': {
          completeForge({
            success: msg.payload.success,
            binUrl: msg.payload.binUrl,
            error: msg.payload.error,
          });
          break;
        }

        case 'suggestion': {
          // Shadow Omega suggests a capability to fix a problem
          // Highlighted in the Armory
          break;
        }
      }
    } catch (err) {
      console.error('[ShadowOmega] Failed to parse message:', err);
    }
  }, [setTelemetry, setStabilityScore, rejectEdge, updateShardTemp, completeForge, setForgeProgress]);

  // Connect to Shadow Omega WebSocket
  const connect = useCallback(() => {
    if (!instance) return;

    const url = getWebSocketUrl(instance);
    console.log(`[ShadowOmega] Connecting to ${instance.name} at ${url}`);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`[ShadowOmega] Connected to ${instance.name}`);
        setConnected(true);
        // Send initial graph state
        sendGraphUpdate(ws);
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log(`[ShadowOmega] Disconnected from ${instance.name}: ${event.code}`);
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => connect(), 3000);
      };

      ws.onerror = (error) => {
        console.error(`[ShadowOmega] WebSocket error:`, error);
        // Fall back to polling mode for development
        startPollingFallback(instance);
      };

      wsRef.current = ws;
    } catch {
      // WebSocket not available — use polling fallback
      startPollingFallback(instance);
    }
  }, [instance, handleMessage]);

  // Send graph topology to Shadow Omega for analysis
  const sendGraphUpdate = useCallback((ws?: WebSocket) => {
    const socket = ws || wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!instance) return;

    const update: GraphTopologyUpdate = {
      type: 'graph_update',
      nodes: nodes.map((n) => ({
        id: n.id,
        capabilityId: n.data.capability.id,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        dataWeight: e.data?.dataWeight || 0,
      })),
      instanceId: instance.id,
      timestamp: Date.now(),
    };

    socket.send(JSON.stringify(update));
  }, [nodes, edges, instance]);

  // Request forge/compile from Shadow Omega
  const requestForge = useCallback(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      // Simulate forge for development
      simulateForge();
      return;
    }

    socket.send(JSON.stringify({
      type: 'forge_request',
      nodes: nodes.map((n) => ({
        id: n.id,
        capabilityId: n.data.capability.id,
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
      instanceId: instance?.id,
    }));
  }, [nodes, edges, instance]);

  // Polling fallback for development (no WebSocket server)
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const startPollingFallback = useCallback((inst: OmegaInstance) => {
    console.log(`[ShadowOmega] Using polling fallback for ${inst.name}`);
    setConnected(true); // Treat as "connected" in dev mode

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(() => {
      // Generate simulated telemetry
      const simTelemetry: OmegaTelemetry = {
        instanceId: inst.id,
        timestamp: Date.now(),
        cpuTemp: 50 + Math.random() * 35,
        ramUsage: 0.3 + Math.random() * 0.4,
        stabilityScore: Math.max(0.2, Math.min(1.0, 0.7 + (Math.random() - 0.5) * 0.4)),
        coherenceScore: 0.5 + Math.random() * 0.5,
        entropyLevel: Math.random() * 0.7,
        powerBudgetHours: 2 + Math.random() * 6,
        thermalMap: Array.from({ length: 64 }, () => 25 + Math.random() * 55),
        activeConnections: nodes.length,
        inferenceLatencyMs: 10 + Math.random() * 80,
        bridgeInjectionNorm: Math.random() * 4,
        watcherSurprise: Math.random() * 0.6,
      };
      setTelemetry(simTelemetry);
    }, 1000);
  }, [nodes.length, setTelemetry]);

  // Simulate forge process for development
  const simulateForge = useCallback(() => {
    const { startForge, setForgeProgress: setProgress, completeForge: complete } = useForgeStore.getState();
    startForge();

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05 + Math.random() * 0.08;
      if (progress >= 1) {
        clearInterval(interval);
        complete({
          success: true,
          binUrl: `data:application/octet-stream;base64,${btoa('OMEGA_FIRMWARE_' + Date.now())}`,
        });
      } else {
        setProgress(progress);
      }
    }, 200);
  }, []);

  // Connect when instance changes
  useEffect(() => {
    // Cleanup previous connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setConnected(false);

    if (instance) {
      connect();
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [instance, connect]);

  // Send graph updates when topology changes (debounced)
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!connected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => sendGraphUpdate(), 300);
  }, [nodes, edges, connected, sendGraphUpdate]);

  return {
    connected,
    lastMessage,
    sendGraphUpdate,
    requestForge,
    simulateForge,
  };
}
