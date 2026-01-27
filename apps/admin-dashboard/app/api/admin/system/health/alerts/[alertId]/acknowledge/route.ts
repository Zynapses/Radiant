import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// POST /api/admin/system/health/alerts/[alertId]/acknowledge - Acknowledge alert
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { alertId: string } }
) => {
  const token = getTokenFromRequest(req);
  const alertId = context?.params?.alertId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/system/health/alerts/${alertId}/acknowledge`, {
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
    console.error('[SystemHealth] Failed to acknowledge alert:', error);
    return NextResponse.json(
      { error: { message: 'Failed to acknowledge alert' } },
      { status: 500 }
    );
  }
});
