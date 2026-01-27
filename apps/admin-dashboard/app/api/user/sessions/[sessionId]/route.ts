import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

/**
 * DELETE /api/user/sessions/[sessionId] - Revoke a specific session
 */
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: Promise<{ sessionId: string }> }
) => {
  const token = getTokenFromRequest(req);
  const { sessionId } = await context!.params;
  
  try {
    const response = await fetch(`${API_BASE}/user/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UserSessions] Failed to revoke session:', error);
    return NextResponse.json(
      { error: { message: 'Failed to revoke session' } },
      { status: 500 }
    );
  }
});
