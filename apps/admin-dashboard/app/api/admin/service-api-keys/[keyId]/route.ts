import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/service-api-keys/[keyId] - Get a specific API key
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { keyId: string } | Promise<{ keyId: string }> }
) => {
  const token = getTokenFromRequest(req);
  const params = context?.params ? (context.params instanceof Promise ? await context.params : context.params) : null;
  const keyId = params?.keyId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/service-api-keys/${keyId}`, {
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
    console.error('[ServiceApiKeys] Failed to fetch key:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch service API key' } },
      { status: 500 }
    );
  }
});

// PUT /api/admin/service-api-keys/[keyId] - Update an API key
export const PUT = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { keyId: string } | Promise<{ keyId: string }> }
) => {
  const token = getTokenFromRequest(req);
  const params = context?.params ? (context.params instanceof Promise ? await context.params : context.params) : null;
  const keyId = params?.keyId;
  
  try {
    const body = await req.json();
    
    const response = await fetch(`${API_BASE}/admin/service-api-keys/${keyId}`, {
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
    console.error('[ServiceApiKeys] Failed to update key:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update service API key' } },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/service-api-keys/[keyId] - Revoke an API key
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context?: { params: { keyId: string } | Promise<{ keyId: string }> }
) => {
  const token = getTokenFromRequest(req);
  const params = context?.params ? (context.params instanceof Promise ? await context.params : context.params) : null;
  const keyId = params?.keyId;
  
  try {
    const response = await fetch(`${API_BASE}/admin/service-api-keys/${keyId}`, {
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
    console.error('[ServiceApiKeys] Failed to revoke key:', error);
    return NextResponse.json(
      { error: { message: 'Failed to revoke service API key' } },
      { status: 500 }
    );
  }
});
