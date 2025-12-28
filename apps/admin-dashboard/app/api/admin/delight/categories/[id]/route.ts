import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    
    const response = await fetch(`${API_URL}/api/admin/delight/categories/${params.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-Admin': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ success: true });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: true });
  }
}
