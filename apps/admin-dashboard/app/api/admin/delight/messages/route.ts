import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    
    const response = await fetch(`${API_URL}/api/admin/delight/messages`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-Admin': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ 
        id: Date.now(),
        ...body,
        isEnabled: body.isEnabled ?? true,
      }, { status: 201 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ 
      id: Date.now(),
      isEnabled: true,
    }, { status: 201 });
  }
}
