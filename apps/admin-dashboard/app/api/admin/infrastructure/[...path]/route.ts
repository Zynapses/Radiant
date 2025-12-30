/**
 * Infrastructure Tier API Routes
 * 
 * Proxies requests to the infrastructure tier Lambda handler.
 * 
 * Endpoints:
 * - GET  /api/admin/infrastructure/tier - Current tier status
 * - GET  /api/admin/infrastructure/tier/compare - Tier comparison
 * - GET  /api/admin/infrastructure/tier/configs - All tier configs
 * - GET  /api/admin/infrastructure/tier/configs/:name - Get tier config
 * - PUT  /api/admin/infrastructure/tier/configs/:name - Update tier config
 * - POST /api/admin/infrastructure/tier/change - Request tier change
 * - POST /api/admin/infrastructure/tier/confirm - Confirm tier change
 * - GET  /api/admin/infrastructure/tier/transition-status - Transition progress
 * - PUT  /api/admin/infrastructure/tier/cooldown - Update cooldown
 * - GET  /api/admin/infrastructure/tier/change-history - Audit log
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
  const endpoint = `/admin/infrastructure/${path.join('/')}`;
  
  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
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
    console.error(`[Infrastructure] ${method} ${endpoint} failed:`, error);
    return NextResponse.json(
      { error: { message: 'Failed to proxy infrastructure request' } },
      { status: 500 }
    );
  }
}

// GET /api/admin/infrastructure/[...path]
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { path: string[] } }
) => {
  const resolvedParams = await params;
  return proxyRequest(req, 'GET', resolvedParams.path);
});

// POST /api/admin/infrastructure/[...path]
export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { path: string[] } }
) => {
  const resolvedParams = await params;
  return proxyRequest(req, 'POST', resolvedParams.path);
});

// PUT /api/admin/infrastructure/[...path]
export const PUT = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { path: string[] } }
) => {
  const resolvedParams = await params;
  return proxyRequest(req, 'PUT', resolvedParams.path);
});

// DELETE /api/admin/infrastructure/[...path]
export const DELETE = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { path: string[] } }
) => {
  const resolvedParams = await params;
  return proxyRequest(req, 'DELETE', resolvedParams.path);
});
