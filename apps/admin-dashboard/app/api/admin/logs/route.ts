import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

const LAMBDA_API_URL = process.env.LAMBDA_API_URL || 'https://api.radiant.example.com';

// GET /api/admin/logs - List log groups or streams
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'groups';
    
    let endpoint = '/admin/logs/groups';
    const params = new URLSearchParams();
    
    if (type === 'streams') {
      endpoint = '/admin/logs/streams';
      const logGroupName = searchParams.get('logGroupName');
      if (logGroupName) params.set('logGroupName', logGroupName);
    } else if (type === 'events') {
      endpoint = '/admin/logs/events';
      const logGroupName = searchParams.get('logGroupName');
      const logStreamName = searchParams.get('logStreamName');
      const startTime = searchParams.get('startTime');
      const endTime = searchParams.get('endTime');
      if (logGroupName) params.set('logGroupName', logGroupName);
      if (logStreamName) params.set('logStreamName', logStreamName);
      if (startTime) params.set('startTime', startTime);
      if (endTime) params.set('endTime', endTime);
    }
    
    // Forward additional params
    const limit = searchParams.get('limit');
    const nextToken = searchParams.get('nextToken');
    const prefix = searchParams.get('prefix');
    if (limit) params.set('limit', limit);
    if (nextToken) params.set('nextToken', nextToken);
    if (prefix) params.set('prefix', prefix);

    const response = await fetch(`${LAMBDA_API_URL}${endpoint}?${params}`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return apiError('FETCH_LOGS_FAILED', 'Failed to fetch logs', 500);
  }
});

// POST /api/admin/logs - Filter logs or export
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'filter';
    const body = await request.json();
    
    let endpoint = '/admin/logs/filter';
    if (action === 'export') {
      endpoint = '/admin/logs/export';
    }

    const response = await fetch(`${LAMBDA_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Failed to process logs request:', error);
    return apiError('LOGS_REQUEST_FAILED', 'Failed to process logs request', 500);
  }
});

// DELETE /api/admin/logs - Delete log group or stream
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'group';
    const logGroupName = searchParams.get('logGroupName');
    const logStreamName = searchParams.get('logStreamName');
    
    let endpoint: string;
    let params = new URLSearchParams();
    
    if (type === 'stream' && logGroupName && logStreamName) {
      endpoint = '/admin/logs/streams';
      params.set('logGroupName', logGroupName);
      params.set('logStreamName', logStreamName);
    } else if (logGroupName) {
      endpoint = `/admin/logs/groups/${encodeURIComponent(logGroupName)}`;
    } else {
      return apiError('INVALID_PARAMS', 'logGroupName is required', 400);
    }

    const response = await fetch(`${LAMBDA_API_URL}${endpoint}?${params}`, {
      method: 'DELETE',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Failed to delete logs:', error);
    return apiError('DELETE_LOGS_FAILED', 'Failed to delete logs', 500);
  }
});
