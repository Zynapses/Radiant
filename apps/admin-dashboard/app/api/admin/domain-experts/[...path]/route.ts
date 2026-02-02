/**
 * Domain Expert API Routes
 * 
 * Proxies requests to the Domain Expert admin Lambda handler.
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
  const endpoint = `/admin/domain-experts/${path.join('/')}`;
  
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
    console.error(`[DomainExperts] ${method} ${endpoint} failed:`, error);
    
    // Return mock data for development
    if (path[0] === 'dashboard') {
      return NextResponse.json(getMockDashboard());
    }
    
    return NextResponse.json(
      { error: { message: 'Failed to proxy domain experts request' } },
      { status: 500 }
    );
  }
}

function getMockDashboard() {
  const networkTypes = [
    'entity_classifier',
    'contraindication_net',
    'protocol_matcher',
    'severity_assessor',
    'personalization_net',
    'citation_network',
    'orchestration_selector',
  ] as const;

  const createNetworkMap = (domainId: string, deployed: number) => {
    const networks: Record<string, unknown> = {};
    networkTypes.forEach((type, idx) => {
      if (idx < deployed) {
        networks[type] = {
          id: `${domainId}-${type}`,
          networkType: type,
          version: '1.0.0',
          status: 'active',
          parameters: 4000000,
          latencyP50Ms: Math.random() * 2,
          latencyP99Ms: Math.random() * 5,
          errorRate: Math.random() * 0.001,
          requestsPerSecond: Math.random() * 100,
        };
      } else {
        networks[type] = null;
      }
    });
    return networks;
  };

  const domains = [
    {
      domainId: 'healthcare',
      domainName: 'Healthcare',
      config: {
        domainId: 'healthcare',
        displayName: 'Healthcare',
        isTrainingDomain: false,
        enabled: true,
        numEntities: 50000,
        numActions: 1000,
        numProtocols: 500,
        safetyThreshold: 0.95,
        citationRequired: true,
      },
      networks: createNetworkMap('healthcare', 7),
      completeness: 100,
      status: 'complete' as const,
      totalParameters: 28000000,
      lastUpdated: new Date().toISOString(),
    },
    {
      domainId: 'legal',
      domainName: 'Legal',
      config: {
        domainId: 'legal',
        displayName: 'Legal',
        isTrainingDomain: false,
        enabled: true,
        numEntities: 30000,
        numActions: 500,
        numProtocols: 200,
        safetyThreshold: 0.90,
        citationRequired: true,
      },
      networks: createNetworkMap('legal', 5),
      completeness: 71,
      status: 'partial' as const,
      totalParameters: 20000000,
      lastUpdated: new Date().toISOString(),
    },
    {
      domainId: 'finance',
      domainName: 'Finance',
      config: {
        domainId: 'finance',
        displayName: 'Finance',
        isTrainingDomain: false,
        enabled: true,
        numEntities: 25000,
        numActions: 800,
        numProtocols: 300,
        safetyThreshold: 0.85,
        citationRequired: true,
      },
      networks: createNetworkMap('finance', 4),
      completeness: 57,
      status: 'partial' as const,
      totalParameters: 16000000,
      lastUpdated: new Date().toISOString(),
    },
    {
      domainId: 'fitness',
      domainName: 'Fitness & Wellness',
      config: {
        domainId: 'fitness',
        displayName: 'Fitness & Wellness',
        isTrainingDomain: true,
        enabled: true,
        numEntities: 5000,
        numActions: 200,
        numProtocols: 100,
        safetyThreshold: 0.70,
        citationRequired: false,
      },
      networks: createNetworkMap('fitness', 7),
      completeness: 100,
      status: 'complete' as const,
      totalParameters: 28000000,
      lastUpdated: new Date().toISOString(),
    },
  ];

  return {
    summary: {
      totalDomains: 6,
      domainsWithExperts: 4,
      totalNetworks: 23,
      activeNetworks: 23,
      trainingJobs: 1,
      totalParameters: 92000000,
    },
    domains,
    recentTrainingJobs: [
      {
        id: 'job-1',
        domainId: 'legal',
        networkType: 'personalization_net',
        status: 'training',
        progressPercent: 45,
        currentEpoch: 45,
        totalEpochs: 100,
      },
    ],
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
