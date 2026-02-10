// OMEGA Instance Registry
// Each OMEGA brain instance has a unique ID, name, and endpoint.
// OMEGA Forge can talk to any instance through the registry.

export interface OmegaInstance {
  id: string;
  name: string;
  tenantId: string;
  endpoint: string;          // WebSocket endpoint: wss://shadow-omega-{id}.internal
  status: 'online' | 'offline' | 'dreaming' | 'forging';
  region: string;
  bridgeMode: 'active' | 'shadow' | 'disabled';
  lastHeartbeat: number;     // Unix timestamp
  coherenceScore: number;    // 0-1
  entropyLevel: number;      // 0-1
  cpuTemp: number;           // Simulated thermal (Celsius)
  ramUsage: number;          // 0-1
  stabilityScore: number;    // 0-1, drives UI Emergency Mode
  firmwareVersion: string;
  totalCycles: number;
  neuralDensityMb: number;
}

export interface OmegaTelemetry {
  instanceId: string;
  timestamp: number;
  cpuTemp: number;
  ramUsage: number;
  stabilityScore: number;
  coherenceScore: number;
  entropyLevel: number;
  powerBudgetHours: number;
  thermalMap: number[];       // 8x8 grid of thermal values
  activeConnections: number;
  inferenceLatencyMs: number;
  bridgeInjectionNorm: number;
  watcherSurprise: number;
}

export interface RegistryState {
  instances: OmegaInstance[];
  selectedInstanceId: string | null;
  loading: boolean;
  error: string | null;
}

const REGISTRY_API = process.env.NEXT_PUBLIC_OMEGA_REGISTRY_URL || 'http://localhost:3001/api/admin/omega/registry';

export async function fetchOmegaInstances(): Promise<OmegaInstance[]> {
  try {
    const response = await fetch(`${REGISTRY_API}/instances`);
    if (!response.ok) throw new Error(`Registry error: ${response.status}`);
    const data = await response.json();
    return data.instances || [];
  } catch {
    // Return mock instances for development
    return getMockInstances();
  }
}

export async function fetchInstanceTelemetry(instanceId: string): Promise<OmegaTelemetry> {
  try {
    const response = await fetch(`${REGISTRY_API}/instances/${instanceId}/telemetry`);
    if (!response.ok) throw new Error(`Telemetry error: ${response.status}`);
    return response.json();
  } catch {
    return getMockTelemetry(instanceId);
  }
}

export function getWebSocketUrl(instance: OmegaInstance): string {
  // Each instance has its own WebSocket endpoint for real-time telemetry
  const wsProtocol = instance.endpoint.startsWith('https') ? 'wss' : 'ws';
  const host = instance.endpoint.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}/ws/forge`;
}

// Development mock data — 4 Omega instances
function getMockInstances(): OmegaInstance[] {
  const now = Date.now();
  return [
    {
      id: 'omega-prime',
      name: 'OMEGA Prime',
      tenantId: 'tenant_001',
      endpoint: 'http://localhost:8100',
      status: 'online',
      region: 'us-east-1',
      bridgeMode: 'shadow',
      lastHeartbeat: now - 2000,
      coherenceScore: 0.87,
      entropyLevel: 0.34,
      cpuTemp: 62,
      ramUsage: 0.45,
      stabilityScore: 0.92,
      firmwareVersion: '2.1.0',
      totalCycles: 14_832,
      neuralDensityMb: 48.2,
    },
    {
      id: 'omega-shadow',
      name: 'Shadow Sentinel',
      tenantId: 'tenant_002',
      endpoint: 'http://localhost:8101',
      status: 'online',
      region: 'us-west-2',
      bridgeMode: 'shadow',
      lastHeartbeat: now - 5000,
      coherenceScore: 0.73,
      entropyLevel: 0.56,
      cpuTemp: 71,
      ramUsage: 0.62,
      stabilityScore: 0.78,
      firmwareVersion: '2.0.3',
      totalCycles: 9_451,
      neuralDensityMb: 35.7,
    },
    {
      id: 'omega-forge',
      name: 'Forge Testbed',
      tenantId: 'tenant_003',
      endpoint: 'http://localhost:8102',
      status: 'dreaming',
      region: 'eu-west-1',
      bridgeMode: 'active',
      lastHeartbeat: now - 30000,
      coherenceScore: 0.95,
      entropyLevel: 0.12,
      cpuTemp: 45,
      ramUsage: 0.28,
      stabilityScore: 0.98,
      firmwareVersion: '2.1.0',
      totalCycles: 22_109,
      neuralDensityMb: 67.1,
    },
    {
      id: 'omega-canary',
      name: 'Canary Instance',
      tenantId: 'tenant_004',
      endpoint: 'http://localhost:8103',
      status: 'offline',
      region: 'ap-southeast-1',
      bridgeMode: 'disabled',
      lastHeartbeat: now - 3600000,
      coherenceScore: 0.41,
      entropyLevel: 0.82,
      cpuTemp: 22,
      ramUsage: 0.05,
      stabilityScore: 0.35,
      firmwareVersion: '1.9.2',
      totalCycles: 3_201,
      neuralDensityMb: 12.4,
    },
  ];
}

function getMockTelemetry(instanceId: string): OmegaTelemetry {
  return {
    instanceId,
    timestamp: Date.now(),
    cpuTemp: 55 + Math.random() * 30,
    ramUsage: 0.3 + Math.random() * 0.5,
    stabilityScore: 0.5 + Math.random() * 0.5,
    coherenceScore: 0.5 + Math.random() * 0.5,
    entropyLevel: Math.random() * 0.8,
    powerBudgetHours: 2 + Math.random() * 6,
    thermalMap: Array.from({ length: 64 }, () => 30 + Math.random() * 50),
    activeConnections: Math.floor(Math.random() * 12),
    inferenceLatencyMs: 10 + Math.random() * 90,
    bridgeInjectionNorm: Math.random() * 5,
    watcherSurprise: Math.random() * 0.8,
  };
}
