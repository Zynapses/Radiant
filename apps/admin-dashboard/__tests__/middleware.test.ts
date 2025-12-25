import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

// Helper to create mock NextRequest
function createMockRequest(
  pathname: string,
  options: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    ip?: string;
  } = {}
): NextRequest {
  const headers = new Headers(options.headers || {});
  if (options.ip) {
    headers.set('x-forwarded-for', options.ip);
  }
  
  const url = new URL(pathname, 'http://localhost:3000');
  
  const request = {
    headers,
    cookies: {
      get: (name: string) => {
        const value = options.cookies?.[name];
        return value ? { name, value } : undefined;
      },
    },
    nextUrl: url,
    url: url.toString(),
  } as unknown as NextRequest;
  
  return request;
}

// Helper to create a valid JWT token
function createMockToken(exp?: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({
    exp: exp ?? Math.floor(Date.now() / 1000) + 3600,
    sub: 'user-123',
    email: 'test@example.com',
  }));
  return `${header}.${body}.signature`;
}

describe('middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('public routes', () => {
    it('allows access to /login without authentication', () => {
      const request = createMockRequest('/login');
      const response = middleware(request);
      
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302);
    });

    it('allows access to /api/health without authentication', () => {
      const request = createMockRequest('/api/health');
      const response = middleware(request);
      
      expect(response.status).not.toBe(401);
    });
  });

  describe('protected routes', () => {
    it('redirects to login when no token provided', () => {
      const request = createMockRequest('/dashboard');
      const response = middleware(request);
      
      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/login');
    });

    it('redirects with returnUrl when accessing protected route', () => {
      const request = createMockRequest('/settings');
      const response = middleware(request);
      
      expect(response.headers.get('location')).toContain('returnUrl=%2Fsettings');
    });

    it('allows access with valid token in header', () => {
      const token = createMockToken();
      const request = createMockRequest('/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const response = middleware(request);
      
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(401);
    });

    it('allows access with valid token in cookie', () => {
      const token = createMockToken();
      const request = createMockRequest('/dashboard', {
        cookies: { radiant_access_token: token },
      });
      const response = middleware(request);
      
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(401);
    });

    it('redirects when token is expired', () => {
      const expiredToken = createMockToken(Math.floor(Date.now() / 1000) - 3600);
      const request = createMockRequest('/dashboard', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      const response = middleware(request);
      
      expect(response.status).toBe(307);
    });
  });

  describe('API routes', () => {
    it('returns 401 for protected API routes without token', async () => {
      const request = createMockRequest('/api/admin/users');
      const response = middleware(request);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('allows API access with valid token', () => {
      const token = createMockToken();
      const request = createMockRequest('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const response = middleware(request);
      
      expect(response.status).not.toBe(401);
    });

    it('includes rate limit headers', () => {
      const token = createMockToken();
      const request = createMockRequest('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
        ip: '192.168.1.100',
      });
      const response = middleware(request);
      
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      const ip = '10.0.0.1';
      
      // Make many requests to exceed rate limit
      for (let i = 0; i < 101; i++) {
        const request = createMockRequest('/api/health', { ip });
        const response = middleware(request);
        
        if (i === 100) {
          expect(response.status).toBe(429);
          const body = await response.json();
          expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        }
      }
    });
  });

  describe('ignored routes', () => {
    it('allows access to /_next routes', () => {
      const request = createMockRequest('/_next/static/chunk.js');
      const response = middleware(request);
      
      expect(response.status).toBe(200);
    });

    it('allows access to favicon.ico', () => {
      const request = createMockRequest('/favicon.ico');
      const response = middleware(request);
      
      expect(response.status).toBe(200);
    });
  });
});
