/**
 * Radiant Admin Simulator - Mock Data
 * v1.0 - Comprehensive sample data for platform administration simulation
 */

import type {
  Tenant,
  TenantStats,
  Model,
  ModelStats,
  Provider,
  ProviderStats,
  Invoice,
  BillingStats,
  PricingTier,
  SecurityEvent,
  SecurityConfig,
  SecurityStats,
  InfraService,
  InfraStats,
  Deployment,
  DeploymentStats,
  AuditLog,
  AuditStats,
  PlatformMetrics,
  UsageByModel,
  UsageByTenant,
  CatoConfig,
  CatoStats,
  ConsciousnessConfig,
  ConsciousnessStats,
  Experiment,
  ExperimentStats,
  ComplianceStatus,
  ComplianceStats,
  Region,
  GeographicStats,
  Language,
  LocalizationStats,
} from './types';

// =============================================================================
// Tenants
// =============================================================================

export const MOCK_TENANTS: Tenant[] = [
  {
    id: 'tenant-001',
    name: 'Acme Corporation',
    slug: 'acme',
    status: 'active',
    tier: 'enterprise',
    createdAt: '2025-06-15T10:00:00Z',
    userCount: 250,
    monthlySpend: 12500,
    apiCallsThisMonth: 2500000,
    primaryContact: 'john@acme.com',
    region: 'us-east-1',
    features: ['sso', 'custom-models', 'dedicated-support', 'sla-99.9'],
  },
  {
    id: 'tenant-002',
    name: 'TechStart Inc',
    slug: 'techstart',
    status: 'active',
    tier: 'professional',
    createdAt: '2025-09-01T14:30:00Z',
    userCount: 45,
    monthlySpend: 2400,
    apiCallsThisMonth: 450000,
    primaryContact: 'sarah@techstart.io',
    region: 'us-west-2',
    features: ['api-access', 'analytics'],
  },
  {
    id: 'tenant-003',
    name: 'HealthCare Plus',
    slug: 'healthcare-plus',
    status: 'active',
    tier: 'enterprise',
    createdAt: '2025-03-20T09:00:00Z',
    userCount: 180,
    monthlySpend: 18500,
    apiCallsThisMonth: 1800000,
    primaryContact: 'admin@healthcareplus.com',
    region: 'us-east-1',
    features: ['hipaa', 'sso', 'audit-logs', 'dedicated-support'],
  },
  {
    id: 'tenant-004',
    name: 'Creative Studios',
    slug: 'creative-studios',
    status: 'trial',
    tier: 'starter',
    createdAt: '2026-01-10T11:00:00Z',
    userCount: 8,
    monthlySpend: 0,
    apiCallsThisMonth: 15000,
    primaryContact: 'hello@creativestudios.co',
    region: 'eu-west-1',
    features: [],
  },
  {
    id: 'tenant-005',
    name: 'Global Finance Ltd',
    slug: 'global-finance',
    status: 'active',
    tier: 'custom',
    createdAt: '2024-11-01T08:00:00Z',
    userCount: 500,
    monthlySpend: 45000,
    apiCallsThisMonth: 8500000,
    primaryContact: 'it@globalfinance.com',
    region: 'eu-central-1',
    features: ['sso', 'custom-models', 'dedicated-support', 'sla-99.99', 'data-residency', 'custom-security'],
  },
];

export const MOCK_TENANT_STATS: TenantStats = {
  totalTenants: 247,
  activeToday: 198,
  trialConversions: 0.32,
  churnRate: 0.018,
  avgRevenuePerTenant: 3450,
  totalMRR: 852150,
};

// =============================================================================
// Models
// =============================================================================

