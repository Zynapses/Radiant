import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { complianceApi } from '@/lib/api/endpoints';

// POST /api/compliance/generate - Generate a new compliance report
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { framework } = body;

    const report = await complianceApi.generateReport(framework || 'soc2');

    return NextResponse.json(report, { status: 202 });
  } catch (error) {
    console.error('Failed to generate compliance report:', error);
    return apiError('GENERATE_FAILED', 'Failed to generate report', 500);
  }
});
