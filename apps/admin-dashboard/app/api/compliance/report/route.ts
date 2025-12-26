import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { complianceApi } from '@/lib/api/endpoints';

// GET /api/compliance/report - Get compliance report for a framework
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const framework = searchParams.get('framework') || 'soc2';

    const report = await complianceApi.getReport(framework);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Failed to fetch compliance report:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch report', 500);
  }
});