export const MOCK_MODELS: Model[] = [
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    type: 'chat',
    status: 'active',
    contextWindow: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1200,
    qualityScore: 9.2,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    type: 'chat',
    status: 'active',
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    avgLatencyMs: 2500,
    qualityScore: 9.5,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    type: 'chat',
    status: 'active',
    contextWindow: 200000,
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    avgLatencyMs: 400,
    qualityScore: 7.8,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    type: 'multimodal',
    status: 'active',
    contextWindow: 128000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1000,
    qualityScore: 9.0,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    type: 'chat',
    status: 'active',
    contextWindow: 128000,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 500,
    qualityScore: 7.5,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'o1',
    name: 'OpenAI o1',
    provider: 'OpenAI',
    type: 'chat',
    status: 'active',
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.060,
    avgLatencyMs: 15000,
    qualityScore: 9.8,
    isEnabled: true,
    supportsFunctions: false,
    supportsVision: true,
    maxOutputTokens: 100000,
  },
  {
    id: 'o1-mini',
    name: 'OpenAI o1-mini',
    provider: 'OpenAI',
    type: 'chat',
    status: 'active',
    contextWindow: 128000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.012,
    avgLatencyMs: 8000,
    qualityScore: 8.5,
    isEnabled: true,
    supportsFunctions: false,
    supportsVision: false,
    maxOutputTokens: 65536,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    type: 'multimodal',
    status: 'active',
    contextWindow: 2000000,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    avgLatencyMs: 1500,
    qualityScore: 8.8,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    type: 'chat',
    status: 'active',
    contextWindow: 1000000,
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    avgLatencyMs: 300,
    qualityScore: 7.2,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: true,
    maxOutputTokens: 8192,
  },
  {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    provider: 'Self-Hosted',
    type: 'chat',
    status: 'active',
    contextWindow: 128000,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.002,
    avgLatencyMs: 2000,
    qualityScore: 8.7,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: false,
    maxOutputTokens: 4096,
  },
  {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B',
    provider: 'Self-Hosted',
    type: 'chat',
    status: 'active',
    contextWindow: 128000,
    inputCostPer1k: 0.00099,
    outputCostPer1k: 0.00099,
    avgLatencyMs: 800,
    qualityScore: 8.0,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: false,
    maxOutputTokens: 4096,
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral',
    type: 'chat',
    status: 'active',
    contextWindow: 128000,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.006,
    avgLatencyMs: 900,
    qualityScore: 8.3,
    isEnabled: true,
    supportsFunctions: true,
    supportsVision: false,
    maxOutputTokens: 8192,
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    provider: 'OpenAI',
    type: 'embedding',
    status: 'active',
    contextWindow: 8191,
    inputCostPer1k: 0.00013,
    outputCostPer1k: 0,
    avgLatencyMs: 100,
    qualityScore: 9.0,
    isEnabled: true,
    supportsFunctions: false,
    supportsVision: false,
    maxOutputTokens: 0,
  },
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    provider: 'OpenAI',
    type: 'image',
    status: 'active',
    contextWindow: 4000,
    inputCostPer1k: 0.04,
    outputCostPer1k: 0,
    avgLatencyMs: 15000,
    qualityScore: 9.2,
    isEnabled: true,
    supportsFunctions: false,
    supportsVision: false,
    maxOutputTokens: 0,
  },
  {
    id: 'whisper-1',
    name: 'Whisper',
    provider: 'OpenAI',
    type: 'audio',
    status: 'active',
    contextWindow: 0,
    inputCostPer1k: 0.006,
    outputCostPer1k: 0,
    avgLatencyMs: 5000,
    qualityScore: 8.8,
    isEnabled: true,
    supportsFunctions: false,
    supportsVision: false,
    maxOutputTokens: 0,
  },
];

export const MOCK_MODEL_STATS: ModelStats = {
  totalModels: 106,
  activeModels: 98,
  totalInvocations: 45678234,
  avgCostPerRequest: 0.0032,
  topModelByUsage: 'GPT-4o Mini',
  topModelByRevenue: 'Claude 3.5 Sonnet',
};

// =============================================================================
// Providers
// =============================================================================

