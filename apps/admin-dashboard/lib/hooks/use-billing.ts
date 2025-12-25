'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { billingApi } from '@/lib/api/endpoints';
import type { BillingSummary, UsageStats, MarginConfig } from '@/lib/api/types';

export const billingKeys = {
  all: ['billing'] as const,
  summary: () => [...billingKeys.all, 'summary'] as const,
  usage: (period: string) => [...billingKeys.all, 'usage', period] as const,
  margins: () => [...billingKeys.all, 'margins'] as const,
};

/**
 * Hook to fetch billing summary
 */
export function useBillingSummary() {
  return useQuery({
    queryKey: billingKeys.summary(),
    queryFn: () => billingApi.getSummary(),
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch usage statistics
 */
export function useUsageStats(period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily') {
  return useQuery({
    queryKey: billingKeys.usage(period),
    queryFn: () => billingApi.getUsage(period),
  });
}

/**
 * Hook to fetch margins configuration
 */
export function useMargins() {
  return useQuery({
    queryKey: billingKeys.margins(),
    queryFn: () => billingApi.getMargins(),
  });
}

/**
 * Hook to update margins
 */
export function useUpdateMargins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerId, margins }: { providerId: string; margins: Partial<MarginConfig> }) =>
      billingApi.updateMargins(providerId, margins),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.margins() });
    },
  });
}
