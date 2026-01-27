import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// POST /api/admin/service-api-keys/[keyId]/rotate - Rotate an API key
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { keyId: string } }
) => {
  const token = getTokenFromRequest(req);
  const keyId = context?.params?.keyId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/service-api-keys/${keyId}/rotate`, {
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
    console.error('[ServiceApiKeys] Failed to rotate key:', error);
    return NextResponse.json(
      { error: { message: 'Failed to rotate service API key' } },
      { status: 500 }
    );
  }
});
