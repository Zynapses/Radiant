import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const token = getTokenFromRequest(request);

  const response = await fetch(`${INTERNAL_API_URL}/api/admin/oauth/apps/${params.appId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const token = getTokenFromRequest(request);
  const body = await request.json();

  const response = await fetch(`${INTERNAL_API_URL}/api/admin/oauth/apps/${params.appId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const token = getTokenFromRequest(request);

  const response = await fetch(`${INTERNAL_API_URL}/api/admin/oauth/apps/${params.appId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
