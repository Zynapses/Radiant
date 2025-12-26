import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for RADIANT Admin Dashboard
 * 
 * Handles:
 * - Route protection (redirects unauthenticated users to login)
 * - Rate limiting for API routes
 * - Security headers
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/health',
];

// Routes that are always allowed (static assets, etc.)
const IGNORED_ROUTES = [
  '/_next',
  '/favicon.ico',
  '/api/auth',
];

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

// In-memory rate limit store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ratelimit:${ip}`;
}

function checkRateLimit(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
  const key = getRateLimitKey(request);
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    const entries = Array.from(rateLimitStore.entries());
    for (let i = 0; i < entries.length; i++) {
      const [k, v] = entries[i];
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime: entry.resetTime };
  }
  
  entry.count++;
  
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }
  
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetTime: entry.resetTime };
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

function isIgnoredRoute(pathname: string): boolean {
  return IGNORED_ROUTES.some(route => pathname.startsWith(route));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies for session token
  const tokenCookie = request.cookies.get('radiant_access_token');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }
  
  return null;
}

function isTokenValid(token: string): boolean {
  try {
    // Decode JWT payload (without verification - that happens server-side)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('[Middleware] Token validation failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip ignored routes
  if (isIgnoredRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Apply rate limiting to API routes
  if (isApiRoute(pathname)) {
    const rateLimit = checkRateLimit(request);
    
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    
    // For non-public API routes, verify authentication
    if (!isPublicRoute(pathname)) {
      const token = getTokenFromRequest(request);
      
      if (!token || !isTokenValid(token)) {
        return new NextResponse(
          JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Bearer',
            },
          }
        );
      }
    }
    
    return response;
  }
  
  // For public routes, allow access
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // For protected routes, check authentication
  const token = getTokenFromRequest(request);
  
  if (!token || !isTokenValid(token)) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
