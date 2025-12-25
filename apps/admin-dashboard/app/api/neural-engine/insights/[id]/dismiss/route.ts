import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// POST /api/neural-engine/insights/[id]/dismiss - Dismiss an insight
export const POST = withAuth(async (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => {
  try {
    const id = context?.params?.id || '';
    const body = await request.json();
    const { reason } = body;

    return NextResponse.json({
      success: true,
      insightId: id,
      dismissedBy: request.user.email,
      dismissedAt: new Date().toISOString(),
      reason: reason || 'No reason provided',
    });
  } catch (error) {
    return apiError('DISMISS_FAILED', 'Failed to dismiss insight', 500);
  }
});
