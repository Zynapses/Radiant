import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { geographicApi } from '@/lib/api/endpoints';

// GET /api/geographic/regions - Get geographic region stats
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const regions = await geographicApi.getRegions();

    return NextResponse.json(regions);
  } catch (error) {
    console.error('Failed to fetch geographic regions:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch regions', 500);
  }
});
