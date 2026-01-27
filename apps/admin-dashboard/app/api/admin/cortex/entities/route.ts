import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/cortex/entities - List entities
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  const { searchParams } = new URL(req.url);
  
  try {
    const response = await fetch(`${API_BASE}/admin/cortex/entities?${searchParams.toString()}`, {
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
    console.error('[Cortex] Failed to fetch entities:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch entities' } },
      { status: 500 }
    );
  }
});

// POST /api/admin/cortex/entities - Create entity
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  
  try {
    const body = await req.json();
    
    const response = await fetch(`${API_BASE}/admin/cortex/entities?tenantId=${tenantId}`, {
      method: 'POST',
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
    console.error('[Cortex] Failed to create entity:', error);
    return NextResponse.json(
      { error: { message: 'Failed to create entity' } },
      { status: 500 }
    );
  }
});
