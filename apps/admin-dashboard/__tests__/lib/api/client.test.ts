import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the cognito-client module
vi.mock('@/lib/auth/cognito-client', () => ({
  getTokens: vi.fn(),
}));

describe('ApiClient', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('buildUrl', () => {
    it('throws error when API URL is not configured', async () => {
      process.env.NEXT_PUBLIC_API_URL = '';
      
      // Dynamic import to get fresh module with new env
      const { api } = await import('@/lib/api/client');
      
      await expect(api.get('/test')).rejects.toThrow(
        'API base URL not configured'
      );
    });

    it('builds URL with query parameters', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      
      const { api } = await import('@/lib/api/client');
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: 'test' }),
      });
      
      await api.get('/test', { page: 1, limit: 10 });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });
  });

  describe('request methods', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('makes GET requests', async () => {
      const { api } = await import('@/lib/api/client');
      
      const result = await api.get('/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual({ success: true });
    });

    it('makes POST requests with body', async () => {
      const { api } = await import('@/lib/api/client');
      
      await api.post('/test', { data: 'value' });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'value' }),
        })
      );
    });

    it('makes PUT requests', async () => {
      const { api } = await import('@/lib/api/client');
      
      await api.put('/test', { updated: true });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('makes DELETE requests', async () => {
      const { api } = await import('@/lib/api/client');
      
      await api.delete('/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    });

    it('throws ApiError on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'BAD_REQUEST', message: 'Invalid input' },
        }),
      });
      
      const { api } = await import('@/lib/api/client');
      
      await expect(api.get('/test')).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Invalid input',
      });
    });

    it('handles network errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/html' }),
      });
      
      const { api } = await import('@/lib/api/client');
      
      await expect(api.get('/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });
  });
});
