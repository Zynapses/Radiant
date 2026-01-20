/**
 * Radiant Admin Simulator - Types
 * v1.0 - Comprehensive TypeScript interfaces for platform administration
 */

// =============================================================================
// Navigation & Views
// =============================================================================

export type AdminViewType = 
  | 'overview'
  | 'tenants'
  | 'models'
  | 'providers'
  | 'billing'
  | 'security'
  | 'infrastructure'
  | 'deployments'
  | 'audit'
  | 'analytics'
  | 'cato'
  | 'consciousness'
  | 'experiments'
  | 'compliance'
  | 'geographic'
  | 'localization';

// =============================================================================
// Tenant Management
// =============================================================================

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'churned';
export type TenantTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  tier: TenantTier;
  createdAt: string;
  userCount: number;
  monthlySpend: number;
  apiCallsThisMonth: number;
  primaryContact: string;
  region: string;
  features: string[];
}

export interface TenantStats {
  totalTenants: number;
  activeToday: number;
  trialConversions: number;
  churnRate: number;
  avgRevenuePerTenant: number;
  totalMRR: number;
}

// =============================================================================
// Model Management
// =============================================================================

export type ModelStatus = 'active' | 'deprecated' | 'beta' | 'disabled';
export type ModelType = 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'multimodal';

export interface Model {
  id: string;
  name: string;
  provider: string;
  type: ModelType;
  status: ModelStatus;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgLatencyMs: number;
  qualityScore: number;
  isEnabled: boolean;
  supportsFunctions: boolean;
  supportsVision: boolean;
  maxOutputTokens: number;
}

export interface ModelStats {
  totalModels: number;
  activeModels: number;
  totalInvocations: number;
  avgCostPerRequest: number;
  topModelByUsage: string;
  topModelByRevenue: string;
}

// =============================================================================
// Provider Management
// =============================================================================

export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'maintenance';

export interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
  apiKeyConfigured: boolean;
  rateLimitPerMinute: number;
  currentUsage: number;
  monthlySpend: number;
  models: string[];
  lastHealthCheck: string;
  avgLatencyMs: number;
  errorRate: number;
}

export interface ProviderStats {
  totalProviders: number;
  healthyProviders: number;
  totalSpendThisMonth: number;
  avgErrorRate: number;
}

// =============================================================================
// Billing & Revenue
// =============================================================================

export type BillingCycle = 'monthly' | 'annual';
export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'failed';

export interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidDate?: string;
  items: { description: string; amount: number }[];
}

export interface BillingStats {
  totalRevenue: number;
  mrr: number;
  arr: number;
  avgRevenuePerUser: number;
  pendingInvoices: number;
  overdueAmount: number;
  revenueGrowth: number;
}

export interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  includedCredits: number;
  features: string[];
  isPopular: boolean;
}

// =============================================================================
// Security
// =============================================================================

export type SecurityEventType = 'login' | 'logout' | 'failed_login' | 'api_key_created' | 'permission_change' | 'suspicious_activity';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  userId?: string;
  tenantId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityConfig {
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  ipWhitelist: string[];
  apiKeyRotationDays: number;
  auditLogRetentionDays: number;
}

export interface SecurityStats {
  activeSecurityAlerts: number;
  failedLoginsToday: number;
  suspiciousActivities: number;
  mfaAdoptionRate: number;
  avgSessionDuration: number;
}

// =============================================================================
// Infrastructure
// =============================================================================

export type ServiceStatus = 'running' | 'stopped' | 'error' | 'scaling';

export interface InfraService {
  id: string;
  name: string;
  type: 'lambda' | 'ecs' | 'rds' | 'elasticache' | 's3' | 'cloudfront' | 'api-gateway';
  status: ServiceStatus;
  region: string;
  instanceCount?: number;
  cpuUtilization?: number;
  memoryUtilization?: number;
  costPerHour: number;
  lastDeployment?: string;
}

export interface InfraStats {
  totalServices: number;
  healthyServices: number;
  monthlyInfraCost: number;
  avgCpuUtilization: number;
  avgMemoryUtilization: number;
  totalLambdaInvocations: number;
}

// =============================================================================
// Deployments
// =============================================================================

