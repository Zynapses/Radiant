import { NextResponse } from 'next/server';
import { thinkTankApi } from '@/lib/api/endpoints';

/**
 * Think Tank GDPR Data Subject Rights API
 * Proxies to Radiant service layer for GDPR data requests
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const requestType = searchParams.get('requestType') || undefined;

    const result = await thinkTankApi.listGDPRRequests({ status, requestType });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch GDPR requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GDPR requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, requestType } = body;

    if (!userId || !email || !requestType) {
      return NextResponse.json(
        { error: 'userId, email, and requestType are required' },
        { status: 400 }
      );
    }

    if (!['export', 'delete'].includes(requestType)) {
      return NextResponse.json(
        { error: 'requestType must be "export" or "delete"' },
        { status: 400 }
      );
    }

    const gdprRequest = await thinkTankApi.createGDPRRequest({
      userId,
      email,
      requestType,
    });

    return NextResponse.json(gdprRequest, { status: 201 });
  } catch (error) {
    console.error('Failed to create GDPR request:', error);
    return NextResponse.json(
      { error: 'Failed to create GDPR request' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'requestId and status are required' },
        { status: 400 }
      );
    }

    const updatedRequest = await thinkTankApi.updateGDPRRequest(requestId, status);
    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('Failed to update GDPR request:', error);
    return NextResponse.json(
      { error: 'Failed to update GDPR request' },
      { status: 500 }
    );
  }
}
