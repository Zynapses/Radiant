/**
 * RADIANT v6.0.4 - Brain Config API Client
 * Type-safe API client for AGI Brain configuration
 */

import { api } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface ParameterConstraints {
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface Parameter {
  id: string;
  categoryId: string;
  key: string;
  name: string;
  description: string;
  type: 'number' | 'string' | 'boolean' | 'select' | 'json';
  value: unknown;
  defaultValue: unknown;
  constraints?: ParameterConstraints;
  dangerous?: boolean;
  requiresRestart?: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface ParameterCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
  parameters: Parameter[];
}

export interface ConfigHistoryEntry {
  id: string;
  configKey: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedByName?: string;
  changeReason?: string;
  changedAt: string;
}

export interface ConfigUpdateRequest {
  key: string;
  value: unknown;
  reason?: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    key: string;
    message: string;
  }>;
  warnings: Array<{
    key: string;
    message: string;
  }>;
}

// ============================================================================
// CONFIG API
// ============================================================================

export const configApi = {
  // Get all configuration grouped by category
  getConfig: () =>
    api.get<ParameterCategory[]>('/api/admin/brain/config'),

  // Get single parameter
  getParameter: (key: string) =>
    api.get<Parameter>(`/api/admin/brain/config/${key}`),

  // Update single parameter
  updateParameter: (key: string, value: unknown, reason?: string) =>
    api.patch<Parameter>(`/api/admin/brain/config/${key}`, { value, reason }),

  // Batch update multiple parameters
  batchUpdate: (updates: ConfigUpdateRequest[]) =>
    api.post<{ updated: string[]; failed: Array<{ key: string; error: string }> }>(
      '/api/admin/brain/config/batch',
      { updates }
    ),

  // Validate configuration changes before applying
  validate: (updates: ConfigUpdateRequest[]) =>
    api.post<ConfigValidationResult>('/api/admin/brain/config/validate', { updates }),

  // Reset parameter to default value
  resetParameter: (key: string) =>
    api.post<Parameter>(`/api/admin/brain/config/${key}/reset`),

  // Reset all parameters in a category to defaults
  resetCategory: (categoryId: string) =>
    api.post<{ reset: string[] }>(`/api/admin/brain/config/category/${categoryId}/reset`),

  // Get configuration history
  getHistory: (params?: { key?: string; limit?: number }) =>
    api.get<ConfigHistoryEntry[]>('/api/admin/brain/config/history', params as Record<string, string | number | boolean | undefined>),

  // Export configuration as JSON
  exportConfig: () =>
    api.get<Record<string, unknown>>('/api/admin/brain/config/export'),

  // Import configuration from JSON
  importConfig: (config: Record<string, unknown>, overwrite?: boolean) =>
    api.post<{ imported: string[]; skipped: string[]; errors: string[] }>(
      '/api/admin/brain/config/import',
      { config, overwrite }
    ),
};
