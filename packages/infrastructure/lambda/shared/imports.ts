/**
 * RADIANT v4.18.0 - Standardized Import Paths
 * 
 * This module provides re-exports for commonly used imports to ensure
 * consistent import patterns across the Lambda codebase.
 * 
 * Usage:
 * Instead of: import { executeStatement } from '../db/client';
 * Use:        import { db, services } from '../shared/imports';
 * 
 * Benefits:
 * - Single import for related functionality
 * - Consistent paths regardless of file depth
 * - Better tree-shaking with explicit imports
 * - Easier refactoring when internals change
 */

// ============================================================================
// Database
// ============================================================================

export * as db from './db/client';
export { executeStatement, stringParam, longParam, boolParam } from './db/client';
export { withTransaction, type TransactionContext } from './db/transaction';

// ============================================================================
// Logging
// ============================================================================

export { enhancedLogger, enhancedLogger as logger } from './logging/enhanced-logger';

// ============================================================================
// Errors
// ============================================================================

export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  isOperationalError,
  toAppError,
} from './errors';

export {
  errorToResponse,
  isRetryableError,
  handleServiceError,
  handleServiceErrorSync,
  safeJsonParse,
  getErrorMessage,
} from './errors/index';

// ============================================================================
// Middleware
// ============================================================================

export {
  successResponse,
  errorResponse,
  noContentResponse,
  createdResponse,
  DEFAULT_CORS_HEADERS,
} from './middleware/api-response';

// ============================================================================
// Services - Domain Specific Barrels
// ============================================================================

// Use these for tree-shaking and better organization
export * as agiServices from './services/agi';
export * as coreServices from './services/core';
export * as platformServices from './services/platform';
export * as modelServices from './services/models';

// ============================================================================
// Individual Services (commonly used)
// ============================================================================

export { delightService } from './services/delight.service';
export { domainTaxonomyService } from './services/domain-taxonomy.service';
export { agiBrainPlannerService } from './services/agi-brain-planner.service';
export { agiOrchestrationSettingsService } from './services/agi-orchestration-settings.service';
export { modelRouterService } from './services/model-router.service';
export { learningService } from './services/learning.service';
