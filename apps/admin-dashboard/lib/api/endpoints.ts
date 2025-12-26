/**
 * API Endpoint Definitions - RADIANT Admin Dashboard
 */

import { api } from './client';
import type {
  Model,
  ModelFilters,
  Provider,
  MidLevelService,
  Administrator,
  Invitation,
  ApprovalRequest,
  BillingSummary,
  UsageStats,
  MarginConfig,
  RegionStats,
  DashboardMetrics,
  SystemHealth,
  RecentActivity,
  Notification,
  NotificationPreferences,
  ThermalState,
  ServiceState,
  AdminRole,
} from './types';
import type { PaginationParams, ApiResponse } from './client';

// ============================================================================
// DASHBOARD
// ============================================================================

export const dashboardApi = {
  getMetrics: (period: '24h' | '7d' | '30d' = '24h') =>
    api.get<DashboardMetrics>('/api/v2/admin/dashboard/metrics', { period }),
    
  getHealth: () =>
    api.get<SystemHealth>('/api/v2/admin/dashboard/health'),
    
  getRecentActivity: (limit = 10) =>
    api.get<RecentActivity[]>('/api/v2/admin/dashboard/activity', { limit }),
};

// ============================================================================
// MODELS
// ============================================================================

export const modelsApi = {
  list: (filters?: ModelFilters & PaginationParams) =>
    api.get<ApiResponse<Model[]>>('/api/v2/admin/models', filters as Record<string, string | number | boolean | undefined>),
    
  get: (id: string) =>
    api.get<Model>(`/api/v2/admin/models/${id}`),
    
  update: (id: string, data: Partial<Model>) =>
    api.patch<Model>(`/api/v2/admin/models/${id}`, data),
    
  setThermalState: (id: string, state: ThermalState) =>
    api.post<Model>(`/api/v2/admin/models/${id}/thermal`, { state }),
    
  setEnabled: (id: string, enabled: boolean) =>
    api.post<Model>(`/api/v2/admin/models/${id}/enabled`, { enabled }),
    
  warmUp: (id: string) =>
    api.post<{ estimatedWaitSeconds: number }>(`/api/v2/admin/models/${id}/warm-up`),
    
  getUsage: (id: string, period: '24h' | '7d' | '30d') =>
    api.get<UsageStats>(`/api/v2/admin/models/${id}/usage`, { period }),
};

// ============================================================================
// PROVIDERS
// ============================================================================

export const providersApi = {
  list: (params?: PaginationParams) =>
    api.get<ApiResponse<Provider[]>>('/api/v2/admin/providers', params as Record<string, string | number | boolean | undefined>),
    
  get: (id: string) =>
    api.get<Provider>(`/api/v2/admin/providers/${id}`),
    
  update: (id: string, data: Partial<Provider>) =>
    api.patch<Provider>(`/api/v2/admin/providers/${id}`, data),
    
  setApiKey: (id: string, apiKey: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/providers/${id}/api-key`, { apiKey }),
    
  testConnection: (id: string) =>
    api.post<{ healthy: boolean; latencyMs: number; error?: string }>(`/api/v2/admin/providers/${id}/test`),
    
  setEnabled: (id: string, enabled: boolean) =>
    api.post<Provider>(`/api/v2/admin/providers/${id}/enabled`, { enabled }),
};

// ============================================================================
// SERVICES
// ============================================================================

export const servicesApi = {
  list: () =>
    api.get<MidLevelService[]>('/api/v2/admin/services'),
    
  get: (id: string) =>
    api.get<MidLevelService>(`/api/v2/admin/services/${id}`),
    
  setState: (id: string, state: ServiceState) =>
    api.post<MidLevelService>(`/api/v2/admin/services/${id}/state`, { state }),
    
  getHealth: (id: string) =>
    api.get<{ healthy: boolean; checks: Array<{ name: string; passed: boolean }> }>(
      `/api/v2/admin/services/${id}/health`
    ),
};

// ============================================================================
// ADMINISTRATORS
// ============================================================================

export const administratorsApi = {
  list: (params?: PaginationParams) =>
    api.get<ApiResponse<Administrator[]>>('/api/v2/admin/administrators', params as Record<string, string | number | boolean | undefined>),
    
  get: (id: string) =>
    api.get<Administrator>(`/api/v2/admin/administrators/${id}`),
    
  update: (id: string, data: Partial<Administrator>) =>
    api.patch<Administrator>(`/api/v2/admin/administrators/${id}`, data),
    
  deactivate: (id: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/administrators/${id}/deactivate`),
    
  changeRole: (id: string, role: AdminRole) =>
    api.post<Administrator>(`/api/v2/admin/administrators/${id}/role`, { role }),
};

