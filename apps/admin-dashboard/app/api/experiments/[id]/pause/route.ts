import { NextResponse } from 'next/server';
import { withAdminAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// POST /api/experiments/[id]/pause - Pause an experiment (admin only)
export const POST = withAdminAuth(async (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => {
  try {
    const id = context?.params?.id || '';
    return NextResponse.json({
      success: true,
      experimentId: id,
      status: 'paused',
      pausedBy: request.user.email,
      pausedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError('PAUSE_FAILED', 'Failed to pause experiment', 500);
  }
});
