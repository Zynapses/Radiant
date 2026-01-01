/**
 * RADIANT v6.0.4 - Brain API Client
 * Type-safe API client for AGI Brain dashboard
 */

import { api } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface GhostStats {
  totalGhosts: number;
  activeGhosts: number;
  avgTurnCount: number;
  avgTimeSinceReanchor: number;
  versionDistribution: Record<string, number>;
  migrationsPending: number;
}

export interface DreamStats {
  pendingJobs: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
  avgDurationMs: number;
  oldestPendingAt: string | null;
}

export interface OversightStats {
  pending: number;
  escalated: number;
  approvedToday: number;
  rejectedToday: number;
  expiredToday: number;
  avgReviewTimeMs: number;
  oldestPendingAt: string | null;
  byDomain: Record<string, number>;
}

export interface SofaiStats {
  total: number;
  byLevel: Record<string, number>;
  avgTrust: number;
  avgDomainRisk: number;
  avgLatencyMs: number;
}

export interface BrainDashboardData {
  ghost: GhostStats;
  dreams: DreamStats;
  oversight: OversightStats;
  sofai: SofaiStats | null;
  timestamp: string;
}

export interface GhostVector {
  id: string;
  userId: string;
  tenantId: string;
  version: string;
  turnCount: number;
  lastReanchorAt: string | null;
  capturedAt: string;
  updatedAt: string;
  healthy: boolean;
  issues: string[];
}

export interface DreamJob {
  id: string;
  tenantId: string;
  reason: 'low_traffic' | 'twilight' | 'starvation' | 'manual';
  priority: 'high' | 'normal';
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface OversightQueueItem {
  id: string;
  insightId: string;
  tenantId: string;
  domain: 'healthcare' | 'financial' | 'legal' | 'general';
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'escalated' | 'expired';
  assignedTo: string | null;
  createdAt: string;
  reviewedAt: string | null;
  expiresAt: string;
  insightPreview: string;
}

export interface OversightDecision {
  insightId: string;
  decision: 'approved' | 'rejected' | 'modified';
  reasoning: string;
  modifiedInsight?: string;
  attestation: string;
}

// ============================================================================
// BRAIN API
// ============================================================================

export const brainApi = {
  // Dashboard
  getDashboard: () =>
    api.get<BrainDashboardData>('/api/admin/brain/dashboard'),

  // Ghost Vectors
  getGhosts: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<{ ghosts: GhostVector[]; total: number }>('/api/admin/brain/ghosts', params as Record<string, string | number | boolean | undefined>),

  getGhost: (userId: string) =>
    api.get<GhostVector>(`/api/admin/brain/ghosts/${userId}`),

  reanchorGhost: (userId: string) =>
    api.post<{ success: boolean; newTurnCount: number }>(`/api/admin/brain/ghosts/${userId}/reanchor`),

  deleteGhost: (userId: string) =>
    api.delete<{ success: boolean }>(`/api/admin/brain/ghosts/${userId}`),

  getGhostStats: () =>
    api.get<GhostStats>('/api/admin/brain/ghosts/stats'),

  // Dreams
  getDreams: (params?: { status?: string; reason?: string }) =>
    api.get<{ jobs: DreamJob[]; total: number }>('/api/admin/brain/dreams', params as Record<string, string | number | boolean | undefined>),

  triggerDream: (tenantId: string, reason: 'manual' = 'manual') =>
    api.post<DreamJob>('/api/admin/brain/dreams/trigger', { tenantId, reason }),

  cancelDream: (jobId: string) =>
    api.post<{ success: boolean }>(`/api/admin/brain/dreams/${jobId}/cancel`),

  getDreamStats: () =>
    api.get<DreamStats>('/api/admin/brain/dreams/stats'),

  // Oversight
  getOversightQueue: (params?: { status?: string; domain?: string }) =>
    api.get<{ items: OversightQueueItem[]; total: number }>('/api/admin/brain/oversight', params as Record<string, string | number | boolean | undefined>),

  getOversightItem: (id: string) =>
    api.get<OversightQueueItem & { insightJson: Record<string, unknown> }>(`/api/admin/brain/oversight/${id}`),

  reviewOversight: (id: string, decision: OversightDecision) =>
    api.post<{ success: boolean }>(`/api/admin/brain/oversight/${id}/review`, decision),

  escalateOversight: (id: string) =>
    api.post<{ success: boolean }>(`/api/admin/brain/oversight/${id}/escalate`),

  assignOversight: (id: string, assigneeId: string) =>
    api.post<{ success: boolean }>(`/api/admin/brain/oversight/${id}/assign`, { assigneeId }),

  getOversightStats: () =>
    api.get<OversightStats>('/api/admin/brain/oversight/stats'),

  // SOFAI
  getSofaiStats: (period?: '24h' | '7d' | '30d') =>
    api.get<SofaiStats>('/api/admin/brain/sofai/stats', { period }),

  getSofaiRouting: (params?: { level?: string; page?: number; pageSize?: number }) =>
    api.get<{ logs: Array<{
      id: string;
      userId: string;
      level: string;
      trustScore: number;
      domainRisk: number;
      computeCost: number;
      reasoning: string;
      createdAt: string;
    }>; total: number }>('/api/admin/brain/sofai/routing', params as Record<string, string | number | boolean | undefined>),

  // ECD (Entity-Context Divergence) - Hallucination Prevention
  getECDStats: (days?: number) =>
    api.get<ECDStats>('/api/admin/brain/ecd/stats', { days }),

  getECDTrend: (days?: number) =>
    api.get<Array<{ date: string; avgScore: number; passRate: number; totalRequests: number }>>(
      '/api/admin/brain/ecd/trend',
      { days }
    ),

  getECDEntityBreakdown: (days?: number) =>
    api.get<Array<{ entityType: string; totalCount: number; groundedCount: number; divergentCount: number; divergenceRate: number }>>(
      '/api/admin/brain/ecd/entities',
      { days }
    ),

  getECDRecentDivergences: (limit?: number) =>
    api.get<Array<{ entity: string; type: string; reason: string; timestamp: string }>>(
      '/api/admin/brain/ecd/divergences',
      { limit }
    ),
};

// ECD Stats interface
export interface ECDStats {
  avgScore: number;
  firstPassRate: number;
  refinementsToday: number;
  blockedToday: number;
  totalRequests: number;
}
