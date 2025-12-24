const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.error?.message || 'An error occurred');
    }

    return data;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

export const api = {
  dashboard: {
    getStats: () => apiClient.get<DashboardStats>('/admin/dashboard'),
  },
  models: {
    list: () => apiClient.get<Model[]>('/admin/models'),
    get: (id: string) => apiClient.get<Model>(`/admin/models/${id}`),
    update: (id: string, data: Partial<Model>) => apiClient.put<Model>(`/admin/models/${id}`, data),
  },
  providers: {
    list: () => apiClient.get<Provider[]>('/admin/providers'),
    get: (id: string) => apiClient.get<Provider>(`/admin/providers/${id}`),
    update: (id: string, data: Partial<Provider>) => apiClient.put<Provider>(`/admin/providers/${id}`, data),
  },
  administrators: {
    list: () => apiClient.get<Administrator[]>('/admin/administrators'),
    get: (id: string) => apiClient.get<Administrator>(`/admin/administrators/${id}`),
    invite: (data: InviteData) => apiClient.post<Invitation>('/admin/invitations', data),
  },
  approvals: {
    list: () => apiClient.get<ApprovalRequest[]>('/admin/approvals'),
    approve: (id: string) => apiClient.post<ApprovalRequest>(`/admin/approvals/${id}/approve`),
    reject: (id: string) => apiClient.post<ApprovalRequest>(`/admin/approvals/${id}/reject`),
  },
  billing: {
    getUsage: (params?: UsageParams) => apiClient.get<UsageData>(`/admin/billing/usage${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
    getInvoices: () => apiClient.get<Invoice[]>('/admin/billing/invoices'),
  },
  auditLogs: {
    list: (params?: AuditParams) => apiClient.get<AuditLog[]>(`/admin/audit-logs${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
  },
};

// Types
interface DashboardStats {
  totalRequests: number;
  totalTokens: number;
  revenue: number;
  activeUsers: number;
  activeModels: number;
  activeProviders: number;
}

interface Model {
  id: string;
  name: string;
  displayName: string;
  category: string;
  status: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  type: string;
  status: string;
  healthStatus: string;
}

interface Administrator {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface InviteData {
  email: string;
  role: string;
}

interface ApprovalRequest {
  id: string;
  actionType: string;
  resourceType: string;
  status: string;
  requesterEmail: string;
  createdAt: string;
}

interface UsageData {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byModel: { modelId: string; count: number; tokens: number; cost: number }[];
}

interface UsageParams {
  startDate?: string;
  endDate?: string;
  tenantId?: string;
}

interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: string;
}

interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

interface AuditParams {
  startDate?: string;
  endDate?: string;
  action?: string;
}