export const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    status: 'healthy',
    apiKeyConfigured: true,
    rateLimitPerMinute: 4000,
    currentUsage: 2340,
    monthlySpend: 125000,
    models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    lastHealthCheck: '2026-01-19T16:00:00Z',
    avgLatencyMs: 1100,
    errorRate: 0.001,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'healthy',
    apiKeyConfigured: true,
    rateLimitPerMinute: 10000,
    currentUsage: 5600,
    monthlySpend: 98000,
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'dall-e-3', 'whisper-1', 'text-embedding-3-large'],
    lastHealthCheck: '2026-01-19T16:00:00Z',
    avgLatencyMs: 850,
    errorRate: 0.002,
  },
  {
    id: 'google',
    name: 'Google AI',
    status: 'healthy',
    apiKeyConfigured: true,
    rateLimitPerMinute: 6000,
    currentUsage: 1890,
    monthlySpend: 45000,
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    lastHealthCheck: '2026-01-19T16:00:00Z',
    avgLatencyMs: 950,
    errorRate: 0.0015,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    status: 'healthy',
    apiKeyConfigured: true,
    rateLimitPerMinute: 2000,
    currentUsage: 450,
    monthlySpend: 12000,
    models: ['mistral-large', 'mistral-medium', 'mistral-small'],
    lastHealthCheck: '2026-01-19T16:00:00Z',
    avgLatencyMs: 700,
    errorRate: 0.001,
  },
  {
    id: 'self-hosted',
    name: 'Self-Hosted (SageMaker)',
    status: 'healthy',
    apiKeyConfigured: true,
    rateLimitPerMinute: 1000,
    currentUsage: 320,
    monthlySpend: 8500,
    models: ['llama-3.1-405b', 'llama-3.1-70b', 'llama-3.1-8b'],
    lastHealthCheck: '2026-01-19T16:00:00Z',
    avgLatencyMs: 1200,
    errorRate: 0.003,
  },
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    status: 'degraded',
    apiKeyConfigured: true,
    rateLimitPerMinute: 3000,
    currentUsage: 890,
    monthlySpend: 32000,
    models: ['claude-3-sonnet-bedrock', 'titan-embed', 'stable-diffusion-xl'],
    lastHealthCheck: '2026-01-19T16:00:00Z',
    avgLatencyMs: 1800,
    errorRate: 0.008,
  },
];

export const MOCK_PROVIDER_STATS: ProviderStats = {
  totalProviders: 8,
  healthyProviders: 7,
  totalSpendThisMonth: 320500,
  avgErrorRate: 0.0025,
};

// =============================================================================
// Billing
// =============================================================================

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    tenantId: 'tenant-001',
    tenantName: 'Acme Corporation',
    amount: 12500,
    status: 'paid',
    dueDate: '2026-01-15',
    paidDate: '2026-01-14',
    items: [
      { description: 'Enterprise Plan', amount: 5000 },
      { description: 'API Usage (2.5M calls)', amount: 7500 },
    ],
  },
  {
    id: 'inv-002',
    tenantId: 'tenant-005',
    tenantName: 'Global Finance Ltd',
    amount: 45000,
    status: 'pending',
    dueDate: '2026-01-25',
    items: [
      { description: 'Custom Enterprise Plan', amount: 15000 },
      { description: 'API Usage (8.5M calls)', amount: 25500 },
      { description: 'Dedicated Support', amount: 4500 },
    ],
  },
  {
    id: 'inv-003',
    tenantId: 'tenant-003',
    tenantName: 'HealthCare Plus',
    amount: 18500,
    status: 'overdue',
    dueDate: '2026-01-10',
    items: [
      { description: 'Enterprise Plan + HIPAA', amount: 8000 },
      { description: 'API Usage (1.8M calls)', amount: 10500 },
    ],
  },
];

export const MOCK_BILLING_STATS: BillingStats = {
  totalRevenue: 8521500,
  mrr: 852150,
  arr: 10225800,
  avgRevenuePerUser: 127,
  pendingInvoices: 45,
  overdueAmount: 89500,
  revenueGrowth: 0.18,
};

export const MOCK_PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    includedCredits: 1000,
    features: ['5 users', 'Basic models', 'Community support'],
    isPopular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 49,
    annualPrice: 470,
    includedCredits: 50000,
    features: ['25 users', 'All models', 'Email support', 'API access'],
    isPopular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 199,
    annualPrice: 1910,
    includedCredits: 250000,
    features: ['100 users', 'All models', 'Priority support', 'Analytics', 'SSO'],
    isPopular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 999,
    annualPrice: 9590,
    includedCredits: 1500000,
    features: ['Unlimited users', 'Custom models', 'Dedicated support', 'SLA 99.9%', 'Audit logs', 'Custom integrations'],
    isPopular: false,
  },
];

