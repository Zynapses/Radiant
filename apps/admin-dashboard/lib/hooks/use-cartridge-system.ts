'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ============================================================================
// Types (mirror shared types for dashboard use)
// ============================================================================

interface UniversalCartridge {
  id: string;
  tenant_id: string | null;
  cartridge_type: string;
  name: string;
  display_name: string;
  version: string;
  description?: string;
  targets: string[];
  sections_present: string[];
  status: string;
  signature_valid: boolean;
  total_size_bytes: number;
  created_at: string;
  updated_at: string;
  install_count?: number;
}

interface CartridgeInstallation {
  id: string;
  tenant_id: string;
  cartridge_id: string;
  stack_priority: number;
  installation_status: string;
  merge_strategy: string;
  installed_at: string;
  name?: string;
  display_name?: string;
  version?: string;
  cartridge_type?: string;
  targets?: string[];
  sections_present?: string[];
}

interface CartridgeResolvedState {
  tenant_id: string;
  resolved_firmware: Record<string, unknown>;
  resolved_sections: Record<string, unknown>;
  resolution_log: string[];
  resolved_at: string;
}

interface CartridgeAuditEntry {
  id: string;
  cartridge_id?: string;
  action: string;
  actor_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
  cartridge_name?: string;
  cartridge_version?: string;
}

interface CartridgeTargetService {
  id: string;
  service_key: string;
  display_name: string;
  description?: string;
  required_sections: string[];
  optional_sections: string[];
  is_active: boolean;
}

interface CartridgeUploadResponse {
  cartridge_id: string;
  upload_url: string;
  storage_ref: string;
  expires_at: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const cartridgeSystemKeys = {
  all: ['cartridge-system'] as const,
  lists: () => [...cartridgeSystemKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) =>
    [...cartridgeSystemKeys.lists(), filters] as const,
  details: () => [...cartridgeSystemKeys.all, 'detail'] as const,
  detail: (id: string) => [...cartridgeSystemKeys.details(), id] as const,
  stack: () => [...cartridgeSystemKeys.all, 'stack'] as const,
  resolved: () => [...cartridgeSystemKeys.all, 'resolved'] as const,
  targets: () => [...cartridgeSystemKeys.all, 'targets'] as const,
  targetSpecs: (key: string) => [...cartridgeSystemKeys.targets(), key, 'specs'] as const,
  audit: (filters?: Record<string, string>) =>
    [...cartridgeSystemKeys.all, 'audit', filters] as const,
};

// ============================================================================
// List Cartridges
// ============================================================================

export function useCartridgeSystemList(
  filters?: { type?: string; target?: string; status?: string; limit?: string; offset?: string },
  options?: Omit<UseQueryOptions<{ cartridges: UniversalCartridge[]; total: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.list(filters),
    queryFn: () =>
      api.get<{ cartridges: UniversalCartridge[]; total: number }>(
        '/api/admin/cartridge-system',
        filters as Record<string, string>
      ),
    ...options,
  });
}

// ============================================================================
// Get Cartridge Detail
// ============================================================================

export function useCartridgeSystemDetail(
  id: string,
  options?: Omit<UseQueryOptions<{ cartridge: UniversalCartridge }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.detail(id),
    queryFn: () =>
      api.get<{ cartridge: UniversalCartridge }>(`/api/admin/cartridge-system/${id}`),
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// Upload Cartridge (get pre-signed URL)
// ============================================================================

export function useCartridgeUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      display_name: string;
      version: string;
      cartridge_type: string;
      targets: string[];
      description?: string;
    }) => api.post<CartridgeUploadResponse>('/api/admin/cartridge-system/upload', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.lists() });
    },
  });
}

// ============================================================================
// Validate Cartridge
// ============================================================================

export function useCartridgeValidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cartridgeId: string) =>
      api.post<{ message: string; cartridge_id: string }>(
        `/api/admin/cartridge-system/${cartridgeId}/validate`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.lists() });
    },
  });
}

// ============================================================================
// Install Cartridge
// ============================================================================

export function useCartridgeInstall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cartridgeId,
      ...body
    }: {
      cartridgeId: string;
      stack_priority?: number;
      merge_strategy?: string;
      configuration_overrides?: Record<string, unknown>;
    }) =>
      api.post<{ message: string; installation_id: string; cartridge_id: string }>(
        `/api/admin/cartridge-system/${cartridgeId}/install`,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.lists() });
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.stack() });
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.resolved() });
    },
  });
}

// ============================================================================
// Uninstall Cartridge
// ============================================================================

export function useCartridgeUninstall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cartridgeId: string) =>
      api.post<{ message: string }>(
        `/api/admin/cartridge-system/${cartridgeId}/uninstall`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.lists() });
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.stack() });
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.resolved() });
    },
  });
}

// ============================================================================
// Get Stack
// ============================================================================

export function useCartridgeStack(
  options?: Omit<UseQueryOptions<{ stack: CartridgeInstallation[] }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.stack(),
    queryFn: () =>
      api.get<{ stack: CartridgeInstallation[] }>('/api/admin/cartridge-system/stack'),
    ...options,
  });
}

// ============================================================================
// Reorder Stack
// ============================================================================

export function useCartridgeReorder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      installations: Array<{ installation_id: string; stack_priority: number }>
    ) =>
      api.put<{ message: string }>('/api/admin/cartridge-system/stack/reorder', {
        installations,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.stack() });
      queryClient.invalidateQueries({ queryKey: cartridgeSystemKeys.resolved() });
    },
  });
}

// ============================================================================
// Get Resolved State
// ============================================================================

export function useCartridgeResolved(
  options?: Omit<UseQueryOptions<{ resolved: CartridgeResolvedState | null }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.resolved(),
    queryFn: () =>
      api.get<{ resolved: CartridgeResolvedState | null }>(
        '/api/admin/cartridge-system/resolved'
      ),
    ...options,
  });
}

// ============================================================================
// Export Soft ROM
// ============================================================================

export function useExportSoftRom() {
  return useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/api/admin/cartridge-system/export-soft-rom'),
  });
}

// ============================================================================
// List Targets
// ============================================================================

export function useCartridgeTargets(
  options?: Omit<UseQueryOptions<{ targets: CartridgeTargetService[] }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.targets(),
    queryFn: () =>
      api.get<{ targets: CartridgeTargetService[] }>(
        '/api/admin/cartridge-system/targets'
      ),
    ...options,
  });
}

// ============================================================================
// Get Target Specs
// ============================================================================

export function useCartridgeTargetSpecs(
  serviceKey: string,
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.targetSpecs(serviceKey),
    queryFn: () =>
      api.get(`/api/admin/cartridge-system/targets/${serviceKey}/specs`),
    enabled: !!serviceKey,
    ...options,
  });
}

// ============================================================================
// Audit Log
// ============================================================================

export function useCartridgeAudit(
  filters?: { limit?: string },
  options?: Omit<UseQueryOptions<{ audit: CartridgeAuditEntry[] }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: cartridgeSystemKeys.audit(filters),
    queryFn: () =>
      api.get<{ audit: CartridgeAuditEntry[] }>(
        '/api/admin/cartridge-system/audit',
        filters as Record<string, string>
      ),
    ...options,
  });
}
