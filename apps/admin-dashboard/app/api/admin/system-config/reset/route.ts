import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// POST /api/admin/system-config/reset - Reset a configuration value to default
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const body = await req.json();
    const { category, key } = body;
    
    if (!category || !key) {
      return NextResponse.json(
        { error: { message: 'category and key are required' } },
        { status: 400 }
      );
    }
    
    const response = await fetch(`${API_BASE}/admin/system-config/${category}/${key}/reset`, {
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
    console.error('[SystemConfig Reset] Failed:', error);
    return NextResponse.json(
      { error: { message: 'Failed to reset configuration' } },
      { status: 500 }
    );
  }
});
