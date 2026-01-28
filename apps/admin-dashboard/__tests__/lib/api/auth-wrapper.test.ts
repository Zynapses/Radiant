import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { withAuth, withAdminAuth, apiError, apiSuccess } from '@/lib/api/auth-wrapper';

// Helper to create mock NextRequest
function createMockRequest(options: {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
} = {}): NextRequest {
  const headers = new Headers(options.headers || {});
  
  const request = {
    headers,
    cookies: {
      get: (name: string) => {
        const value = options.cookies?.[name];
        return value ? { name, value } : undefined;
      },
    },
    nextUrl: new URL('http://localhost/api/test'),
    url: 'http://localhost/api/test',
  } as unknown as NextRequest;
  
  return request;
}

// Helper to create a valid JWT token
function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    ...payload,
  }));
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}

describe('withAuth', () => {
  it('returns 401 when no token is provided', async () => {
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    
    const request = createMockRequest();
    const response = await wrappedHandler(request);
    
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', async () => {
    const expiredToken = (() => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = btoa(JSON.stringify({
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        sub: 'user-123',
        email: 'test@example.com',
      }));
      return `${header}.${body}.signature`;
    })();
    
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    
    const request = createMockRequest({
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const response = await wrappedHandler(request);
    
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('calls handler with user context when valid token provided', async () => {
    const token = createMockToken({
      sub: 'user-123',
      email: 'test@example.com',
      'custom:role': 'admin',
    });
    
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    );
    const wrappedHandler = withAuth(handler);
    
    const request = createMockRequest({
      headers: { Authorization: `Bearer ${token}` },
    });
    await wrappedHandler(request);
    
    expect(handler).toHaveBeenCalled();
    const calledRequest = handler.mock.calls[0][0];
    expect(calledRequest.user).toMatchObject({
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin',
    });
  });

  it('reads token from cookie if not in header', async () => {
    const token = createMockToken({
      sub: 'user-456',
      email: 'cookie@example.com',
    });
    
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    );
    const wrappedHandler = withAuth(handler);
    
    const request = createMockRequest({
      cookies: { radiant_access_token: token },
    });
    await wrappedHandler(request);
    
    expect(handler).toHaveBeenCalled();
    const calledRequest = handler.mock.calls[0][0];
    expect(calledRequest.user.id).toBe('user-456');
  });
});

describe('withAdminAuth', () => {
  it('returns 403 when user role is not admin', async () => {
    const token = createMockToken({
      sub: 'user-123',
      email: 'test@example.com',
      'custom:role': 'user',
    });
    
    const handler = vi.fn();
    const wrappedHandler = withAdminAuth(handler);
    
    const request = createMockRequest({
      headers: { Authorization: `Bearer ${token}` },
    });
    const response = await wrappedHandler(request);
    
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('allows admin users', async () => {
    const token = createMockToken({
      sub: 'admin-123',
      email: 'admin@example.com',
      'custom:role': 'admin',
    });
    
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    );
    const wrappedHandler = withAdminAuth(handler);
    
    const request = createMockRequest({
      headers: { Authorization: `Bearer ${token}` },
    });
    await wrappedHandler(request);
    
    expect(handler).toHaveBeenCalled();
  });

  it('allows super_admin users', async () => {
    const token = createMockToken({
      sub: 'superadmin-123',
      email: 'superadmin@example.com',
      'custom:role': 'super_admin',
    });
    
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    );
    const wrappedHandler = withAdminAuth(handler);
    
    const request = createMockRequest({
      headers: { Authorization: `Bearer ${token}` },
    });
    await wrappedHandler(request);
    
    expect(handler).toHaveBeenCalled();
  });
});

describe('apiError', () => {
  it('creates error response with correct status', async () => {
    const response = apiError('TEST_ERROR', 'Test message', 400);
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('TEST_ERROR');
    expect(body.error.message).toBe('Test message');
  });

  it('includes details when provided', async () => {
    const response = apiError('TEST_ERROR', 'Test', 400, { field: 'email' });
    
    const body = await response.json();
    expect(body.error.details).toEqual({ field: 'email' });
  });
});

describe('apiSuccess', () => {
  it('creates success response', async () => {
    const response = apiSuccess({ data: 'test' });
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: 'test' });
  });

  it('supports custom status code', async () => {
    const response = apiSuccess({ created: true }, 201);
    
    expect(response.status).toBe(201);
  });
});
