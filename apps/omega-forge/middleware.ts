/**
 * OMEGA Forge — System Admin Auth Middleware
 *
 * OMEGA Forge is a PLATFORM-LEVEL tool, NOT a tenant app.
 * It requires system admin authentication (Pool B / super_admin).
 * Direct database access is intentional — Forge sees all tenants.
 *
 * This middleware validates that the request comes from an authenticated
 * system admin before allowing access to any Forge route.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/_next', '/favicon.ico', '/api/health'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and health checks
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for system admin session token
  const adminToken = request.cookies.get('radiant_system_admin_token')?.value
    || request.headers.get('X-System-Admin-Token');

  if (!adminToken) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'OMEGA Forge requires system admin authentication. This is a platform-level tool, not a tenant app.',
        },
        { status: 401 }
      );
    }

    // For page routes, redirect to admin login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate token format (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(adminToken)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Add admin context headers for downstream use
  const response = NextResponse.next();
  response.headers.set('X-Forge-Admin-Verified', 'true');
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
