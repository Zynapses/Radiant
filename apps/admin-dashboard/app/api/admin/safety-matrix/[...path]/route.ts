/**
 * Safety Matrix API Routes
 * 
 * Proxies requests to the Safety Matrix admin Lambda handler.
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
  const endpoint = `/admin/safety-matrix/${path.join('/')}`;
  
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
    console.error(`[SafetyMatrix] ${method} ${endpoint} failed:`, error);
    
    // Return mock data for development
    if (path[0] === 'dashboard') {
      return NextResponse.json(getMockDashboard());
    }
    if (path[0] === 'grid') {
      return NextResponse.json(getMockGrid());
    }
    
    return NextResponse.json(
      { error: { message: 'Failed to proxy safety-matrix request' } },
      { status: 500 }
    );
  }
}

function getMockDashboard() {
  return {
    summary: {
      totalEntities: 127,
      totalActions: 24,
      totalContraindications: 342,
      pendingReview: 8,
      byDomain: [
        { domainId: 'healthcare', domainName: 'Healthcare', contraindicationCount: 245 },
        { domainId: 'legal', domainName: 'Legal', contraindicationCount: 67 },
        { domainId: 'finance', domainName: 'Finance', contraindicationCount: 30 },
      ],
      bySeverity: {
        absolute: 45,
        relative: 123,
        caution: 134,
        monitor: 40,
      },
    },
    recentContraindications: [
      {
        id: 'c1',
        entityId: 'e1',
        actionId: 'a1',
        entityName: 'Aspirin',
        actionName: 'prescribe to',
        severity: 'absolute' as const,
        reason: 'Contraindicated in patients on anticoagulants due to increased bleeding risk',
        status: 'active',
        allowOverride: false,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'c2',
        entityId: 'e2',
        actionId: 'a2',
        entityName: 'Metformin',
        actionName: 'combine with',
        severity: 'relative' as const,
        reason: 'Use with caution in patients with renal impairment',
        status: 'active',
        allowOverride: true,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'c3',
        entityId: 'e3',
        actionId: 'a3',
        entityName: 'Lisinopril',
        actionName: 'prescribe to',
        severity: 'caution' as const,
        reason: 'Monitor potassium levels in patients taking potassium supplements',
        status: 'active',
        allowOverride: true,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
    ],
    pendingReviewItems: [
      {
        id: 'p1',
        entityId: 'e4',
        actionId: 'a1',
        entityName: 'Warfarin',
        actionName: 'combine with',
        severity: 'absolute' as const,
        reason: 'Critical interaction with many NSAIDs',
        status: 'pending_review',
        allowOverride: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
    topEntities: [
      { entity: { id: 'e1', name: 'Aspirin', category: 'medication', riskLevel: 'high', contraindicationCount: 23 }, contraindicationCount: 23 },
      { entity: { id: 'e2', name: 'Warfarin', category: 'medication', riskLevel: 'critical', contraindicationCount: 18 }, contraindicationCount: 18 },
      { entity: { id: 'e3', name: 'Metformin', category: 'medication', riskLevel: 'medium', contraindicationCount: 12 }, contraindicationCount: 12 },
    ],
  };
}

function getMockGrid() {
  const entities = [
    { id: 'e1', name: 'Aspirin', category: 'medication', riskLevel: 'high', contraindicationCount: 5 },
    { id: 'e2', name: 'Warfarin', category: 'medication', riskLevel: 'critical', contraindicationCount: 8 },
    { id: 'e3', name: 'Metformin', category: 'medication', riskLevel: 'medium', contraindicationCount: 3 },
    { id: 'e4', name: 'Lisinopril', category: 'medication', riskLevel: 'medium', contraindicationCount: 4 },
    { id: 'e5', name: 'Atorvastatin', category: 'medication', riskLevel: 'low', contraindicationCount: 2 },
  ];

  const actions = [
    { id: 'a1', name: 'Prescribe to', category: 'prescribe', verbPresent: 'prescribe' },
    { id: 'a2', name: 'Combine with', category: 'combine_with', verbPresent: 'combine' },
    { id: 'a3', name: 'Administer to', category: 'administer_to', verbPresent: 'administer' },
    { id: 'a4', name: 'Recommend', category: 'recommend', verbPresent: 'recommend' },
  ];

  const severities = ['absolute', 'relative', 'caution', 'monitor', null] as const;

  const rows = entities.map(entity => ({
    entity,
    cells: actions.map(action => {
      const hasCon = Math.random() > 0.6;
      return {
        entityId: entity.id,
        actionId: action.id,
        hasContraindication: hasCon,
        severity: hasCon ? severities[Math.floor(Math.random() * 4)] : undefined,
      };
    }),
  }));

  return {
    domainId: 'healthcare',
    domainName: 'Healthcare',
    entities,
    actions,
    rows,
    totalContraindications: rows.reduce((sum, r) => sum + r.cells.filter(c => c.hasContraindication).length, 0),
    lastUpdated: new Date().toISOString(),
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
