/**
 * Neural Operations API Routes
 * 
 * Proxies requests to the Neural Operations admin Lambda handler.
 */

import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

async function proxyRequest(
  req: AuthenticatedRequest,
  method: string,
  path: string[]
): Promise<NextResponse> {
  const token = getTokenFromRequest(req);
  const endpoint = `/admin/neural-operations/${path.join('/')}`;
  
  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': req.headers.get('X-Tenant-Id') || '',
      },
    };

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        const body = await req.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON
      }
    }

    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const fullUrl = queryString 
      ? `${API_BASE}${endpoint}?${queryString}`
      : `${API_BASE}${endpoint}`;

    const response = await fetch(fullUrl, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[NeuralOperations] ${method} ${endpoint} failed:`, error);
    
    // Return mock data for development when backend is unavailable
    if (path[0] === 'dashboard') {
      return NextResponse.json(getMockDashboardData());
    }
    
    return NextResponse.json(
      { error: { message: 'Failed to proxy neural operations request' } },
      { status: 500 }
    );
  }
}

// Mock data for development
function getMockDashboardData() {
  const networks = [
    { id: 'pattern', name: 'Pattern Network', version: 'v3.2.1', status: 'active', parameters: 1200000, requestsPerSecond: 4521, latencyP50Ms: 0.5, latencyP99Ms: 0.8, errorRate: 0.0001, lastUpdated: new Date().toISOString(), lastDeployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), region: 'us-east-1' },
    { id: 'routing', name: 'Routing Network', version: 'v2.1.0', status: 'active', parameters: 200000, requestsPerSecond: 4521, latencyP50Ms: 0.3, latencyP99Ms: 0.4, errorRate: 0.00005, lastUpdated: new Date().toISOString(), lastDeployedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), region: 'us-east-1' },
    { id: 'topology', name: 'Topology Network', version: 'v1.5.0', status: 'active', parameters: 800000, requestsPerSecond: 4521, latencyP50Ms: 0.4, latencyP99Ms: 0.6, errorRate: 0.00008, lastUpdated: new Date().toISOString(), lastDeployedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), region: 'us-east-1' },
    { id: 'clarion', name: 'CLARION Network', version: 'v2.0.1', status: 'active', parameters: 200000, requestsPerSecond: 2105, latencyP50Ms: 0.2, latencyP99Ms: 0.3, errorRate: 0.00003, lastUpdated: new Date().toISOString(), lastDeployedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), region: 'us-east-1' },
    { id: 'combination', name: 'Combination Network', version: 'v1.2.0', status: 'active', parameters: 50000, requestsPerSecond: 891, latencyP50Ms: 0.1, latencyP99Ms: 0.2, errorRate: 0.00002, lastUpdated: new Date().toISOString(), lastDeployedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), region: 'us-east-1' },
    { id: 'user', name: 'User Network', version: 'v1.8.0', status: 'active', parameters: 50000, requestsPerSecond: 4521, latencyP50Ms: 0.3, latencyP99Ms: 0.5, errorRate: 0.00004, lastUpdated: new Date().toISOString(), lastDeployedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), region: 'us-east-1' },
  ];

  const regions = [
    { regionId: 'us-east-1', regionName: 'US East (N. Virginia)', status: 'online', thermalState: 'warm', activeCartridge: { id: 'base', name: 'Base Cartridge', version: 'v1.0.0' }, networks: { total: 6, active: 6, degraded: 0, offline: 0 }, latencyMs: 25, requestsPerSecond: 4521, lastHealthCheck: new Date().toISOString() },
    { regionId: 'eu-central-1', regionName: 'EU (Frankfurt)', status: 'online', thermalState: 'warm', activeCartridge: { id: 'gdpr', name: 'GDPR Cartridge', version: 'v1.0.0' }, networks: { total: 6, active: 6, degraded: 0, offline: 0 }, latencyMs: 35, requestsPerSecond: 2100, lastHealthCheck: new Date().toISOString() },
    { regionId: 'ap-northeast-1', regionName: 'Asia Pacific (Tokyo)', status: 'online', thermalState: 'cold', networks: { total: 6, active: 6, degraded: 0, offline: 0 }, latencyMs: 45, requestsPerSecond: 800, lastHealthCheck: new Date().toISOString() },
  ];

  const shadowValidations = [
    {
      id: 'shadow-1',
      networkId: 'pattern',
      networkName: 'Pattern Network',
      currentVersion: 'v3.2.1',
      candidateVersion: 'v3.2.2',
      status: 'running',
      startedAt: new Date(Date.now() - 39 * 60 * 1000).toISOString(),
      estimatedEndAt: new Date(Date.now() + 21 * 60 * 1000).toISOString(),
      progressPercent: 65,
      durationMinutes: 60,
      metrics: { errorRate: 0.0002, latencyDeltaMs: 2, outputDivergencePercent: 0.031, memoryOverheadPercent: 0.05 },
      warnings: [],
      canAbort: true,
    },
  ];

  const recentDeployments = [
    { id: 'dep-1', networkId: 'pattern', networkName: 'Pattern Network', version: 'v3.2.1', previousVersion: 'v3.2.0', status: 'promoted', deployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), deployedBy: 'system', region: 'us-east-1' },
    { id: 'dep-2', networkId: 'routing', networkName: 'Routing Network', version: 'v2.1.0', previousVersion: 'v2.0.9', status: 'promoted', deployedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), deployedBy: 'system', region: 'us-east-1' },
    { id: 'dep-3', networkId: 'user', networkName: 'User Network', version: 'v1.8.1', status: 'rejected', deployedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), deployedBy: 'system', region: 'us-east-1' },
    { id: 'dep-4', networkId: 'clarion', networkName: 'CLARION Network', version: 'v2.0.1', previousVersion: 'v2.0.0', status: 'promoted', deployedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), deployedBy: 'system', region: 'us-east-1' },
  ];

  return {
    summary: {
      systemStatus: 'healthy',
      networksActive: 6,
      networksTotal: 6,
      regionsOnline: 3,
      regionsTotal: 3,
      alertCount: 0,
    },
    networks,
    shadowValidations,
    regions,
    recentDeployments,
    alerts: [],
  };
}

export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
  const params = context?.params as { path: string[] } | undefined;
  return proxyRequest(req, 'GET', params?.path || ['dashboard']);
});

export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
  const params = context?.params as { path: string[] } | undefined;
  return proxyRequest(req, 'POST', params?.path || []);
});

export const PUT = withAuth(async (req: AuthenticatedRequest, context) => {
  const params = context?.params as { path: string[] } | undefined;
  return proxyRequest(req, 'PUT', params?.path || []);
});

export const PATCH = withAuth(async (req: AuthenticatedRequest, context) => {
  const params = context?.params as { path: string[] } | undefined;
  return proxyRequest(req, 'PATCH', params?.path || []);
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
  const params = context?.params as { path: string[] } | undefined;
  return proxyRequest(req, 'DELETE', params?.path || []);
});
