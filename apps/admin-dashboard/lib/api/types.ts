/**
 * Admin Dashboard Types - RADIANT v4.18.0
 * API Response Types for RADIANT Admin Dashboard
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT' | 'AUTOMATIC';
export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';
export type ModelStatus = 'active' | 'beta' | 'deprecated' | 'coming_soon';
export type AdminRole = 'super_admin' | 'admin' | 'operator' | 'auditor';
export type AdminStatus = 'active' | 'pending' | 'inactive' | 'suspended';

export type ModelCategory = 
  | 'vision_classification'
  | 'vision_detection'
  | 'vision_segmentation'
  | 'audio_stt'
  | 'audio_speaker'
  | 'scientific_protein'
  | 'scientific_math'
  | 'medical_imaging'
  | 'geospatial'
  | 'generative_3d'
  | 'llm_text';

export type ProviderCategory = 
  | 'text_generation'
  | 'image_generation'
  | 'video_generation'
  | 'audio_generation'
  | 'speech_to_text'
  | 'text_to_speech'
  | 'embedding'
  | 'search'
  | '3d_generation'
  | 'reasoning';

// ============================================================================
// MODELS
// ============================================================================

export interface Model {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ModelCategory;
  specialty: string;
  provider: string;
  isExternal: boolean;
  isEnabled: boolean;
  thermalState: ThermalState;
  serviceState: ServiceState;
  parameters: number;
  accuracy?: string;
  capabilities: string[];
  inputFormats: string[];
  outputFormats: string[];
  minTier: number;
  pricing: {
    inputPer1k: number;
    outputPer1k: number;
    hourlyRate?: number;
    perImage?: number;
    perMinuteAudio?: number;
    markup: number;
  };
  usage: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModelFilters {
  search?: string;
  category?: ModelCategory;
  thermalState?: ThermalState;
  isExternal?: boolean;
  isEnabled?: boolean;
  minTier?: number;
}

// ============================================================================
// PROVIDERS
// ============================================================================

export interface Provider {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  baseUrl?: string;
  modelCount: number;
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastHealthCheck?: string;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SERVICES
// ============================================================================

export interface MidLevelService {
  id: string;
  name: string;
  displayName: string;
  description: string;
  state: ServiceState;
  models: string[];
  healthStatus: 'healthy' | 'degraded' | 'down';
  lastHealthCheck: string;
  metrics: {
    requestsLast24h: number;
    avgLatencyMs: number;
    errorRate: number;
  };
}

// ============================================================================
// ADMINISTRATORS
// ============================================================================

export interface Administrator {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: AdminRole;
  mfaEnabled: boolean;
  status: AdminStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: AdminRole;
  invitedBy: string;
  invitedByName: string;
  message?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  type: 'deployment' | 'promotion' | 'model_activation' | 'provider_change' | 'user_role_change' | 'billing_change' | 'security_change';
  title: string;
  description: string;
  environment: 'dev' | 'staging' | 'prod';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  initiatedBy: {
    id: string;
    name: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  };
  initiatedAt: string;
  expiresAt: string;
  approvedAt?: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// BILLING
// ============================================================================

export interface BillingSummary {
  currentMonth: {
    totalCost: number;
    totalRevenue: number;
    margin: number;
    breakdown: {
      external: number;
      selfHosted: number;
      infrastructure: number;
    };
  };
  comparison: {
    previousMonth: number;
    percentChange: number;
  };
  projections: {
    endOfMonth: number;
    endOfQuarter: number;
  };
}

export interface UsageStats {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  data: Array<{
    timestamp: string;
    requests: number;
    tokens: {
      input: number;
      output: number;
    };
    cost: number;
    revenue: number;
  }>;
}

export interface MarginConfig {
  providerId: string;
  providerName: string;
  defaultMargin: number;
  modelOverrides: Array<{
    modelId: string;
    modelName: string;
    margin: number;
  }>;
}

export interface UsageEvent {
  id: string;
  tenantId: string;
  userId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  latencyMs: number;
  status: 'success' | 'error';
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface BillingBreakdown {
  totalCost: number;
  byProvider: { providerId: string; cost: number; percentage: number }[];
  byCategory: { category: ProviderCategory; cost: number; percentage: number }[];
  byModel: { modelId: string; cost: number; requests: number }[];
}

// ============================================================================
// GEOGRAPHIC
// ============================================================================

export interface RegionStats {
  region: string;
  displayName: string;
  status: 'active' | 'standby' | 'maintenance';
  requests: {
    last24h: number;
    last7d: number;
  };
  latency: {
    avg: number;
    p95: number;
    p99: number;
  };
  endpoints: {
    total: number;
    healthy: number;
  };
}

export interface GeographicUsage {
  countryCode: string;
  countryName: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface UsageTrendPoint {
  date: string;
  requests: number;
  tokens: number;
}

export interface DashboardMetrics {
  totalRequests: {
    value: number;
    change: number;
    period: '24h' | '7d' | '30d';
  };
  activeModels: {
    value: number;
    external: number;
    selfHosted: number;
  };
  revenue: {
    value: number;
    change: number;
    period: '24h' | '7d' | '30d';
  };
  errorRate: {
    value: number;
    change: number;
    period: '24h' | '7d' | '30d';
  };
  usageTrends?: UsageTrendPoint[];
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    lastCheck: string;
    message?: string;
  }>;
}

export interface RecentActivity {
  id: string;
  type: 'model_activation' | 'provider_update' | 'admin_action' | 'deployment' | 'alert';
  title: string;
  description: string;
  actor?: {
    id: string;
    name: string;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    types: {
      approvalRequests: boolean;
      modelAlerts: boolean;
      billingAlerts: boolean;
      systemHealth: boolean;
    };
  };
  slack?: {
    enabled: boolean;
    webhookConfigured: boolean;
    types: {
      approvalRequests: boolean;
      modelAlerts: boolean;
      billingAlerts: boolean;
      systemHealth: boolean;
    };
  };
  inApp: {
    enabled: boolean;
    playSound: boolean;
  };
}

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

export type TierLevel = 1 | 2 | 3 | 4 | 5;

export interface TierConfig {
  level: TierLevel;
  name: string;
  monthlyCredits: number;
  features: string[];
  rateMultiplier: number;
}

export const TIER_CONFIGS: Record<TierLevel, TierConfig> = {
  1: { level: 1, name: 'Free', monthlyCredits: 5, features: ['basic'], rateMultiplier: 1.0 },
  2: { level: 2, name: 'Starter', monthlyCredits: 50, features: ['basic', 'priority'], rateMultiplier: 0.95 },
  3: { level: 3, name: 'Pro', monthlyCredits: 200, features: ['basic', 'priority', 'advanced'], rateMultiplier: 0.90 },
  4: { level: 4, name: 'Team', monthlyCredits: 1000, features: ['basic', 'priority', 'advanced', 'team'], rateMultiplier: 0.85 },
  5: { level: 5, name: 'Enterprise', monthlyCredits: -1, features: ['all'], rateMultiplier: 0.75 },
};

// ============================================================================
// AUDIT LOG
// ============================================================================

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ============================================================================
// COLOR CONSTANTS
// ============================================================================

export const THERMAL_STATE_COLORS: Record<ThermalState, string> = {
  OFF: 'bg-gray-500',
  COLD: 'bg-blue-500',
  WARM: 'bg-yellow-500',
  HOT: 'bg-red-500',
  AUTOMATIC: 'bg-purple-500',
};

export const SERVICE_STATE_COLORS: Record<ServiceState, string> = {
  RUNNING: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  DISABLED: 'bg-gray-500',
  OFFLINE: 'bg-red-500',
};
