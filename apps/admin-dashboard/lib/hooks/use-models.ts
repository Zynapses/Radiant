'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { modelsApi } from '@/lib/api/endpoints';
import type { Model, ModelFilters, ThermalState } from '@/lib/api/types';
import type { PaginationParams, ApiResponse } from '@/lib/api/client';

export const modelKeys = {
  all: ['models'] as const,
  lists: () => [...modelKeys.all, 'list'] as const,
  list: (filters?: ModelFilters & PaginationParams) =>
    [...modelKeys.lists(), filters] as const,
  details: () => [...modelKeys.all, 'detail'] as const,
  detail: (id: string) => [...modelKeys.details(), id] as const,
  usage: (id: string, period: string) =>
    [...modelKeys.detail(id), 'usage', period] as const,
};

/**
 * Hook to fetch models list with filtering and pagination
 */
export function useModels(
  filters?: ModelFilters & PaginationParams,
  options?: Omit<UseQueryOptions<ApiResponse<Model[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: modelKeys.list(filters),
    queryFn: () => modelsApi.list(filters),
    ...options,
  });
}

/**
 * Hook to fetch a single model
 */
export function useModel(
  id: string,
  options?: Omit<UseQueryOptions<Model>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: modelKeys.detail(id),
    queryFn: () => modelsApi.get(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to update model thermal state
 */
export function useSetThermalState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: ThermalState }) =>
      modelsApi.setThermalState(id, state),
    onSuccess: (updatedModel) => {
      queryClient.setQueryData(modelKeys.detail(updatedModel.id), updatedModel);
      queryClient.invalidateQueries({ queryKey: modelKeys.lists() });
    },
  });
}

/**
 * Hook to enable/disable a model
 */
export function useSetModelEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      modelsApi.setEnabled(id, enabled),
    onSuccess: (updatedModel) => {
      queryClient.setQueryData(modelKeys.detail(updatedModel.id), updatedModel);
      queryClient.invalidateQueries({ queryKey: modelKeys.lists() });
    },
  });
}

/**
 * Hook to warm up a model
 */
export function useWarmUpModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modelsApi.warmUp(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: modelKeys.detail(id) });
    },
  });
}

/**
 * Hook to fetch model usage statistics
 */
export function useModelUsage(
  id: string,
  period: '24h' | '7d' | '30d' = '24h'
) {
  return useQuery({
    queryKey: modelKeys.usage(id, period),
    queryFn: () => modelsApi.getUsage(id, period),
    enabled: !!id,
  });
}
