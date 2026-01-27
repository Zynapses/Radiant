import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

/**
 * GET /api/user/sessions - List user's active sessions
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const response = await fetch(`${API_BASE}/user/sessions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[UserSessions] Failed to fetch:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch sessions' } },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/user/sessions - Revoke all other sessions (keep current)
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const response = await fetch(`${API_BASE}/user/sessions`, {
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
    console.error('[UserSessions] Failed to revoke all:', error);
    return NextResponse.json(
      { error: { message: 'Failed to revoke sessions' } },
      { status: 500 }
    );
  }
});
