import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/cortex/entities/[entityId] - Get entity
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { entityId: string } }
) => {
  const token = getTokenFromRequest(req);
  const entityId = context?.params?.entityId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/cortex/entities/${entityId}`, {
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
    console.error('[Cortex] Failed to fetch entity:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch entity' } },
      { status: 500 }
    );
  }
});

// PUT /api/admin/cortex/entities/[entityId] - Update entity
export const PUT = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { entityId: string } }
) => {
  const token = getTokenFromRequest(req);
  const entityId = context?.params?.entityId;
  
  try {
    const body = await req.json();
    
    const response = await fetch(`${API_BASE}/admin/cortex/entities/${entityId}`, {
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
    console.error('[Cortex] Failed to update entity:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update entity' } },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/cortex/entities/[entityId] - Delete entity
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { entityId: string } }
) => {
  const token = getTokenFromRequest(req);
  const entityId = context?.params?.entityId;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  
  try {
    const response = await fetch(`${API_BASE}/admin/cortex/entities/${entityId}?tenantId=${tenantId}`, {
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
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Cortex] Failed to delete entity:', error);
    return NextResponse.json(
      { error: { message: 'Failed to delete entity' } },
      { status: 500 }
    );
  }
});
