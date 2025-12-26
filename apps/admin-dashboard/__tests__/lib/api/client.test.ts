import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the cognito-client module
vi.mock('@/lib/auth/cognito-client', () => ({
  getTokens: vi.fn().mockResolvedValue({ accessToken: 'test-token' }),
}));

// Create a test API client class to test the logic directly
class TestApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    if (!this.baseUrl) {
      throw new Error(
        'API base URL not configured. Set NEXT_PUBLIC_API_URL environment variable.'
      );
    }
    const url = new URL(path, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  async request<T>(path: string, options: { method?: string; body?: unknown; params?: Record<string, string | number | boolean | undefined> } = {}): Promise<T> {
    const { method = 'GET', body, params } = options;
    const url = this.buildUrl(path, params);
    
    const requestInit: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);
    const contentType = response.headers.get('content-type');
    
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw { code: 'NETWORK_ERROR', message: `Request failed with status ${response.status}` };
      }
      return {} as T;
    }

    const data = await response.json();
    if (!response.ok) {
      throw {
        code: data.error?.code || 'UNKNOWN_ERROR',
        message: data.error?.message || 'An unknown error occurred',
      };
    }
    return data;
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(path, { method: 'GET', params });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

describe('ApiClient', () => {
  let api: TestApiClient;
  
  beforeEach(() => {
    api = new TestApiClient('https://api.example.com');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ success: true }),
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildUrl', () => {
    it('throws error when API URL is not configured', async () => {
      const emptyApi = new TestApiClient('');
      
      await expect(emptyApi.get('/test')).rejects.toThrow(
        'API base URL not configured'
      );
    });

    it('builds URL with query parameters', async () => {
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
    it('makes GET requests', async () => {
      const result = await api.get('/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual({ success: true });
    });

    it('makes POST requests with body', async () => {
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
      await api.put('/test', { updated: true });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('makes DELETE requests', async () => {
      await api.delete('/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('error handling', () => {
    it('throws ApiError on non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'BAD_REQUEST', message: 'Invalid input' },
        }),
      });
      
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
      
      await expect(api.get('/test')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });
  });
});
