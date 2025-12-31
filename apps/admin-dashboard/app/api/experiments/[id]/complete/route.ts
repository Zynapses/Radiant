import { NextResponse } from 'next/server';
import { withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// POST /api/experiments/[id]/complete - Complete an experiment (admin only)
export const POST = withAdminAuth(async (
  request: AuthenticatedRequest,
  context
) => {
  try {
    const params = context?.params as Record<string, string> | undefined;
    const id = params?.id || '';
    return NextResponse.json({
      success: true,
      experimentId: id,
      status: 'completed',
      completedBy: request.user.email,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError('COMPLETE_FAILED', 'Failed to complete experiment', 500);
  }
});
