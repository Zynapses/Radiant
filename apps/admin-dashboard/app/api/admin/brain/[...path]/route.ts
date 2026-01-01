/**
 * Brain v6.0.4 API Routes
 * 
 * Proxies requests to the Brain admin Lambda handler.
 * 
 * Endpoints:
 * - GET  /api/admin/brain/dashboard - Brain dashboard stats
 * - GET  /api/admin/brain/config - All config parameters
 * - PUT  /api/admin/brain/config - Update multiple configs
 * - GET  /api/admin/brain/config/:key - Get single config
 * - PUT  /api/admin/brain/config/:key - Set single config
 * - POST /api/admin/brain/config/:key/reset - Reset to default
 * - GET  /api/admin/brain/config/history - Config change history
 * - GET  /api/admin/brain/ghost/stats - Ghost vector statistics
 * - GET  /api/admin/brain/ghost/:userId/health - Ghost health check
 * - GET  /api/admin/brain/dreams/queue - Dream queue status
 * - GET  /api/admin/brain/dreams/schedules - Tenant schedules
 * - POST /api/admin/brain/dreams/trigger - Manual dream trigger
 * - GET  /api/admin/brain/oversight - Pending oversight items
 * - GET  /api/admin/brain/oversight/stats - Oversight statistics
 * - POST /api/admin/brain/oversight/:id/approve - Approve insight
 * - POST /api/admin/brain/oversight/:id/reject - Reject insight
 * - GET  /api/admin/brain/sofai/stats - SOFAI routing stats
 * - POST /api/admin/brain/reconciliation/trigger - Manual reconciliation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest, getTokenFromRequest } from '@/lib/api/auth-wrapper';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

async function proxyRequest(
  req: AuthenticatedRequest,
  method: string,
  path: string[]
): Promise<NextResponse> {
  const token = getTokenFromRequest(req);
  const endpoint = `/admin/brain/${path.join('/')}`;
  
  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': req.headers.get('X-Tenant-Id') || '',
      },
    };

    // Add body for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      try {
        const body = await req.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // No body or invalid JSON - continue without body
      }
    }

    // Add query params for GET requests
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const fullUrl = queryString 
      ? `${API_BASE}${endpoint}?${queryString}`
      : `${API_BASE}${endpoint}`;

    const response = await fetch(fullUrl, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Brain] ${method} ${endpoint} failed:`, error);
    return NextResponse.json(
      { error: { message: 'Failed to proxy brain request' } },
      { status: 500 }
    );
  }
}

// GET /api/admin/brain/[...path]
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  context
) => {
  const params = context?.params as { path: string[] } | undefined;
  const path = params?.path || [];
  return proxyRequest(req, 'GET', path);
});

// POST /api/admin/brain/[...path]
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  context
) => {
  const params = context?.params as { path: string[] } | undefined;
  const path = params?.path || [];
  return proxyRequest(req, 'POST', path);
});

// PUT /api/admin/brain/[...path]
export const PUT = withAuth(async (
  req: AuthenticatedRequest,
  context
) => {
  const params = context?.params as { path: string[] } | undefined;
  const path = params?.path || [];
  return proxyRequest(req, 'PUT', path);
});

// DELETE /api/admin/brain/[...path]
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  context
) => {
  const params = context?.params as { path: string[] } | undefined;
  const path = params?.path || [];
  return proxyRequest(req, 'DELETE', path);
});
