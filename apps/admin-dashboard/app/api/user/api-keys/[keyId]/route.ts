import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

/**
 * DELETE /api/user/api-keys/[keyId] - Revoke a personal API key
 */
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: Promise<{ keyId: string }> }
) => {
  const token = getTokenFromRequest(req);
  const { keyId } = await context!.params;
  
  try {
    const response = await fetch(`${API_BASE}/user/api-keys/${keyId}`, {
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
    console.error('[UserApiKeys] Failed to revoke:', error);
    return NextResponse.json(
      { error: { message: 'Failed to revoke API key' } },
      { status: 500 }
    );
  }
});