// ============================================================================
// INVITATIONS
// ============================================================================

export const invitationsApi = {
  list: (status?: 'pending' | 'accepted' | 'expired' | 'revoked') =>
    api.get<Invitation[]>('/api/v2/admin/invitations', { status }),
    
  create: (data: { email: string; role: AdminRole; message?: string }) =>
    api.post<Invitation>('/api/v2/admin/invitations', data),
    
  revoke: (id: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/invitations/${id}/revoke`),
    
  resend: (id: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/invitations/${id}/resend`),
    
  accept: (token: string, data: { firstName: string; lastName: string; password: string }) =>
    api.post<{ success: boolean }>('/api/v2/admin/invitations/accept', { token, ...data }),
};

// ============================================================================
// APPROVALS
// ============================================================================

export const approvalsApi = {
  list: (status?: 'pending' | 'approved' | 'rejected') =>
    api.get<ApprovalRequest[]>('/api/v2/admin/approvals', { status }),
    
  get: (id: string) =>
    api.get<ApprovalRequest>(`/api/v2/admin/approvals/${id}`),
    
  approve: (id: string, notes?: string) =>
    api.post<ApprovalRequest>(`/api/v2/admin/approvals/${id}/approve`, { notes }),
    
  reject: (id: string, reason: string) =>
    api.post<ApprovalRequest>(`/api/v2/admin/approvals/${id}/reject`, { reason }),
};

// ============================================================================
// BILLING
// ============================================================================

export const billingApi = {
  getSummary: () =>
    api.get<BillingSummary>('/api/v2/admin/billing/summary'),
    
  getUsage: (period: 'hourly' | 'daily' | 'weekly' | 'monthly') =>
    api.get<UsageStats>('/api/v2/admin/billing/usage', { period }),
    
  getMargins: () =>
    api.get<MarginConfig[]>('/api/v2/admin/billing/margins'),
    
  updateMargins: (providerId: string, margins: Partial<MarginConfig>) =>
    api.patch<MarginConfig>(`/api/v2/admin/billing/margins/${providerId}`, margins),
};

// ============================================================================
// GEOGRAPHIC
// ============================================================================

