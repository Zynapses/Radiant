/**
 * CATO Twilight Dreaming API Routes
 * 
 * Proxies requests to the CATO Twilight admin Lambda handler.
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
  const endpoint = `/admin/cato-twilight/${path.join('/')}`;
  
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
    console.error(`[CatoTwilight] ${method} ${endpoint} failed:`, error);
    
    // Return mock data for development
    if (path[0] === 'dashboard') {
      return NextResponse.json(getMockDashboard());
    }
    
    return NextResponse.json(
      { error: { message: 'Failed to proxy cato-twilight request' } },
      { status: 500 }
    );
  }
}

function getMockDashboard() {
  return {
    summary: {
      totalPopulations: 3,
      totalGenomes: 247,
      totalInventions: 42,
      approvedInventions: 18,
      avgFitnessAllPopulations: 0.734,
      currentInventionRate: 0.28,
      targetInventionRate: 0.30,
    },
    activeSession: null,
    recentSessions: [
      {
        id: 'session-1',
        status: 'completed',
        generationsEvolved: 10,
        fitnessImprovement: 0.015,
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'session-2',
        status: 'completed',
        generationsEvolved: 10,
        fitnessImprovement: 0.008,
        completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
    ],
    inventionMetrics: {
      inventionRate: 0.28,
      targetInventionRate: 0.30,
      currentDeficit: 0.02,
      enforcementMode: 'passive' as const,
      consecutiveNonInventive: 2,
    },
    enforcementConfig: {
      targetInventionRate: 0.30,
      enforcementEnabled: true,
      dreamingEnabled: true,
      dreamingSchedule: 'scheduled',
    },
    recentInventions: [
      {
        id: 'inv-1',
        inventionType: 'prompt_pattern',
        noveltyScore: 0.82,
        status: 'approved',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'inv-2',
        inventionType: 'reasoning_chain',
        noveltyScore: 0.75,
        status: 'pending',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'inv-3',
        inventionType: 'creative_format',
        noveltyScore: 0.68,
        status: 'approved',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
    ],
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
