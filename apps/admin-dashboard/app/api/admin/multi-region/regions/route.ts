import { NextResponse } from 'next/server';
import { withAuth, withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/admin/multi-region/regions - Get all region configurations
export const GET = withAuth(async () => {
  try {
    // In production, this would query the database
    // For now, return mock data
    const regions = [
      {
        id: '1',
        region: 'us-east-1',
        displayName: 'US East (N. Virginia)',
        isPrimary: true,
        isEnabled: true,
        endpoint: 'https://api.us-east-1.radiant.app',
        stackPrefix: 'radiant-prod',
        healthStatus: 'healthy',
        lastDeployedVersion: '4.18.0',
        lastDeployedAt: new Date().toISOString(),
        latencyMs: 45,
      },
      {
        id: '2',
        region: 'us-west-2',
        displayName: 'US West (Oregon)',
        isPrimary: false,
        isEnabled: true,
        endpoint: 'https://api.us-west-2.radiant.app',
        stackPrefix: 'radiant-prod-west',
        healthStatus: 'healthy',
        lastDeployedVersion: '4.18.0',
        lastDeployedAt: new Date().toISOString(),
        latencyMs: 78,
      },
      {
        id: '3',
        region: 'eu-west-1',
        displayName: 'EU (Ireland)',
        isPrimary: false,
        isEnabled: true,
        endpoint: 'https://api.eu-west-1.radiant.app',
        stackPrefix: 'radiant-prod-eu',
        healthStatus: 'healthy',
        lastDeployedVersion: '4.17.0',
        lastDeployedAt: new Date(Date.now() - 86400000).toISOString(),
        latencyMs: 120,
      },
    ];

    return NextResponse.json(regions);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch regions', 500);
  }
});

// POST /api/admin/multi-region/regions - Add a new region (admin only)
export const POST = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    
    if (!body.region || !body.endpoint) {
      return apiError('VALIDATION_ERROR', 'Region and endpoint are required', 400);
    }

    const newRegion = {
      id: crypto.randomUUID(),
      region: body.region,
      displayName: body.displayName || body.region,
      isPrimary: body.isPrimary || false,
      isEnabled: body.isEnabled ?? true,
      endpoint: body.endpoint,
      stackPrefix: body.stackPrefix || `radiant-${body.region}`,
      healthStatus: 'unknown',
      lastDeployedVersion: null,
      lastDeployedAt: null,
      latencyMs: null,
      createdBy: request.user.email,
    };

    return NextResponse.json(newRegion, { status: 201 });
  } catch (error) {
    return apiError('CREATE_FAILED', 'Failed to create region', 500);
  }
});
