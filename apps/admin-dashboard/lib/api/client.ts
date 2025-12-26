/**
 * Type-safe API client for RADIANT Admin Dashboard
 * Handles authentication, error handling, and request/response transformation
 */

import { getTokens } from '@/lib/auth/cognito-client';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

// ============================================================================
// API CLIENT
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const tokens = await getTokens();
      return tokens?.accessToken || null;
    } catch (error) {
      console.warn('[ApiClient] Failed to get auth token:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
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

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      params,
      headers = {},
      skipAuth = false,
    } = options;

    const url = this.buildUrl(path, params);
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (!skipAuth) {
      const token = await this.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include',
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw {
          code: 'NETWORK_ERROR',
          message: `Request failed with status ${response.status}`,
          requestId: response.headers.get('x-request-id') || undefined,
        } as ApiError;
      }
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      throw {
        code: data.error?.code || 'UNKNOWN_ERROR',
        message: data.error?.message || 'An unknown error occurred',
        details: data.error?.details,
        requestId: response.headers.get('x-request-id') || data.requestId,
      } as ApiError;
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

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);
