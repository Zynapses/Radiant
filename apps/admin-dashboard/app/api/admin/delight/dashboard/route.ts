import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

/**
 * GET /api/admin/delight/dashboard
 * Fetches the delight system dashboard data from the backend.
 * Returns proper error responses instead of mock data per /no-mock-data policy.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    
    if (!API_URL) {
      return NextResponse.json(
        { 
          error: 'Backend API not configured', 
          code: 'API_NOT_CONFIGURED',
          message: 'Set RADIANT_API_URL or NEXT_PUBLIC_API_URL environment variable' 
        },
        { status: 503 }
      );
    }

    const response = await fetch(`${API_URL}/api/admin/delight/dashboard`, {
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-Admin': 'true',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { 
          error: 'Failed to fetch delight dashboard', 
          code: 'BACKEND_ERROR',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Delight dashboard API error:', error);
    return NextResponse.json(
      { 
        error: 'Backend service unavailable', 
        code: 'SERVICE_UNAVAILABLE',
        message: 'The delight service is currently unavailable. Please try again later.'
      },
      { status: 503 }
    );
  }
}
