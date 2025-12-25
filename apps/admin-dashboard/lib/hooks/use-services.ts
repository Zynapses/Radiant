'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { servicesApi } from '@/lib/api/endpoints';
import type { MidLevelService, ServiceState } from '@/lib/api/types';

// Query keys
export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'list'] as const,
  list: () => [...serviceKeys.lists()] as const,
  details: () => [...serviceKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  health: (id: string) => [...serviceKeys.detail(id), 'health'] as const,
};

/**
 * Hook to fetch all services
 */
export function useServices() {
  return useQuery({
    queryKey: serviceKeys.list(),
    queryFn: () => servicesApi.list(),
  });
}

/**
 * Hook to fetch a single service
 */
export function useService(id: string) {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => servicesApi.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to set service state
 */
export function useSetServiceState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: ServiceState }) =>
      servicesApi.setState(id, state),
    onSuccess: (updatedService) => {
      queryClient.setQueryData(serviceKeys.detail(updatedService.id), updatedService);
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

/**
 * Hook to get service health
 */
export function useServiceHealth(id: string) {
  return useQuery({
    queryKey: serviceKeys.health(id),
    queryFn: () => servicesApi.getHealth(id),
    enabled: !!id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