// =============================================================================
// Security
// =============================================================================

export const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 'sec-001',
    type: 'failed_login',
    userId: 'user-123',
    tenantId: 'tenant-001',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    timestamp: '2026-01-19T15:30:00Z',
    details: 'Multiple failed login attempts detected',
    severity: 'medium',
  },
  {
    id: 'sec-002',
    type: 'suspicious_activity',
    tenantId: 'tenant-002',
    ipAddress: '10.0.0.50',
    userAgent: 'curl/7.68.0',
    timestamp: '2026-01-19T14:00:00Z',
    details: 'Unusual API access pattern from new IP',
    severity: 'high',
  },
  {
    id: 'sec-003',
    type: 'api_key_created',
    userId: 'user-456',
    tenantId: 'tenant-003',
    ipAddress: '172.16.0.25',
    userAgent: 'Mozilla/5.0...',
    timestamp: '2026-01-19T12:00:00Z',
    details: 'New API key created with full access',
    severity: 'low',
  },
];

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  mfaRequired: true,
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  ipWhitelist: [],
  apiKeyRotationDays: 90,
  auditLogRetentionDays: 365,
};

export const MOCK_SECURITY_STATS: SecurityStats = {
  activeSecurityAlerts: 3,
  failedLoginsToday: 47,
  suspiciousActivities: 2,
  mfaAdoptionRate: 0.78,
  avgSessionDuration: 45,
};

// =============================================================================
// Infrastructure
// =============================================================================

export const MOCK_INFRA_SERVICES: InfraService[] = [
  {
    id: 'api-gateway',
    name: 'API Gateway',
    type: 'api-gateway',
    status: 'running',
    region: 'us-east-1',
    costPerHour: 0.35,
    lastDeployment: '2026-01-18T10:00:00Z',
  },
  {
    id: 'lambda-ai',
    name: 'AI Lambda Functions',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    costPerHour: 2.50,
    lastDeployment: '2026-01-19T08:00:00Z',
  },
  {
    id: 'aurora-primary',
    name: 'Aurora PostgreSQL (Primary)',
    type: 'rds',
    status: 'running',
    region: 'us-east-1',
    instanceCount: 2,
    cpuUtilization: 45,
    memoryUtilization: 62,
    costPerHour: 1.80,
    lastDeployment: '2026-01-01T00:00:00Z',
  },
  {
    id: 'elasticache',
    name: 'ElastiCache Redis',
    type: 'elasticache',
    status: 'running',
    region: 'us-east-1',
    instanceCount: 3,
    cpuUtilization: 25,
    memoryUtilization: 48,
    costPerHour: 0.90,
  },
  {
    id: 's3-storage',
    name: 'S3 Storage',
    type: 's3',
    status: 'running',
    region: 'us-east-1',
    costPerHour: 0.15,
  },
  {
    id: 'cloudfront',
    name: 'CloudFront CDN',
    type: 'cloudfront',
    status: 'running',
    region: 'global',
    costPerHour: 0.45,
  },
  {
    id: 'ecs-workers',
    name: 'ECS Worker Cluster',
    type: 'ecs',
    status: 'scaling',
    region: 'us-east-1',
    instanceCount: 5,
    cpuUtilization: 78,
    memoryUtilization: 65,
    costPerHour: 3.20,
    lastDeployment: '2026-01-19T14:00:00Z',
  },
];

export const MOCK_INFRA_STATS: InfraStats = {
  totalServices: 24,
  healthyServices: 22,
  monthlyInfraCost: 45000,
  avgCpuUtilization: 52,
  avgMemoryUtilization: 58,
  totalLambdaInvocations: 125000000,
};

// =============================================================================
// Deployments
// =============================================================================

