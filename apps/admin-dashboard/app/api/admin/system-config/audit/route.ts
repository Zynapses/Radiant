import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/system-config/audit - Get configuration audit log
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') || '50';
  const category = searchParams.get('category');
  const token = getTokenFromRequest(req);
  
  try {
    let endpoint = `/admin/system-config/audit?limit=${limit}`;
    if (category) {
      endpoint += `&category=${category}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
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
    console.error('[SystemConfig Audit] Failed to fetch:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch audit log' } },
      { status: 500 }
    );
  }
});