export const geographicApi = {
  getRegions: () =>
    api.get<RegionStats[]>('/api/v2/admin/geographic/regions'),
    
  getRegion: (region: string) =>
    api.get<RegionStats>(`/api/v2/admin/geographic/regions/${region}`),
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<Notification[]>('/api/v2/admin/notifications', { unreadOnly }),
    
  markRead: (id: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/notifications/${id}/read`),
    
  markAllRead: () =>
    api.post<{ success: boolean }>('/api/v2/admin/notifications/read-all'),
    
  getPreferences: () =>
    api.get<NotificationPreferences>('/api/v2/admin/notifications/preferences'),
    
  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    api.patch<NotificationPreferences>('/api/v2/admin/notifications/preferences', prefs),
};

// ============================================================================
// PROFILE
// ============================================================================

export const profileApi = {
  get: () =>
    api.get<Administrator>('/api/v2/admin/profile'),
    
  update: (data: { firstName?: string; lastName?: string; displayName?: string }) =>
    api.patch<Administrator>('/api/v2/admin/profile', data),
    
  enableMfa: () =>
    api.post<{ qrCodeUrl: string; secret: string }>('/api/v2/admin/profile/mfa/enable'),
    
  verifyMfa: (code: string) =>
    api.post<{ success: boolean }>('/api/v2/admin/profile/mfa/verify', { code }),
    
  disableMfa: (code: string) =>
    api.post<{ success: boolean }>('/api/v2/admin/profile/mfa/disable', { code }),
};

// ============================================================================
// THINK TANK
// ============================================================================

export interface ThinkTankStatus {
  installed: boolean;
  version: string;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: string;
  };
  features: {
    conversations: boolean;
    collaboration: boolean;
    voiceVideo: boolean;
    canvas: boolean;
  };
  metrics: {
    activeUsers: number;
    totalConversations: number;
    avgResponseTime: number;
  };
}

export interface ThinkTankConfig {
  maxUsersPerTenant: number;
  maxConversationsPerUser: number;
  enabledModels: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerDay: number;
  };
  features: {
    collaboration: boolean;
    voiceVideo: boolean;
    canvas: boolean;
    codeExecution: boolean;
  };
  retentionDays: number;
}

export interface UserConsent {
  id: string;
  userId: string;
  email: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'ai_training';
  granted: boolean;
  grantedAt: string | null;
  withdrawnAt: string | null;
  ipAddress: string;
}

export interface GDPRRequest {
  id: string;
  userId: string;
  email: string;
  requestType: 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

export const thinkTankApi = {
  // Status & Health
  getStatus: () =>
    api.get<ThinkTankStatus>('/api/v2/admin/thinktank/status'),
    
  refreshStatus: () =>
    api.post<ThinkTankStatus>('/api/v2/admin/thinktank/status/refresh'),

  // Configuration
  getConfig: () =>
    api.get<ThinkTankConfig>('/api/v2/admin/thinktank/config'),
    
  updateConfig: (config: Partial<ThinkTankConfig>) =>
    api.patch<ThinkTankConfig>('/api/v2/admin/thinktank/config', config),

  // Consent Management (GDPR)
  listConsents: (params?: { userId?: string; consentType?: string }) =>
    api.get<{ consents: UserConsent[]; stats: Record<string, number> }>(
      '/api/v2/admin/thinktank/consent',
      params as Record<string, string>
    ),
    
  recordConsent: (data: { userId: string; email: string; consentType: string; granted: boolean }) =>
    api.post<UserConsent>('/api/v2/admin/thinktank/consent', data),
    
  withdrawConsent: (userId: string, consentType: string) =>
    api.delete<{ success: boolean }>(`/api/v2/admin/thinktank/consent?userId=${userId}&consentType=${consentType}`),

  // GDPR Data Requests
  listGDPRRequests: (params?: { status?: string; requestType?: string }) =>
    api.get<{ requests: GDPRRequest[]; stats: Record<string, number> }>(
      '/api/v2/admin/thinktank/gdpr',
      params as Record<string, string>
    ),
    
  createGDPRRequest: (data: { userId: string; email: string; requestType: 'export' | 'delete' }) =>
    api.post<GDPRRequest>('/api/v2/admin/thinktank/gdpr', data),
    
  updateGDPRRequest: (requestId: string, status: string) =>
    api.patch<GDPRRequest>('/api/v2/admin/thinktank/gdpr', { requestId, status }),

  // Sharing
  getShareLink: (conversationId: string) =>
    api.post<{ token: string; url: string; expiresAt: string }>(
      '/api/v2/admin/thinktank/share',
      { conversationId }
    ),
    
  getSharedConversation: (token: string) =>
    api.get<{ conversation: unknown; sharedBy: string; expiresAt: string }>(
      `/api/v2/admin/thinktank/share/${token}`
    ),
};

// ============================================================================
// MULTI-REGION
// ============================================================================

export interface RegionConfig {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'standby' | 'disabled';
  isPrimary: boolean;
  endpoint: string;
  latencyMs: number;
  healthScore: number;
  services: {
    api: boolean;
    database: boolean;
    cache: boolean;
    storage: boolean;
  };
}

export const multiRegionApi = {
  listRegions: () =>
    api.get<RegionConfig[]>('/api/v2/admin/multi-region/regions'),
    
  getRegion: (regionId: string) =>
    api.get<RegionConfig>(`/api/v2/admin/multi-region/regions/${regionId}`),
    
  updateRegion: (regionId: string, config: Partial<RegionConfig>) =>
    api.patch<RegionConfig>(`/api/v2/admin/multi-region/regions/${regionId}`, config),
    
  setRegionStatus: (regionId: string, status: 'active' | 'standby' | 'disabled') =>
    api.post<RegionConfig>(`/api/v2/admin/multi-region/regions/${regionId}/status`, { status }),
    
  failover: (fromRegion: string, toRegion: string) =>
    api.post<{ success: boolean; newPrimary: string }>(
      '/api/v2/admin/multi-region/failover',
      { fromRegion, toRegion }
    ),
    
  startDeployment: (data: { version: string; regions: string[]; strategy: string }) =>
    api.post<MultiRegionDeployment>('/api/v2/admin/multi-region/deploy', data),
    
  getCurrentDeployment: () =>
    api.get<MultiRegionDeployment | null>('/api/v2/admin/multi-region/deployment/current'),
};

// ============================================================================
// EXPERIMENTS (A/B Testing)
// ============================================================================

export interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: Array<{
    id: string;
    name: string;
    weight: number;
    sampleSize: number;
  }>;
  targetAudience: { percentage: number };
  metrics: string[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  results?: {
    isSignificant: boolean;
    pValue: number;
    confidenceLevel: number;
    controlMean: number;
    treatmentMean: number;
    uplift: number;
    recommendation: string;
  };
}

export const experimentsApi = {
  list: (params?: { product?: string; status?: string }) =>
    api.get<Experiment[]>('/api/v2/admin/experiments', params as Record<string, string>),
    
  get: (id: string) =>
    api.get<Experiment>(`/api/v2/admin/experiments/${id}`),
    
  create: (data: Partial<Experiment>) =>
    api.post<Experiment>('/api/v2/admin/experiments', data),
    
  update: (id: string, data: Partial<Experiment>) =>
    api.patch<Experiment>(`/api/v2/admin/experiments/${id}`, data),
    
  pause: (id: string) =>
    api.post<Experiment>(`/api/v2/admin/experiments/${id}/pause`),
    
  complete: (id: string) =>
    api.post<Experiment>(`/api/v2/admin/experiments/${id}/complete`),
    
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/api/v2/admin/experiments/${id}`),
};