export const MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: 'deploy-001',
    version: 'v4.18.0',
    environment: 'production',
    status: 'success',
    startedAt: '2026-01-19T08:00:00Z',
    completedAt: '2026-01-19T08:15:00Z',
    deployedBy: 'admin@radiant.ai',
    changes: ['New billing features', 'Performance improvements', 'Bug fixes'],
    rollbackAvailable: true,
  },
  {
    id: 'deploy-002',
    version: 'v4.18.1-rc1',
    environment: 'staging',
    status: 'in_progress',
    startedAt: '2026-01-19T15:00:00Z',
    deployedBy: 'dev@radiant.ai',
    changes: ['Hotfix for API rate limiting', 'Updated model pricing'],
    rollbackAvailable: false,
  },
  {
    id: 'deploy-003',
    version: 'v4.17.9',
    environment: 'production',
    status: 'rolled_back',
    startedAt: '2026-01-17T10:00:00Z',
    completedAt: '2026-01-17T10:20:00Z',
    deployedBy: 'admin@radiant.ai',
    changes: ['Memory leak fix'],
    rollbackAvailable: false,
  },
];

export const MOCK_DEPLOYMENT_STATS: DeploymentStats = {
  totalDeployments: 347,
  successRate: 0.96,
  avgDeploymentTime: 12,
  deploymentsThisWeek: 8,
  rollbacksThisMonth: 2,
};

// =============================================================================
// Audit Logs
// =============================================================================

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-001',
    timestamp: '2026-01-19T16:30:00Z',
    userId: 'admin-001',
    userName: 'Super Admin',
    action: 'update',
    resource: 'tenant',
    resourceId: 'tenant-001',
    details: 'Updated billing tier from Professional to Enterprise',
    ipAddress: '10.0.0.1',
    success: true,
  },
  {
    id: 'audit-002',
    timestamp: '2026-01-19T15:45:00Z',
    userId: 'admin-002',
    userName: 'Support Admin',
    tenantId: 'tenant-003',
    action: 'admin_action',
    resource: 'api_key',
    resourceId: 'key-123',
    details: 'Regenerated API key for tenant',
    ipAddress: '10.0.0.5',
    success: true,
  },
  {
    id: 'audit-003',
    timestamp: '2026-01-19T14:00:00Z',
    userId: 'user-789',
    userName: 'John Doe',
    tenantId: 'tenant-001',
    action: 'export',
    resource: 'analytics',
    details: 'Exported usage analytics CSV',
    ipAddress: '192.168.1.50',
    success: true,
  },
];

export const MOCK_AUDIT_STATS: AuditStats = {
  totalEvents: 1245678,
  eventsToday: 3456,
  uniqueUsers: 892,
  topActions: [
    { action: 'read', count: 45000 },
    { action: 'update', count: 12000 },
    { action: 'create', count: 8500 },
    { action: 'login', count: 6200 },
    { action: 'delete', count: 1200 },
  ],
};

// =============================================================================
// Analytics
// =============================================================================

export const MOCK_PLATFORM_METRICS: PlatformMetrics = {
  totalApiCalls: 45678234,
  avgResponseTime: 245,
  errorRate: 0.0023,
  activeUsers: 12456,
  peakConcurrentUsers: 3456,
  dataProcessedGB: 1245,
};

export const MOCK_USAGE_BY_MODEL: UsageByModel[] = [
  { modelId: 'gpt-4o-mini', modelName: 'GPT-4o Mini', invocations: 15234567, tokensUsed: 45000000000, cost: 45000, avgLatency: 480 },
  { modelId: 'claude-3-5-sonnet', modelName: 'Claude 3.5 Sonnet', invocations: 8765432, tokensUsed: 32000000000, cost: 125000, avgLatency: 1150 },
  { modelId: 'gpt-4o', modelName: 'GPT-4o', invocations: 5432100, tokensUsed: 18000000000, cost: 85000, avgLatency: 950 },
  { modelId: 'gemini-1.5-flash', modelName: 'Gemini 1.5 Flash', invocations: 4321000, tokensUsed: 12000000000, cost: 8500, avgLatency: 290 },
  { modelId: 'claude-3-haiku', modelName: 'Claude 3 Haiku', invocations: 3210000, tokensUsed: 8000000000, cost: 5200, avgLatency: 380 },
];

