import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// POST /api/compliance/generate - Generate a new compliance report
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { framework } = body;

    const report = {
      id: crypto.randomUUID(),
      tenantId: request.user.tenantId || 'tenant-1',
      reportType: framework || 'soc2',
      status: 'generating',
      requestedBy: request.user.email,
      estimatedCompletion: new Date(Date.now() + 60000).toISOString(),
    };

    return NextResponse.json(report, { status: 202 });
  } catch (error) {
    return apiError('GENERATE_FAILED', 'Failed to generate report', 500);
  }
});
