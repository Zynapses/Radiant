/**
 * RADIANT v5.1.1 - Authentication & Authorization Types
 * 
 * Three-Layer Authentication Architecture:
 * - Layer 1: End-User Authentication (Cognito User Pool)
 * - Layer 2: Platform Administrator Authentication (Cognito Admin Pool)
 * - Layer 3: Service/Machine Authentication (API Keys)
 * 
 * Plus: Enterprise SSO Federation (SAML/OIDC)
 */

// ============================================================================
// LAYER 1: END-USER AUTHENTICATION
// ============================================================================

export type AuthTenantUserRole = 'standard_user' | 'tenant_admin' | 'tenant_owner';

export interface TenantUser {
  id: string;
  tenantId: string;
  cognitoSub?: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: AuthTenantUserRole;
  hasAccessThinkTank: boolean;
  hasAccessCurator: boolean;
  hasAccessTenantAdmin: boolean;
  ssoProvider?: string;
  ssoProviderUserId?: string;
  ssoConnectionId?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  mfaMethods: MfaMethod[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type MfaMethod = 'totp' | 'sms' | 'email' | 'passkey';

export interface CreateTenantUserRequest {
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role?: AuthTenantUserRole;
  hasAccessThinkTank?: boolean;
  hasAccessCurator?: boolean;
  hasAccessTenantAdmin?: boolean;
  sendInvitation?: boolean;
}

// ============================================================================
// LAYER 2: PLATFORM ADMINISTRATOR AUTHENTICATION
// ============================================================================

export type PlatformAdminRole = 'super_admin' | 'admin' | 'operator' | 'auditor';

export interface PlatformAdmin {
  id: string;
  cognitoSub: string;
  email: string;
  firstName: string;
  lastName: string;
  adminRole: PlatformAdminRole;
  permissions: PlatformPermission[];
  invitedBy?: string;
  invitedAt?: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type PlatformPermission =
  | 'tenants:read' | 'tenants:write' | 'tenants:delete'
  | 'users:read' | 'users:write' | 'users:delete'
  | 'models:read' | 'models:write' | 'models:delete'
  | 'billing:read' | 'billing:write'
  | 'config:read' | 'config:write'
  | 'audit:read' | 'audit:export'
  | 'scaling:read' | 'scaling:write'
  | 'security:read' | 'security:write'
  | 'reports:read' | 'reports:generate';

export const PLATFORM_ADMIN_ROLE_PERMISSIONS: Record<PlatformAdminRole, PlatformPermission[]> = {
  super_admin: [
    'tenants:read', 'tenants:write', 'tenants:delete',
    'users:read', 'users:write', 'users:delete',
    'models:read', 'models:write', 'models:delete',
    'billing:read', 'billing:write',
    'config:read', 'config:write',
    'audit:read', 'audit:export',
    'scaling:read', 'scaling:write',
    'security:read', 'security:write',
    'reports:read', 'reports:generate',
  ],
  admin: [
    'tenants:read', 'tenants:write',
    'users:read', 'users:write',
    'models:read', 'models:write',
    'billing:read',
    'config:read', 'config:write',
    'audit:read',
    'scaling:read', 'scaling:write',
    'security:read',
    'reports:read', 'reports:generate',
  ],
  operator: [
    'tenants:read',
    'users:read',
    'models:read',
    'config:read',
    'audit:read',
    'scaling:read',
    'reports:read',
  ],
  auditor: [
    'tenants:read',
    'users:read',
    'billing:read',
    'audit:read', 'audit:export',
    'reports:read',
  ],
};

// ============================================================================
// LAYER 3: SERVICE/MACHINE AUTHENTICATION (API KEYS)
// ============================================================================

export type ApiKeyScope =
  | 'chat:read' | 'chat:write'
  | 'models:read'
  | 'embeddings:write'
  | 'files:read' | 'files:write'
  | 'knowledge:read' | 'knowledge:write'
  | 'admin:read' | 'admin:write';

export interface ServiceApiKey {
  id: string;
  tenantId: string;
  keyPrefix: string; // First 8 chars for identification (e.g., "rk_live_")
  keyHash: string; // bcrypt hash of full key
  name: string;
  description?: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  allowedIps?: string[];
  allowedOrigins?: string[];
  expiresAt?: string;
  isActive: boolean;
  lastUsedAt?: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  allowedIps?: string[];
  allowedOrigins?: string[];
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  key: string; // Full key - only shown once
  keyPrefix: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
  createdAt: string;
}

export interface ApiKeyUsage {
  keyId: string;
  period: 'minute' | 'hour' | 'day' | 'month';
  requestCount: number;
  tokenCount: number;
  errorCount: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
}

export type ApiKeyAuditAction = 'created' | 'used' | 'revoked' | 'rotated' | 'updated' | 'rate_limited';

export interface ApiKeyAuditEntry {
  id: string;
  tenantId: string;
  keyId: string;
  keyPrefix: string;
  action: ApiKeyAuditAction;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  scopesUsed?: ApiKeyScope[];
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

// ============================================================================
// ENTERPRISE SSO FEDERATION
// ============================================================================

export type SsoProtocol = 'saml' | 'oidc';

export interface TenantSsoConnection {
  id: string;
  tenantId: string;
  name: string;
  protocol: SsoProtocol;
  isEnabled: boolean;
  isDefault: boolean;
  
  // SAML Configuration
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpCertificate?: string;
  
  // OIDC Configuration
  oidcIssuerUrl?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  
  // Domain Enforcement
  enforcedDomains?: string[];
  
  // User Provisioning
  defaultRole: AuthTenantUserRole;
  groupRoleMappings?: Record<string, AuthTenantUserRole>;
  allowJitProvisioning: boolean;
  syncUserAttributes?: string[];
  
  // Usage Stats
  lastUsedAt?: string;
  useCount?: number;
  
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateSsoConnectionRequest {
  tenantId: string;
  name: string;
  protocol: SsoProtocol;
  isEnabled?: boolean;
  isDefault?: boolean;
  
  // SAML-specific
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpCertificate?: string;
  
  // OIDC-specific
  oidcIssuerUrl?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  
  // Domain Enforcement
  enforcedDomains?: string[];
  
  // User Provisioning
  defaultRole?: AuthTenantUserRole;
  groupRoleMappings?: Record<string, AuthTenantUserRole>;
  allowJitProvisioning?: boolean;
  syncUserAttributes?: string[];
}

export interface SsoAttributeMapping {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string;
}

export interface TestSsoConnectionResponse {
  success: boolean;
  provider: string;
  metadataValid?: boolean;
  certificateValid?: boolean;
  certificateExpiresAt?: string;
  endpointsReachable?: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// LITELLM GATEWAY TYPES
// ============================================================================

export interface LiteLLMGatewayConfig {
  id: string;
  
  // ECS Configuration
  minTasks: number;
  maxTasks: number;
  desiredTasks: number;
  taskCpu: number;
  taskMemory: number;
  
  // Auto-scaling
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  targetRequestsPerTarget: number;
  scaleOutCooldownSeconds: number;
  scaleInCooldownSeconds: number;
  
  // Health Check
  healthCheckPath: string;
  healthCheckIntervalSeconds: number;
  healthCheckTimeoutSeconds: number;
  unhealthyThresholdCount: number;
  
  // Load Balancer
  deregistrationDelaySeconds: number;
  idleTimeoutSeconds: number;
  
  // Rate Limiting
  globalRateLimitPerSecond: number;
  perTenantRateLimitPerMinute: number;
  
  // Caching
  enableResponseCaching: boolean;
  cacheTtlSeconds: number;
  
  // Retry
  maxRetries: number;
  retryDelayMs: number;
  
  // Timeouts
  requestTimeoutSeconds: number;
  connectionTimeoutSeconds: number;
  
  updatedAt: string;
  updatedBy: string;
}

export interface LiteLLMGatewayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  runningTasks: number;
  desiredTasks: number;
  healthyTargets: number;
  unhealthyTargets: number;
  cpuUtilization: number;
  memoryUtilization: number;
  requestsPerSecond: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorRate: number;
  lastScaledAt?: string;
  lastScaleReason?: string;
  providers: LiteLLMProviderStatus[];
}

export interface LiteLLMProviderStatus {
  provider: string;
  status: 'available' | 'degraded' | 'unavailable';
  latencyMs: number;
  errorRate: number;
  lastChecked: string;
  models: string[];
}

// ============================================================================
// SYSTEM HEALTH & MONITORING
// ============================================================================

export type SystemComponentType =
  | 'litellm_gateway'
  | 'aurora_postgresql'
  | 'neptune_graph'
  | 'elasticache_redis'
  | 'lambda_chat'
  | 'lambda_ingestion'
  | 'lambda_admin'
  | 'api_gateway'
  | 'cognito_user_pool'
  | 'cognito_admin_pool'
  | 's3_storage'
  | 'sqs_queues';

export interface SystemComponentHealth {
  component: SystemComponentType;
  displayName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  currentCapacity: number;
  maxCapacity: number;
  utilizationPercent: number;
  latencyMs: number;
  errorRate: number;
  lastChecked: string;
  metrics: ComponentMetric[];
}

export interface ComponentMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  thresholdWarning?: number;
  thresholdCritical?: number;
}

export interface SystemHealthDashboard {
  generatedAt: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  components: SystemComponentHealth[];
  activeAlerts: SystemAlert[];
  recentIncidents: SystemIncident[];
  uptimePercent24h: number;
  uptimePercent7d: number;
  uptimePercent30d: number;
}

export interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  component: SystemComponentType;
  metric: string;
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

export interface SystemIncident {
  id: string;
  severity: 'minor' | 'major' | 'critical';
  title: string;
  description: string;
  affectedComponents: SystemComponentType[];
  startedAt: string;
  resolvedAt?: string;
  duration?: number;
  rootCause?: string;
  resolution?: string;
}

// ============================================================================
// CONFIGURATION TYPES (extends existing 032_dynamic_configuration)
// ============================================================================

export type ConfigCategory =
  | 'authentication'
  | 'authorization'
  | 'rate_limiting'
  | 'scaling'
  | 'ai_models'
  | 'cortex'
  | 'features'
  | 'notifications'
  | 'billing'
  | 'security';

export interface SystemConfigMetadata {
  id: string;
  category: ConfigCategory;
  key: string;
  displayName: string;
  description: string;
  valueType: 'string' | 'number' | 'boolean' | 'json' | 'array';
  defaultValue: unknown;
  isSecret: boolean;
  isTenantOverridable: boolean;
  validationRules?: ConfigValidationRules;
  createdAt: string;
}

export interface ConfigValidationRules {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  required?: boolean;
}

export interface SystemConfigValue {
  id: string;
  category: ConfigCategory;
  key: string;
  value: unknown;
  tenantId?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SystemConfigUpdateRequest {
  category: ConfigCategory;
  key: string;
  value: unknown;
  tenantId?: string;
  reason?: string;
}

// ============================================================================
// DEFAULT CONFIGURATION VALUES
// ============================================================================

export const DEFAULT_AUTH_CONFIG = {
  passwordMinLength: 12,
  mfaRequiredTier: 3,
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  apiKeyMaxPerTenant: 50,
  apiKeyDefaultRateLimitPerMinute: 60,
  apiKeyDefaultRateLimitPerDay: 10000,
};

export const DEFAULT_RATE_LIMIT_CONFIG = {
  apiRequestsPerMinute: 60,
  chatRequestsPerMinute: 20,
  tokensPerDay: 100000,
  embeddingsPerMinute: 100,
  fileUploadsPerDay: 50,
};

export const DEFAULT_AI_MODEL_CONFIG = {
  defaultModel: 'gpt-4o',
  maxContextTokens: 128000,
  temperatureDefault: 0.7,
  streamingEnabled: true,
  functionCallingEnabled: true,
};

export const DEFAULT_CORTEX_CONFIG = {
  entranceExamThreshold: 0.8,
  maxTraversalDepth: 3,
  trustScoreWarningThreshold: 0.5,
  ghostVectorTtlMinutes: 60,
  knowledgeGraphEnabled: true,
};

export const DEFAULT_LITELLM_CONFIG: Omit<LiteLLMGatewayConfig, 'id' | 'updatedAt' | 'updatedBy'> = {
  minTasks: 2,
  maxTasks: 50,
  desiredTasks: 2,
  taskCpu: 2048,
  taskMemory: 4096,
  targetCpuUtilization: 70,
  targetMemoryUtilization: 80,
  targetRequestsPerTarget: 1000,
  scaleOutCooldownSeconds: 60,
  scaleInCooldownSeconds: 300,
  healthCheckPath: '/health',
  healthCheckIntervalSeconds: 30,
  healthCheckTimeoutSeconds: 10,
  unhealthyThresholdCount: 3,
  deregistrationDelaySeconds: 30,
  idleTimeoutSeconds: 60,
  globalRateLimitPerSecond: 10000,
  perTenantRateLimitPerMinute: 1000,
  enableResponseCaching: true,
  cacheTtlSeconds: 3600,
  maxRetries: 3,
  retryDelayMs: 1000,
  requestTimeoutSeconds: 600,
  connectionTimeoutSeconds: 30,
};
