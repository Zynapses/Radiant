'use client';

import { useQuery } from '@tanstack/react-query';
import {
  dashboardApi,
} from '../api/endpoints';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await dashboardApi.getMetrics('24h');
      return response;
    },
    refetchInterval: 30000,
  });
}

export function useDashboardHealth() {
  return useQuery({
    queryKey: ['dashboard', 'health'],
    queryFn: () => dashboardApi.getHealth(),
    refetchInterval: 30000,
  });
}

export function useDashboardActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: () => dashboardApi.getRecentActivity(limit),
  });
}
