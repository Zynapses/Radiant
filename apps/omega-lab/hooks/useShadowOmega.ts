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

  // Polling fallback — polls real /state data when WebSocket is unavailable
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const startPollingFallback = useCallback((inst: OmegaInstance) => {
    console.log(`[ShadowOmega] Using REST polling for ${inst.name}`);
    setConnected(true);

    if (pollingRef.current) clearInterval(pollingRef.current);

    // Import dynamically to avoid circular deps
    const { fetchInstanceTelemetry } = require('@/lib/omega-registry');

    // Poll real telemetry from the proving ground server
    const poll = async () => {
      try {
        const telemetry: OmegaTelemetry = await fetchInstanceTelemetry(inst.id);
        setTelemetry(telemetry);
      } catch (err) {
        console.warn('[ShadowOmega] Telemetry poll failed:', err);
      }
    };

    poll(); // Immediate first poll
    pollingRef.current = setInterval(poll, 2000);
  }, [setTelemetry]);

  // Real forge — saves a checkpoint via the proving ground server
  const simulateForge = useCallback(() => {
    const { startForge, setForgeProgress: setProgress, completeForge: complete } = useForgeStore.getState();
    startForge();

    const pgBase = process.env.NEXT_PUBLIC_OMEGA_PG_URL || 'http://localhost:11435';

    // Show progress while the real save happens
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 0.03, 0.9);
      setProgress(progress);
    }, 150);

    fetch(`${pgBase}/train/save`, { method: 'POST' })
      .then(async (res) => {
        clearInterval(progressInterval);
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
        const data = await res.json();
        complete({
          success: true,
          binUrl: data.checkpoint_path || data.path || undefined,
        });
      })
      .catch((err) => {
        clearInterval(progressInterval);
        complete({
          success: false,
          error: err.message || 'Forge failed — checkpoint save error',
        });
      });
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
