import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// POST /api/admin/sso-connections/[connectionId]/test - Test SSO connection
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { connectionId: string } }
) => {
  const token = getTokenFromRequest(req);
  const connectionId = context?.params?.connectionId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/sso-connections/${connectionId}/test`, {
      method: 'POST',
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
    console.error('[SsoConnections] Failed to test connection:', error);
    return NextResponse.json(
      { error: { message: 'Failed to test SSO connection' } },
      { status: 500 }
    );
  }
});
