/**
 * RADIANT v4.18.0 - Provider Rejection Types
 * Handles AI provider/model rejections and intelligent fallback
 */

// ============================================================================
// Rejection Types
// ============================================================================

export type RejectionType = 
  | 'content_policy'      // Provider's content policy violation
  | 'safety_filter'       // Safety/moderation filter triggered
  | 'rate_limit'          // Rate limiting (not really rejection)
  | 'capability_mismatch' // Model can't handle this type of request
  | 'provider_ethics'     // Provider's ethical guidelines (different from ours)
  | 'context_length'      // Prompt too long
  | 'moderation'          // Pre-flight moderation blocked
  | 'unknown';            // Unknown rejection reason

export type RejectionFinalStatus = 
  | 'pending'           // Still being processed
  | 'fallback_success'  // Successfully used a fallback model
  | 'rejected'          // No fallback available, rejected to user
  | 'user_modified'     // User rephrased and succeeded
  | 'admin_override';   // Admin approved the request

export type HostingType = 'external' | 'self_hosted';

// ============================================================================
// Provider Rejection
// ============================================================================

export interface ProviderRejection {
  id: string;
  tenantId: string;
  userId: string;
  
  // Request context
  planId?: string;
  sessionId?: string;
  promptHash?: string;
  
  // Model that rejected
  modelId: string;
  providerId: string;
  hostingType: HostingType;
  
  // Rejection details
  rejectionType: RejectionType;
  rejectionCode?: string;
  rejectionMessage?: string;
  rejectionCategory?: string;
  
  // Our ethics check
  radiantEthicsPassed: boolean;
  radiantEthicsScore?: number;
  
  // Fallback tracking
  fallbackAttempted: boolean;
  fallbackModelId?: string;
  fallbackSucceeded?: boolean;
  fallbackChain: FallbackAttempt[];
  
  // Final outcome
  finalStatus: RejectionFinalStatus;
  finalResponseToUser?: string;
  
  // Metadata
  createdAt: Date;
  resolvedAt?: Date;
}

export interface FallbackAttempt {
  modelId: string;
  providerId: string;
  attemptedAt: string;
  succeeded: boolean;
  failureReason?: string;
}

// ============================================================================
// Rejection Notification
// ============================================================================

export interface RejectionNotification {
  id: string;
  tenantId: string;
  userId: string;
  rejectionId: string;
  
  // Content
  title: string;
  message: string;
  detailedReason?: string;
  suggestedActions: SuggestedAction[];
  
  // Status
  isRead: boolean;
  isDismissed: boolean;
  
  // From rejection
  rejectionType?: RejectionType;
  modelId?: string;
  finalStatus?: RejectionFinalStatus;
  
  // Metadata
  createdAt: Date;
  readAt?: Date;
  dismissedAt?: Date;
}

export interface SuggestedAction {
  action: 'rephrase' | 'contact_admin' | 'try_different_mode' | 'simplify' | 'remove_content';
  description: string;
  actionUrl?: string;
}

// ============================================================================
// Model Rejection Stats
// ============================================================================

export interface ModelRejectionStats {
  modelId: string;
  providerId: string;
  totalRequests: number;
  totalRejections: number;
  rejectionRate: number;
  contentPolicyCount: number;
  safetyFilterCount: number;
  providerEthicsCount: number;
  otherCount: number;
  fallbackAttempts: number;
  fallbackSuccesses: number;
  lastRejectionAt?: Date;
}

// ============================================================================
// Fallback Selection
// ============================================================================

export interface FallbackRecommendation {
  rejectionId: string;
  recommendedFallbacks: string[];  // Model IDs
  modelsToAvoid: string[];
  similarPatternId?: string;
}

export interface FallbackSelectionRequest {
  tenantId: string;
  userId: string;
  originalModelId: string;
  rejectionType: RejectionType;
  requiredCapabilities?: string[];
  preferredProviders?: string[];
  excludeProviders?: string[];
  minProficiency?: number;
}

export interface FallbackSelectionResult {
  success: boolean;
  selectedModelId?: string;
  selectedProviderId?: string;
  reason: string;
  alternativesConsidered: number;
  alternativesExcluded: number;
  noModelsReason?: string;
}

// ============================================================================
// Rejection Result (returned to caller)
// ============================================================================

export interface RejectionHandlingResult {
  // Was the request ultimately successful?
  success: boolean;
  
  // If successful, which model handled it?
  handlingModelId?: string;
  handlingProviderId?: string;
  
  // Was a fallback used?
  usedFallback: boolean;
  fallbackChain: FallbackAttempt[];
  
  // If rejected, why?
  rejected: boolean;
  rejectionId?: string;
  rejectionReason?: string;
  userFacingMessage?: string;
  
  // Notification created?
  notificationId?: string;
  
  // Stats
  modelsAttempted: number;
  modelsRejected: number;
  totalAvailableModels: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface RecordRejectionRequest {
  modelId: string;
  providerId: string;
  rejectionType: RejectionType;
  rejectionMessage?: string;
  rejectionCode?: string;
  planId?: string;
  promptHash?: string;
}

export interface GetRejectionNotificationsRequest {
  includeRead?: boolean;
  limit?: number;
}

export interface GetRejectionNotificationsResponse {
  notifications: RejectionNotification[];
  unreadCount: number;
}

export interface MarkNotificationReadRequest {
  notificationId: string;
}

export interface DismissNotificationRequest {
  notificationId: string;
}

// ============================================================================
// Think Tank Display Types
// ============================================================================

export interface RejectionDisplayData {
  // For showing in Think Tank UI
  hasRejections: boolean;
  rejections: RejectionSummary[];
  unreadCount: number;
}

export interface RejectionSummary {
  id: string;
  title: string;
  message: string;
  rejectionType: RejectionType;
  modelName: string;
  providerName: string;
  finalStatus: RejectionFinalStatus;
  wasResolved: boolean;
  suggestedActions: SuggestedAction[];
  createdAt: Date;
}

// ============================================================================
// Constants
// ============================================================================

export const REJECTION_TYPE_LABELS: Record<RejectionType, string> = {
  content_policy: 'Content Policy',
  safety_filter: 'Safety Filter',
  rate_limit: 'Rate Limit',
  capability_mismatch: 'Capability Mismatch',
  provider_ethics: 'Provider Ethics',
  context_length: 'Context Too Long',
  moderation: 'Moderation',
  unknown: 'Unknown',
};

export const REJECTION_TYPE_DESCRIPTIONS: Record<RejectionType, string> = {
  content_policy: 'The AI provider\'s content policy prevented this response',
  safety_filter: 'A safety filter was triggered by the content',
  rate_limit: 'Too many requests - please try again shortly',
  capability_mismatch: 'This model cannot handle this type of request',
  provider_ethics: 'The provider\'s ethical guidelines differ from the request',
  context_length: 'The prompt was too long for this model',
  moderation: 'Content moderation blocked this request',
  unknown: 'An unknown error occurred',
};

export const FINAL_STATUS_LABELS: Record<RejectionFinalStatus, string> = {
  pending: 'Processing',
  fallback_success: 'Resolved (Different Model)',
  rejected: 'Rejected',
  user_modified: 'Resolved (Modified Request)',
  admin_override: 'Approved by Admin',
};

export const MIN_MODELS_FOR_TASK = 2; // Minimum models needed to attempt a task
export const MAX_FALLBACK_ATTEMPTS = 3; // Maximum number of fallback attempts
