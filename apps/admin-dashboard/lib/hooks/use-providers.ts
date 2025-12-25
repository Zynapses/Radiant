'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { providersApi } from '@/lib/api/endpoints';
import type { Provider } from '@/lib/api/types';
import type { PaginationParams, ApiResponse } from '@/lib/api/client';

// Query keys
export const providerKeys = {
  all: ['providers'] as const,
  lists: () => [...providerKeys.all, 'list'] as const,
  list: (params?: PaginationParams) => [...providerKeys.lists(), params] as const,
  details: () => [...providerKeys.all, 'detail'] as const,
  detail: (id: string) => [...providerKeys.details(), id] as const,
};

/**
 * Hook to fetch providers list
 */
export function useProviders(params?: PaginationParams) {
  return useQuery({
    queryKey: providerKeys.list(params),
    queryFn: () => providersApi.list(params),
  });
}

/**
 * Hook to fetch a single provider
 */
export function useProvider(id: string) {
  return useQuery({
    queryKey: providerKeys.detail(id),
    queryFn: () => providersApi.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to update provider
 */
export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Provider> }) =>
      providersApi.update(id, data),
    onSuccess: (updatedProvider) => {
      queryClient.setQueryData(providerKeys.detail(updatedProvider.id), updatedProvider);
      queryClient.invalidateQueries({ queryKey: providerKeys.lists() });
    },
  });
}

/**
 * Hook to set provider API key
 */
export function useSetProviderApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, apiKey }: { id: string; apiKey: string }) =>
      providersApi.setApiKey(id, apiKey),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: providerKeys.lists() });
    },
  });
}

/**
 * Hook to test provider connection
 */
export function useTestProviderConnection() {
  return useMutation({
    mutationFn: (id: string) => providersApi.testConnection(id),
  });
}

/**
 * Hook to enable/disable provider
 */
export function useSetProviderEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      providersApi.setEnabled(id, enabled),
    onSuccess: (updatedProvider) => {
      queryClient.setQueryData(providerKeys.detail(updatedProvider.id), updatedProvider);
      queryClient.invalidateQueries({ queryKey: providerKeys.lists() });
    },
  });
}
