import { NextResponse } from 'next/server';
import { withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// POST /api/admin/multi-region/deploy - Start multi-region deployment (admin only)
export const POST = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { version, regions, strategy } = body;

    if (!version || !regions || regions.length === 0) {
      return apiError('VALIDATION_ERROR', 'Version and target regions are required', 400);
    }

    const deployment = {
      id: crypto.randomUUID(),
      packageVersion: version,
      strategy: strategy || 'canary',
      targetRegions: regions,
      startedBy: request.user.email,
      startedAt: new Date().toISOString(),
      completedAt: null,
      regionStatuses: regions.reduce((acc: Record<string, unknown>, region: string) => {
        acc[region] = {
          region,
          status: 'pending',
          progress: 0,
          message: 'Waiting to start',
          startedAt: null,
          completedAt: null,
        };
        return acc;
      }, {}),
    };

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    return apiError('DEPLOY_FAILED', 'Failed to start deployment', 500);
  }
});
