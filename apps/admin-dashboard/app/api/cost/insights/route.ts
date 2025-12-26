import { NextResponse } from 'next/server';
import { withAuth, apiError } from '@/lib/api/auth-wrapper';
import { costApi } from '@/lib/api/endpoints';

// GET /api/cost/insights - Get cost insights (from Neural Engine)
export const GET = withAuth(async () => {
  try {
    const insights = await costApi.getInsights();

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Failed to fetch cost insights:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch insights', 500);
  }
});
