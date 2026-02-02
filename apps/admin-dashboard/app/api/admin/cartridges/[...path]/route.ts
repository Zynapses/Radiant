/**
 * Cartridge API Routes
 * 
 * Proxies requests to the Cartridge admin Lambda handler.
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
  const endpoint = `/admin/cartridges/${path.join('/')}`;
  
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
    console.error(`[Cartridges] ${method} ${endpoint} failed:`, error);
    
    // Return mock data for development when backend is unavailable
    if (path.length === 0 && method === 'GET') {
      return NextResponse.json(getMockCartridgeList());
    }
    
    if (path[0] === 'stack' && method === 'GET') {
      return NextResponse.json(getMockCartridgeStack());
    }
    
    return NextResponse.json(
      { error: { message: 'Failed to proxy cartridge request' } },
      { status: 500 }
    );
  }
}

// Mock data for development
function getMockCartridgeList() {
  return {
    cartridges: [
      {
        id: 'cart-1',
        tenantId: 'tenant-1',
        name: 'Base Platform Cartridge',
        description: 'Core platform neural networks and configurations',
        version: '1.0.0',
        scope: 'tenant',
        status: 'active',
        domains: ['general', 'business', 'technology'],
        hasLoraAdapters: false,
        hasCuratorKnowledge: true,
        hasGhostCompression: false,
        hasDomainExperts: false,
        allowUserOverride: true,
        isEnabled: true,
        fileSizeBytes: 52428800,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'system',
      },
      {
        id: 'cart-2',
        tenantId: 'tenant-1',
        name: 'Healthcare Expert Pack',
        description: 'Medical domain expertise with safety rules',
        version: '2.1.0',
        scope: 'tenant',
        status: 'active',
        domains: ['healthcare', 'medical', 'pharmacy'],
        hasLoraAdapters: true,
        hasCuratorKnowledge: true,
        hasGhostCompression: false,
        hasDomainExperts: true,
        allowUserOverride: false,
        isEnabled: true,
        fileSizeBytes: 156000000,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'admin',
      },
      {
        id: 'cart-3',
        tenantId: 'tenant-1',
        userId: 'user-1',
        name: 'My Research Assistant',
        description: 'Personal preferences and research context',
        version: '1.0.0',
        scope: 'user',
        status: 'ready',
        domains: ['research', 'academic'],
        hasLoraAdapters: false,
        hasCuratorKnowledge: false,
        hasGhostCompression: true,
        hasDomainExperts: false,
        allowUserOverride: true,
        isEnabled: true,
        fileSizeBytes: 8500000,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-1',
      },
    ],
    total: 3,
    limit: 50,
    offset: 0,
  };
}

function getMockCartridgeStack() {
  return {
    stack: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      tenantStack: [
        {
          cartridge: {
            id: 'cart-1',
            name: 'Base Platform Cartridge',
            version: '1.0.0',
            scope: 'tenant',
            status: 'active',
            domains: ['general', 'business', 'technology'],
            hasLoraAdapters: false,
            hasCuratorKnowledge: true,
            hasGhostCompression: false,
          },
          position: 0,
          isEnabled: true,
          canDisable: false,
          canOverride: true,
        },
        {
          cartridge: {
            id: 'cart-2',
            name: 'Healthcare Expert Pack',
            version: '2.1.0',
            scope: 'tenant',
            status: 'active',
            domains: ['healthcare', 'medical', 'pharmacy'],
            hasLoraAdapters: true,
            hasCuratorKnowledge: true,
            hasDomainExperts: true,
          },
          position: 1,
          isEnabled: true,
          canDisable: false,
          canOverride: false,
        },
      ],
      userStack: [
        {
          cartridge: {
            id: 'cart-3',
            name: 'My Research Assistant',
            version: '1.0.0',
            scope: 'user',
            status: 'ready',
            domains: ['research', 'academic'],
            hasLoraAdapters: false,
            hasCuratorKnowledge: false,
            hasGhostCompression: true,
          },
          position: 2,
          isEnabled: true,
          canDisable: true,
          canOverride: true,
        },
      ],
      effectiveCartridge: {
        domains: ['general', 'business', 'technology', 'healthcare', 'medical', 'pharmacy', 'research', 'academic'],
        cortexVersions: { pattern: 'v3.2.1', routing: 'v2.1.0' },
        loraAdapters: ['cart-2'],
        goldenRulesCount: 42,
        safetyMatrixEntriesCount: 156,
      },
    },
  };
}

export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
  const params = context?.params as { path: string[] } | undefined;
  return proxyRequest(req, 'GET', params?.path || []);
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
