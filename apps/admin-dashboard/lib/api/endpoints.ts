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
