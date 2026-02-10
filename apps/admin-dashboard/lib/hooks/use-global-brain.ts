'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

interface GlobalBrainEnrollment {
  id?: string;
  tenant_id?: string;
  enrolled: boolean;
  enrollment_tier?: string;
  privacy_config: {
    dp_epsilon: number;
    dp_delta: number;
    dp_clip_norm: number;
    noise_multiplier: number;
    min_participation_rounds: number;
    gradient_retention_days: number;
  } | null;
  data_consent: {
    allow_omega_gradients: boolean;
    allow_cortex_metrics: boolean;
    allow_cato_metadata: boolean;
    allow_cross_domain: boolean;
    phi_exclusion: boolean;
  } | null;
  enrolled_at?: string | null;
  last_contribution?: string | null;
  total_contributions?: number;
  contribution_quality_score?: number;
}

interface GlobalBrainContribution {
  id: string;
  gradient_type: string;
  dream_cycle_id: string | null;
  round_id: string | null;
  size_bytes: number;
  dp_noise_applied: boolean;
  dp_epsilon_used: number | null;
  quality_score: number | null;
  status: string;
  uploaded_at: string;
}

interface GlobalBrainRound {
  id: string;
  round_number: number;
  round_type: string;
  status: string;
  target_participants: number;
  actual_participants: number;
  quality_metrics: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
}

interface GlobalBrainPipeline {
  id: string;
  pipeline_type: string;
  status: string;
  output_cartridge_id: string | null;
  target_version: string | null;
  progress: Record<string, unknown> | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface GlobalBrainStats {
  enrollment: { enrolled_count: number; total_count: number; avg_quality: number | null; total_contributions: number };
  gradients: { total_gradients: number; pending: number; aggregated: number; total_bytes: number; unique_contributors: number };
  rounds: { total_rounds: number; completed: number; active: number; avg_participants: number | null };
  pipelines: { total_pipelines: number; completed: number; scheduled: number };
}

// ============================================================================
// Query Keys
// ============================================================================

const KEYS = {
  enrollment: (tenantId?: string) => ['global-brain', 'enrollment', tenantId] as const,
  contributions: (tenantId?: string) => ['global-brain', 'contributions', tenantId] as const,
  rounds: ['global-brain', 'rounds'] as const,
  pipelines: ['global-brain', 'pipelines'] as const,
  stats: ['global-brain', 'stats'] as const,
};

// ============================================================================
// Hooks
// ============================================================================

export function useGlobalBrainEnrollment(tenantId?: string) {
  return useQuery({
    queryKey: KEYS.enrollment(tenantId),
    queryFn: async () => {
      const params = tenantId ? `?tenant_id=${tenantId}` : '';
      const res = await api.get(`/admin/global-brain/enrollment${params}`);
      return res as GlobalBrainEnrollment;
    },
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      tenantId?: string;
      enrolled: boolean;
      privacy_config?: Partial<GlobalBrainEnrollment['privacy_config']>;
      data_consent?: Partial<NonNullable<GlobalBrainEnrollment['data_consent']>>;
    }) => {
      const qs = params.tenantId ? `?tenant_id=${params.tenantId}` : '';
      return api.put(`/admin/global-brain/enrollment${qs}`, {
        enrolled: params.enrolled,
        privacy_config: params.privacy_config,
        data_consent: params.data_consent,
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.enrollment(vars.tenantId) });
      qc.invalidateQueries({ queryKey: KEYS.stats });
    },
  });
}

export function useGlobalBrainContributions(tenantId?: string, limit = 50) {
  return useQuery({
    queryKey: KEYS.contributions(tenantId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenant_id', tenantId);
      params.set('limit', String(limit));
      const res = await api.get(`/admin/global-brain/contributions?${params}`);
      return (res as { contributions: GlobalBrainContribution[] }).contributions;
    },
  });
}

export function useGlobalBrainRounds() {
  return useQuery({
    queryKey: KEYS.rounds,
    queryFn: async () => {
      const res = await api.get('/admin/global-brain/rounds');
      return (res as { rounds: GlobalBrainRound[] }).rounds;
    },
  });
}

export function useCreateRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { round_type: string; target_participants?: number }) => {
      return api.post('/admin/global-brain/rounds', params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.rounds });
    },
  });
}

export function useTriggerAveraging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roundId: string) => {
      return api.post(`/admin/global-brain/rounds/${roundId}/run`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.rounds });
      qc.invalidateQueries({ queryKey: KEYS.stats });
    },
  });
}

export function useGlobalBrainPipelines() {
  return useQuery({
    queryKey: KEYS.pipelines,
    queryFn: async () => {
      const res = await api.get('/admin/global-brain/pipeline');
      return (res as { pipelines: GlobalBrainPipeline[] }).pipelines;
    },
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      pipeline_type?: string;
      input_rounds?: string[];
      target_version?: string;
    }) => {
      return api.post('/admin/global-brain/pipeline', params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.pipelines });
    },
  });
}

export function useTriggerPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      return api.post(`/admin/global-brain/pipeline/${pipelineId}/run`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.pipelines });
      qc.invalidateQueries({ queryKey: KEYS.stats });
    },
  });
}

export function useGlobalBrainStats() {
  return useQuery({
    queryKey: KEYS.stats,
    queryFn: async () => {
      const res = await api.get('/admin/global-brain/stats');
      return res as GlobalBrainStats;
    },
    refetchInterval: 30_000,
  });
}
