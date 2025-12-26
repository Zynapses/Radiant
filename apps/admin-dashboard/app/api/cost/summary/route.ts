import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { costApi } from '@/lib/api/endpoints';

// GET /api/cost/summary - Get cost summary
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as '7d' | '30d' | '90d') || '30d';

    const summary = await costApi.getSummary(period);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to fetch cost summary:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch summary', 500);
  }
});