// ============================================================================
// COST MANAGEMENT
// ============================================================================

export interface CostSummary {
  totalSpend: number;
  totalSpendChange: number;
  estimatedMonthly: number;
  estimatedChange: number;
  averageDaily: number;
  averageDailyChange: number;
  topModel: string;
  topModelSpend: number;
  tokenCount: number;
  requestCount: number;
  daily: number;
  weekly: number;
  monthly: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  trendData?: Array<{ date: string; cost: number }>;
}

export interface CostAlert {
  id: string;
  tenantId: string;
  alertType: 'threshold' | 'spike' | 'budget';
  threshold: number;
  currentValue: number;
  isTriggered: boolean;
  triggeredAt: string | null;
  notificationChannels: string[];
  createdAt: string;
}

export interface CostInsight {
  id: string;
  type: 'model_switch' | 'usage_pattern' | 'efficiency';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
  action: string;
}

export const costApi = {
  getSummary: (period?: '7d' | '30d' | '90d') =>
    api.get<CostSummary>('/api/v2/admin/cost/summary', { period }),
    
  getAlerts: () =>
    api.get<CostAlert[]>('/api/v2/admin/cost/alerts'),
    
  createAlert: (data: Partial<CostAlert>) =>
    api.post<CostAlert>('/api/v2/admin/cost/alerts', data),
    
  updateAlert: (id: string, data: Partial<CostAlert>) =>
    api.patch<CostAlert>(`/api/v2/admin/cost/alerts/${id}`, data),
    
  deleteAlert: (id: string) =>
    api.delete<{ success: boolean }>(`/api/v2/admin/cost/alerts/${id}`),
    
  getInsights: () =>
    api.get<CostInsight[]>('/api/v2/admin/cost/insights'),
    
  applyInsight: (id: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/cost/insights/${id}/apply`),
    
  dismissInsight: (id: string) =>
    api.post<{ success: boolean }>(`/api/v2/admin/cost/insights/${id}/dismiss`),
};

// ============================================================================
// COMPLIANCE
// ============================================================================

export interface ComplianceReport {
  id: string;
  tenantId: string;
  reportType: 'soc2' | 'hipaa' | 'gdpr' | 'pci';
  status: 'compliant' | 'partial' | 'non_compliant' | 'generating';
  score: number;
  findings: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    description: string;
    recommendation: string;
    status: 'open' | 'in_progress' | 'resolved';
  }>;
  generatedAt: string;
  expiresAt: string;
  requestedBy?: string;
  estimatedCompletion?: string;
}

export const complianceApi = {
  getReport: (framework: string) =>
    api.get<ComplianceReport>('/api/v2/admin/compliance/report', { framework }),
    
  generateReport: (framework: string) =>
    api.post<ComplianceReport>('/api/v2/admin/compliance/generate', { framework }),
    
  getScores: () =>
    api.get<Record<string, number>>('/api/v2/admin/compliance/scores'),
    
  listReports: () =>
    api.get<ComplianceReport[]>('/api/v2/admin/compliance/reports'),
};

// ============================================================================
// DEPLOYMENTS
// ============================================================================

export interface Deployment {
  id: string;
  version: string;
  environment: 'production' | 'staging' | 'development';
  status: 'pending' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  startedAt: string;
  completedAt: string | null;
  startedBy: string;
  duration: number | null;
}

export interface MultiRegionDeployment {
  id: string;
  packageVersion: string;
  strategy: 'canary' | 'blue_green' | 'rolling';
  targetRegions: string[];
  startedBy: string;
  startedAt: string;
  completedAt: string | null;
  regionStatuses: Record<string, {
    region: string;
    status: 'pending' | 'deploying' | 'completed' | 'failed';
    progress: number;
    message: string;
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

export const deploymentsApi = {
  list: (params?: { status?: string; environment?: string }) =>
    api.get<Deployment[]>('/api/v2/admin/deployments', params as Record<string, string>),
    
  get: (id: string) =>
    api.get<Deployment>(`/api/v2/admin/deployments/${id}`),
    
  create: (data: { version: string; environment: string }) =>
    api.post<Deployment>('/api/v2/admin/deployments', data),
    
  rollback: (id: string) =>
    api.post<Deployment>(`/api/v2/admin/deployments/${id}/rollback`),
};

// ============================================================================
// SECURITY
// ============================================================================

export interface ThinkTankSecurityConfig {
  dataEncryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  ipWhitelistEnabled: boolean;
  mfaRequired: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  dataRetentionDays: number;
  piiMaskingEnabled: boolean;
  exportRestricted: boolean;
}

export const securityApi = {
  getThinkTankConfig: () =>
    api.get<ThinkTankSecurityConfig>('/api/v2/admin/security/thinktank/config'),
    
  updateThinkTankConfig: (config: Partial<ThinkTankSecurityConfig>) =>
    api.patch<ThinkTankSecurityConfig>('/api/v2/admin/security/thinktank/config', config),
};
