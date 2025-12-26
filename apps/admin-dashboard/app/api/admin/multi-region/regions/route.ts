import { NextResponse } from 'next/server';
import { withAuth, withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { multiRegionApi } from '@/lib/api/endpoints';

// GET /api/admin/multi-region/regions - Get all region configurations
export const GET = withAuth(async () => {
  try {
    const regions = await multiRegionApi.listRegions();
    return NextResponse.json(regions);
  } catch (error) {
    console.error('Failed to fetch regions:', error);
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