export type DeploymentStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';

export interface Deployment {
  id: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  status: DeploymentStatus;
  startedAt: string;
  completedAt?: string;
  deployedBy: string;
  changes: string[];
  rollbackAvailable: boolean;
}

export interface DeploymentStats {
  totalDeployments: number;
  successRate: number;
  avgDeploymentTime: number;
  deploymentsThisWeek: number;
  rollbacksThisMonth: number;
}

// =============================================================================
// Audit Logs
// =============================================================================

export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'admin_action';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  tenantId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: string;
  ipAddress: string;
  success: boolean;
}

export interface AuditStats {
  totalEvents: number;
  eventsToday: number;
  uniqueUsers: number;
  topActions: { action: string; count: number }[];
}

// =============================================================================
// Analytics
// =============================================================================

export interface PlatformMetrics {
  totalApiCalls: number;
  avgResponseTime: number;
  errorRate: number;
  activeUsers: number;
  peakConcurrentUsers: number;
  dataProcessedGB: number;
}

export interface UsageByModel {
  modelId: string;
  modelName: string;
  invocations: number;
  tokensUsed: number;
  cost: number;
  avgLatency: number;
}

export interface UsageByTenant {
  tenantId: string;
  tenantName: string;
  apiCalls: number;
  cost: number;
  activeUsers: number;
}

// =============================================================================
// Cato Safety System
// =============================================================================

export type CatoMood = 'balanced' | 'scout' | 'sage' | 'spark' | 'guide';

export interface CatoConfig {
  defaultMood: CatoMood;
  safetyLayersEnabled: boolean;
  cbfEnforcementMode: 'enforce' | 'monitor' | 'off';
  precisionGovernorEnabled: boolean;
  escalationThreshold: number;
  vetoEnabled: boolean;
}

export interface CatoStats {
  totalSafetyChecks: number;
  cbfViolations: number;
  escalationsToHuman: number;
  recoveryEvents: number;
  avgConfidenceScore: number;
}

// =============================================================================
// Consciousness / AGI Features
// =============================================================================

export interface ConsciousnessConfig {
  ghostMemoryEnabled: boolean;
  brainPlannerEnabled: boolean;
  metacognitionEnabled: boolean;
  empiricismEnabled: boolean;
  formalReasoningEnabled: boolean;
  maxMemoryItems: number;
  memoryRetentionDays: number;
}

export interface ConsciousnessStats {
  totalMemoryItems: number;
  brainPlansGenerated: number;
  metacognitionEvents: number;
  avgRetrievalConfidence: number;
}

// =============================================================================
// A/B Experiments
// =============================================================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  startDate?: string;
  endDate?: string;
  variants: { id: string; name: string; weight: number }[];
  metric: string;
  currentWinner?: string;
  participantCount: number;
  confidence: number;
}

export interface ExperimentStats {
  totalExperiments: number;
  activeExperiments: number;
  completedExperiments: number;
  avgLift: number;
}

// =============================================================================
// Compliance
// =============================================================================

export type ComplianceFramework = 'SOC2' | 'HIPAA' | 'GDPR' | 'CCPA' | 'ISO27001';

export interface ComplianceStatus {
  framework: ComplianceFramework;
  status: 'compliant' | 'in_progress' | 'non_compliant' | 'not_applicable';
  lastAudit?: string;
  nextAudit?: string;
  issues: number;
}

export interface ComplianceStats {
  frameworksCovered: number;
  openIssues: number;
  lastAuditDate: string;
  overallScore: number;
}

// =============================================================================
// Geographic / Region Management
// =============================================================================

export interface Region {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive' | 'coming_soon';
  dataResidency: boolean;
  latencyMs: number;
  tenantCount: number;
  services: string[];
}

export interface GeographicStats {
  totalRegions: number;
  activeRegions: number;
  tenantsWithDataResidency: number;
  avgGlobalLatency: number;
}

// =============================================================================
// Localization
// =============================================================================

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
  translationProgress: number;
  isEnabled: boolean;
}

export interface LocalizationStats {
  totalLanguages: number;
  enabledLanguages: number;
  totalStrings: number;
  avgTranslationProgress: number;
}
