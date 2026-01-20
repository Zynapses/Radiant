/**
 * API Client for Think Tank Consumer
 * 
 * All requests go through the Radiant API - no direct resource access.
 */

import { apiAuth } from '@/lib/auth/api-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
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
    const { method = 'GET', body, params } = options;

    const session = await apiAuth.getSession();
    if (!session) {
      window.location.href = '/login';
      throw { code: 'UNAUTHORIZED', message: 'No valid session' } as ApiError;
    }

    const url = this.buildUrl(path, params);
    const headers = apiAuth.getAuthHeaders();

    const requestInit: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (response.status === 401) {
      const refreshed = await apiAuth.refreshSession();
      if (!refreshed) {
        window.location.href = '/login';
        throw { code: 'UNAUTHORIZED', message: 'Session expired' } as ApiError;
      }
      
      const retryHeaders = apiAuth.getAuthHeaders();
      const retryResponse = await fetch(url, {
        ...requestInit,
        headers: retryHeaders,
      });
      
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw {
          code: error.code || 'REQUEST_FAILED',
          message: error.message || 'Request failed',
        } as ApiError;
      }
      
      return retryResponse.json();
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        code: error.code || 'REQUEST_FAILED',
        message: error.message || 'Request failed',
      } as ApiError;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    return {} as T;
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

export const api = new ApiClient(API_URL);
