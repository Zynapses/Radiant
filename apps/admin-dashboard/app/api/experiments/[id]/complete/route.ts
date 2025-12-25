import { NextResponse } from 'next/server';
import { withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// POST /api/experiments/[id]/complete - Complete an experiment (admin only)
export const POST = withAdminAuth(async (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => {
  try {
    const id = context?.params?.id || '';
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
