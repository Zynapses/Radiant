/**
 * API Client re-export for backwards compatibility
 * Use @/lib/api/client for the full API client
 */

export { api as apiClient, api } from './api/client';
export type { ApiError, ApiResponse, PaginationParams } from './api/client';
