import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/system/gateway/config - Get gateway configuration
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const response = await fetch(`${API_BASE}/admin/system/gateway/config`, {
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
    console.error('[Gateway] Failed to fetch config:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch gateway configuration' } },
      { status: 500 }
    );
  }
});

// PUT /api/admin/system/gateway/config - Update gateway configuration
export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const body = await req.json();
    
    const response = await fetch(`${API_BASE}/admin/system/gateway/config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Gateway] Failed to update config:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update gateway configuration' } },
      { status: 500 }
    );
  }
});
