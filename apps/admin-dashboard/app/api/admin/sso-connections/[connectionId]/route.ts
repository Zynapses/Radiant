import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/sso-connections/[connectionId] - Get a specific SSO connection
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { connectionId: string } }
) => {
  const token = getTokenFromRequest(req);
  const connectionId = context?.params?.connectionId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/sso-connections/${connectionId}`, {
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
    console.error('[SsoConnections] Failed to fetch connection:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch SSO connection' } },
      { status: 500 }
    );
  }
});

// PUT /api/admin/sso-connections/[connectionId] - Update an SSO connection
export const PUT = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { connectionId: string } }
) => {
  const token = getTokenFromRequest(req);
  const connectionId = context?.params?.connectionId;
  
  try {
    const body = await req.json();
    
    const response = await fetch(`${API_BASE}/admin/sso-connections/${connectionId}`, {
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
    console.error('[SsoConnections] Failed to update connection:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update SSO connection' } },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/sso-connections/[connectionId] - Delete an SSO connection
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { connectionId: string } }
) => {
  const token = getTokenFromRequest(req);
  const connectionId = context?.params?.connectionId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/sso-connections/${connectionId}`, {
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
    console.error('[SsoConnections] Failed to delete connection:', error);
    return NextResponse.json(
      { error: { message: 'Failed to delete SSO connection' } },
      { status: 500 }
    );
  }
});
