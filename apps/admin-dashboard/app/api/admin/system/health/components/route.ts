import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/system/health/components - Get component health list
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const response = await fetch(`${API_BASE}/admin/system/health/components`, {
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
    console.error('[SystemHealth] Failed to fetch components:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch system components' } },
      { status: 500 }
    );
  }
});