export const MOCK_USAGE_BY_TENANT: UsageByTenant[] = [
  { tenantId: 'tenant-005', tenantName: 'Global Finance Ltd', apiCalls: 8500000, cost: 45000, activeUsers: 450 },
  { tenantId: 'tenant-001', tenantName: 'Acme Corporation', apiCalls: 2500000, cost: 12500, activeUsers: 220 },
  { tenantId: 'tenant-003', tenantName: 'HealthCare Plus', apiCalls: 1800000, cost: 18500, activeUsers: 165 },
  { tenantId: 'tenant-002', tenantName: 'TechStart Inc', apiCalls: 450000, cost: 2400, activeUsers: 38 },
];

// =============================================================================
// Cato Safety
// =============================================================================

export const DEFAULT_CATO_CONFIG: CatoConfig = {
  defaultMood: 'balanced',
  safetyLayersEnabled: true,
  cbfEnforcementMode: 'enforce',
  precisionGovernorEnabled: true,
  escalationThreshold: 0.3,
  vetoEnabled: true,
};

export const MOCK_CATO_STATS: CatoStats = {
  totalSafetyChecks: 45678234,
  cbfViolations: 1234,
  escalationsToHuman: 567,
  recoveryEvents: 89,
  avgConfidenceScore: 0.87,
};

// =============================================================================
// Consciousness
// =============================================================================

export const DEFAULT_CONSCIOUSNESS_CONFIG: ConsciousnessConfig = {
  ghostMemoryEnabled: true,
  brainPlannerEnabled: true,
  metacognitionEnabled: true,
  empiricismEnabled: true,
  formalReasoningEnabled: false,
  maxMemoryItems: 1000,
  memoryRetentionDays: 90,
};

export const MOCK_CONSCIOUSNESS_STATS: ConsciousnessStats = {
  totalMemoryItems: 2345678,
  brainPlansGenerated: 456789,
  metacognitionEvents: 123456,
  avgRetrievalConfidence: 0.82,
};

// =============================================================================
// Experiments
// =============================================================================

export const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-001',
    name: 'New Onboarding Flow',
    description: 'Testing simplified onboarding vs current flow',
    status: 'running',
    startDate: '2026-01-10',
    variants: [
      { id: 'control', name: 'Current Flow', weight: 50 },
      { id: 'treatment', name: 'Simplified Flow', weight: 50 },
    ],
    metric: 'onboarding_completion_rate',
    currentWinner: 'treatment',
    participantCount: 2456,
    confidence: 0.92,
  },
  {
    id: 'exp-002',
    name: 'Model Recommendation Algorithm',
    description: 'Testing new AI-powered model recommendations',
    status: 'running',
    startDate: '2026-01-15',
    variants: [
      { id: 'control', name: 'Rule-based', weight: 33 },
      { id: 'ml-v1', name: 'ML v1', weight: 33 },
      { id: 'ml-v2', name: 'ML v2', weight: 34 },
    ],
    metric: 'model_selection_satisfaction',
    participantCount: 1234,
    confidence: 0.67,
  },
  {
    id: 'exp-003',
    name: 'Pricing Page Redesign',
    description: 'A/B test of new pricing page layout',
    status: 'completed',
    startDate: '2025-12-01',
    endDate: '2026-01-05',
    variants: [
      { id: 'control', name: 'Current Design', weight: 50 },
      { id: 'treatment', name: 'New Design', weight: 50 },
    ],
    metric: 'conversion_rate',
    currentWinner: 'treatment',
    participantCount: 8765,
    confidence: 0.98,
  },
];

export const MOCK_EXPERIMENT_STATS: ExperimentStats = {
  totalExperiments: 45,
  activeExperiments: 3,
  completedExperiments: 38,
  avgLift: 0.12,
};

// =============================================================================
// Compliance
// =============================================================================

export const MOCK_COMPLIANCE_STATUS: ComplianceStatus[] = [
  { framework: 'SOC2', status: 'compliant', lastAudit: '2025-11-15', nextAudit: '2026-11-15', issues: 0 },
  { framework: 'HIPAA', status: 'compliant', lastAudit: '2025-10-01', nextAudit: '2026-10-01', issues: 2 },
  { framework: 'GDPR', status: 'compliant', lastAudit: '2025-09-20', nextAudit: '2026-09-20', issues: 1 },
  { framework: 'CCPA', status: 'compliant', lastAudit: '2025-12-01', nextAudit: '2026-12-01', issues: 0 },
  { framework: 'ISO27001', status: 'in_progress', lastAudit: '2025-06-01', nextAudit: '2026-06-01', issues: 5 },
];

