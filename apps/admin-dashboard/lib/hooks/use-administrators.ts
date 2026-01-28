'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  administratorsApi,
  invitationsApi,
  approvalsApi,
} from '@/lib/api/endpoints';
import type {
  AdminRole,
} from '@/lib/api/types';
import type { PaginationParams } from '@/lib/api/client';

export const adminKeys = {
  all: ['administrators'] as const,
  lists: () => [...adminKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...adminKeys.lists(), params] as const,
  details: () => [...adminKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminKeys.details(), id] as const,
};

export const invitationKeys = {
  all: ['invitations'] as const,
  list: (status?: string) => [...invitationKeys.all, status] as const,
};

export const approvalKeys = {
  all: ['approvals'] as const,
  list: (status?: string) => [...approvalKeys.all, status] as const,
  detail: (id: string) => [...approvalKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch administrators list
 */
export function useAdministrators(params?: PaginationParams) {
  return useQuery({
    queryKey: adminKeys.list(params),
    queryFn: () => administratorsApi.list(params),
  });
}

/**
 * Hook to fetch a single administrator
 */
export function useAdministrator(id: string) {
  return useQuery({
    queryKey: adminKeys.detail(id),
    queryFn: () => administratorsApi.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to change administrator role
 */
export function useChangeAdminRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) =>
      administratorsApi.changeRole(id, role),
    onSuccess: (updatedAdmin) => {
      queryClient.setQueryData(adminKeys.detail(updatedAdmin.id), updatedAdmin);
      queryClient.invalidateQueries({ queryKey: adminKeys.lists() });
    },
  });
}

/**
 * Hook to deactivate an administrator
 */
export function useDeactivateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => administratorsApi.deactivate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.lists() });
    },
  });
}

// ============================================================================
// INVITATIONS
// ============================================================================

/**
 * Hook to fetch invitations
 */
export function useInvitations(status?: 'pending' | 'accepted' | 'expired' | 'revoked') {
  return useQuery({
    queryKey: invitationKeys.list(status),
    queryFn: () => invitationsApi.list(status),
  });
}

/**
 * Hook to create an invitation
 */
export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: AdminRole; message?: string }) =>
      invitationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.all });
    },
  });
}

/**
 * Hook to revoke an invitation
 */
export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invitationsApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.all });
    },
  });
}

/**
 * Hook to resend an invitation
 */
export function useResendInvitation() {
  return useMutation({
    mutationFn: (id: string) => invitationsApi.resend(id),
  });
}

// ============================================================================
// APPROVALS
// ============================================================================

/**
 * Hook to fetch approval requests
 */
export function useApprovals(status?: 'pending' | 'approved' | 'rejected') {
  return useQuery({
    queryKey: approvalKeys.list(status),
    queryFn: () => approvalsApi.list(status),
    refetchInterval: 30000,
  });
}

/**
 * Hook to fetch a single approval request
 */
export function useApproval(id: string) {
  return useQuery({
    queryKey: approvalKeys.detail(id),
    queryFn: () => approvalsApi.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to approve a request
 */
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      approvalsApi.approve(id, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

/**
 * Hook to reject a request
 */
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalsApi.reject(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}
