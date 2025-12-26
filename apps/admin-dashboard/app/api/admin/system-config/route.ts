import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

// GET /api/admin/system-config - Get all categories or configs by category
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const token = getTokenFromRequest(req);
  
  try {
    let endpoint = '/admin/system-config/categories';
    if (category) {
      endpoint = `/admin/system-config/category/${category}`;
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
    console.error('[SystemConfig] Failed to fetch:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch system configuration' } },
      { status: 500 }
    );
  }
});

// PUT /api/admin/system-config - Update a configuration value
export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  const token = getTokenFromRequest(req);
  
  try {
    const body = await req.json();
    const { category, key, value } = body;
    
    if (!category || !key || value === undefined) {
      return NextResponse.json(
        { error: { message: 'category, key, and value are required' } },
        { status: 400 }
      );
    }
    
    const response = await fetch(`${API_BASE}/admin/system-config/${category}/${key}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[SystemConfig] Failed to update:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update system configuration' } },
      { status: 500 }
    );
  }
});
