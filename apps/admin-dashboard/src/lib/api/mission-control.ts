/**
 * Mission Control API Client
 * 
 * Client for interacting with the Mission Control REST API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ListDecisionsParams {
  status?: string;
  domain?: string;
  limit?: number;
  offset?: number;
}

interface ResolveDecisionParams {
  resolution: 'approved' | 'rejected' | 'modified';
  guidance?: string;
}

interface PendingDecision {
  id: string;
  tenantId: string;
  sessionId: string;
  question: string;
  context: Record<string, unknown>;
  options: unknown[];
  topicTag?: string;
  domain: string;
  urgency: string;
  status: string;
  timeoutSeconds: number;
  expiresAt: string;
  flyteExecutionId: string;
  flyteNodeId: string;
  catoEscalationId?: string;
  resolution?: string;
  guidance?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  pendingCount: number;
  resolvedToday: number;
  expiredToday: number;
  escalatedToday: number;
  avgResolutionTimeMs: number;
  byDomain: Record<string, number>;
  byUrgency: Record<string, number>;
}

interface DomainConfig {
  id: string;
  tenantId?: string;
  domain: string;
  defaultTimeoutSeconds: number;
  escalationTimeoutSeconds: number;
  autoEscalate: boolean;
  escalationChannel?: string;
  escalationTarget?: string;
  requiredRoles: string[];
  allowAutoResolve: boolean;
  requireGuidance: boolean;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const tenantId = typeof window !== 'undefined' 
    ? localStorage.getItem('tenantId') || ''
    : '';
  
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('accessToken') || ''
    : '';

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const missionControlApi = {
  listDecisions: (params: ListDecisionsParams = {}): Promise<PendingDecision[]> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.domain) searchParams.set('domain', params.domain);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return request<PendingDecision[]>('GET', `/api/mission-control/decisions${query ? `?${query}` : ''}`);
  },

  getDecision: (id: string): Promise<PendingDecision> => {
    return request<PendingDecision>('GET', `/api/mission-control/decisions/${id}`);
  },

  resolveDecision: (id: string, params: ResolveDecisionParams): Promise<PendingDecision> => {
    return request<PendingDecision>('POST', `/api/mission-control/decisions/${id}/resolve`, params);
  },

  getStats: (): Promise<DashboardStats> => {
    return request<DashboardStats>('GET', '/api/mission-control/stats');
  },

  getConfig: (domain?: string): Promise<DomainConfig[]> => {
    const query = domain ? `?domain=${domain}` : '';
    return request<DomainConfig[]>('GET', `/api/mission-control/config${query}`);
  },

  updateConfig: (domain: string, config: Partial<DomainConfig>): Promise<DomainConfig> => {
    return request<DomainConfig>('PUT', '/api/mission-control/config', {
      domain,
      ...config,
    });
  },
};

export default missionControlApi;
