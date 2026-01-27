import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

/**
 * GET /api/user/api-keys - List user's personal API keys
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const response = await fetch(`${API_BASE}/user/api-keys`, {
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
    console.error('[UserApiKeys] Failed to fetch:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch API keys' } },
      { status: 500 }
    );
  }
});

/**
 * POST /api/user/api-keys - Create a new personal API key
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const body = await req.json();
    
    const response = await fetch(`${API_BASE}/user/api-keys`, {
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
    console.error('[UserApiKeys] Failed to create:', error);
    return NextResponse.json(
      { error: { message: 'Failed to create API key' } },
      { status: 500 }
    );
  }
});