export const MOCK_COMPLIANCE_STATS: ComplianceStats = {
  frameworksCovered: 5,
  openIssues: 8,
  lastAuditDate: '2025-12-01',
  overallScore: 94,
};

// =============================================================================
// Geographic
// =============================================================================

export const MOCK_REGIONS: Region[] = [
  { id: 'us-east-1', name: 'US East (N. Virginia)', code: 'us-east-1', status: 'active', dataResidency: true, latencyMs: 45, tenantCount: 145, services: ['api', 'db', 'cache', 'storage'] },
  { id: 'us-west-2', name: 'US West (Oregon)', code: 'us-west-2', status: 'active', dataResidency: true, latencyMs: 65, tenantCount: 67, services: ['api', 'db', 'cache'] },
  { id: 'eu-west-1', name: 'EU (Ireland)', code: 'eu-west-1', status: 'active', dataResidency: true, latencyMs: 120, tenantCount: 89, services: ['api', 'db', 'cache', 'storage'] },
  { id: 'eu-central-1', name: 'EU (Frankfurt)', code: 'eu-central-1', status: 'active', dataResidency: true, latencyMs: 115, tenantCount: 45, services: ['api', 'db'] },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', code: 'ap-southeast-1', status: 'active', dataResidency: true, latencyMs: 180, tenantCount: 23, services: ['api', 'db'] },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', code: 'ap-northeast-1', status: 'coming_soon', dataResidency: false, latencyMs: 200, tenantCount: 0, services: [] },
];

export const MOCK_GEOGRAPHIC_STATS: GeographicStats = {
  totalRegions: 6,
  activeRegions: 5,
  tenantsWithDataResidency: 187,
  avgGlobalLatency: 105,
};

// =============================================================================
// Localization
// =============================================================================

export const MOCK_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', isRTL: false, translationProgress: 100, isEnabled: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', isRTL: false, translationProgress: 98, isEnabled: true },
  { code: 'fr', name: 'French', nativeName: 'Français', isRTL: false, translationProgress: 95, isEnabled: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', isRTL: false, translationProgress: 92, isEnabled: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', isRTL: false, translationProgress: 88, isEnabled: true },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', isRTL: false, translationProgress: 85, isEnabled: true },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', isRTL: false, translationProgress: 78, isEnabled: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRTL: true, translationProgress: 65, isEnabled: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', isRTL: false, translationProgress: 72, isEnabled: true },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', isRTL: false, translationProgress: 70, isEnabled: false },
];

export const MOCK_LOCALIZATION_STATS: LocalizationStats = {
  totalLanguages: 10,
  enabledLanguages: 8,
  totalStrings: 4567,
  avgTranslationProgress: 84,
};

// =============================================================================
// Navigation Items
// =============================================================================

export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { id: 'overview', label: 'Dashboard', icon: 'Activity' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { id: 'tenants', label: 'Tenants', icon: 'Building2', badge: '247' },
      { id: 'models', label: 'Models', icon: 'Cpu', badge: '106' },
      { id: 'providers', label: 'Providers', icon: 'Cloud' },
      { id: 'billing', label: 'Billing', icon: 'CreditCard' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'infrastructure', label: 'Infrastructure', icon: 'Server' },
      { id: 'deployments', label: 'Deployments', icon: 'Rocket' },
      { id: 'security', label: 'Security', icon: 'Shield' },
      { id: 'audit', label: 'Audit Logs', icon: 'ScrollText' },
    ],
  },
  {
    title: 'AI Systems',
    items: [
      { id: 'cato', label: 'Cato Safety', icon: 'Brain' },
      { id: 'consciousness', label: 'Consciousness', icon: 'Sparkles' },
      { id: 'experiments', label: 'Experiments', icon: 'FlaskConical' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { id: 'compliance', label: 'Compliance', icon: 'CheckCircle' },
      { id: 'geographic', label: 'Regions', icon: 'Globe' },
      { id: 'localization', label: 'Localization', icon: 'Languages' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
    ],
  },
];
