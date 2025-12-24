'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.dashboard.getStats();
      return response.data;
    },
    refetchInterval: 30000,
  });
}

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await api.models.list();
      return response.data;
    },
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const response = await api.providers.list();
      return response.data;
    },
  });
}

export function useAdministrators() {
  return useQuery({
    queryKey: ['administrators'],
    queryFn: async () => {
      const response = await api.administrators.list();
      return response.data;
    },
  });
}

export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const response = await api.approvals.list();
      return response.data;
    },
    refetchInterval: 60000,
  });
}

export function useAuditLogs(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['auditLogs', params],
    queryFn: async () => {
      const response = await api.auditLogs.list(params);
      return response.data;
    },
  });
}
