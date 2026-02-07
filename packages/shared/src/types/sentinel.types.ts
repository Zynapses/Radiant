/**
 * RADIANT v4.18.0 - SENTINEL System Types
 *
 * Alerting, Monitoring & Incident Response System.
 * SENTINEL = Service Engineering Notification, Triage, Incident Navigation,
 *            Escalation & Lifecycle
 *
 * Design constraints (ratified v1.0.0):
 *   1. Do Not Build Telephony — PagerDuty handles on-call/escalation.
 *   2. Shadow Mode First — 14-day log-only before enabling auto-remediation.
 *   3. Push, Don't Poll — CloudWatch Alarms push to SENTINEL via SNS.
 */

// ---------------------------------------------------------------------------
// Enums & Literals
// ---------------------------------------------------------------------------

export type SentinelSeverity = 1 | 2 | 3 | 4 | 5;

export const SENTINEL_SEVERITY_LABELS: Record<SentinelSeverity, string> = {
  1: 'Critical',
  2: 'Major',
  3: 'Moderate',
  4: 'Low',
  5: 'Informational',
};

export type SentinelAlertCategory =
  | 'infrastructure'
  | 'security'
  | 'compliance'
  | 'application'
  | 'ai_model'
  | 'data'
  | 'billing'
  | 'performance'
  | 'availability'
  | 'tenant';

export const ALL_ALERT_CATEGORIES: SentinelAlertCategory[] = [
  'infrastructure', 'security', 'compliance', 'application', 'ai_model',
  'data', 'billing', 'performance', 'availability', 'tenant',
];

export const ALERT_CATEGORY_LABELS: Record<SentinelAlertCategory, string> = {
  infrastructure: 'Infrastructure',
  security: 'Security',
  compliance: 'Compliance',
  application: 'Application',
  ai_model: 'AI / Model',
  data: 'Data',
  billing: 'Billing',
  performance: 'Performance',
  availability: 'Availability',
  tenant: 'Tenant',
};

export type SentinelAlertStatus =
  | 'firing'
  | 'acknowledged'
  | 'investigating'
  | 'resolved'
  | 'suppressed';

export type SentinelIncidentStatus =
  | 'detected'
  | 'triaged'
  | 'investigating'
  | 'identified'
  | 'mitigating'
  | 'resolved'
  | 'postmortem';

export type SentinelEnvironment = 'production' | 'staging' | 'development';

export type SentinelComplianceContext =
  | 'hipaa'
  | 'gdpr'
  | 'soc2'
  | 'pci_dss'
  | 'fedramp'
  | 'none';

export type SentinelNotificationChannel =
  | 'pagerduty'
  | 'twilio_sms'
  | 'twilio_voice'
  | 'slack'
  | 'email'
  | 'in_app'
  | 'status_page'
  | 'webhook';

export type SentinelRemediationAction =
  | 'lambda_redeploy'
  | 'ecs_task_restart'
  | 'cache_rebuild'
  | 'connection_pool_reset'
  | 'traffic_shift'
  | 'ai_provider_failover'
  | 'queue_drain_to_dlq'
  | 'certificate_renewal'
  | 'disk_cleanup';

export type SentinelRemediationState =
  | 'shadow'       // log-only, not executing
  | 'active'       // executing automatically
  | 'manual';      // requires human approval

export type SentinelRemediationResult =
  | 'success'
  | 'failed'
  | 'partial'
  | 'skipped_cooldown'
  | 'shadow_logged'
  | 'requires_approval';

export type SentinelCircuitBreakerState = 'closed' | 'open' | 'half_open';

export type SentinelTimelineEventType =
  | 'alert_fired'
  | 'escalation'
  | 'acknowledged'
  | 'note'
  | 'status_change'
  | 'remediation_attempted'
  | 'remediation_result'
  | 'evidence_captured'
  | 'resolved'
  | 'postmortem_created';

export type SentinelServiceName =
  | 'think-tank'
  | 'think-tank-admin'
  | 'curator'
  | 'dojo'
  | 'genesis'
  | 'gateway'
  | 'admin-dashboard'
  | 'litellm-proxy'
  | 'log-indexer'
  | 'cato-pipeline'
  | 'billing-metering'
  | 'egress-proxy'
  | 'aurora-postgres'
  | 'elasticache'
  | 'dynamodb'
  | 'api-gateway'
  | 'cognito'
  | 'cloudfront'
  | 's3'
  | 'sqs'
  | 'eventbridge'
  | 'kms'
  | 'ses'
  | 'sns'
  | 'openai'
  | 'anthropic'
  | 'google-gemini'
  | 'aws-bedrock'
  | 'sagemaker'
  | string; // allow custom service names

// ---------------------------------------------------------------------------
// Severity Auto-Classification
// ---------------------------------------------------------------------------

export interface SeverityScoringFactors {
  userImpact: 'none' | 'minor' | 'moderate' | 'significant' | 'total';
  blastRadius: 'single_component' | 'single_tenant' | 'multi_tenant' | 'single_region' | 'all_regions';
  dataRisk: 'none' | 'potential_exposure' | 'confirmed_breach' | 'confirmed_loss';
  complianceTrigger: 'none' | 'audit_gap' | 'control_failure' | 'breach_notification_required';
  durationMinutes: number;
}

export const SEVERITY_FACTOR_WEIGHTS: Record<keyof SeverityScoringFactors, number> = {
  userImpact: 0.30,
  blastRadius: 0.20,
  dataRisk: 0.25,
  complianceTrigger: 0.15,
  durationMinutes: 0.10,
};

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

export interface SentinelAlert {
  alertId: string;                          // ULID
  severity: SentinelSeverity;
  category: SentinelAlertCategory;
  status: SentinelAlertStatus;
  service: SentinelServiceName;
  region: string;
  environment: SentinelEnvironment;
  tenantScope: 'all' | 'multi' | 'single' | 'none';
  affectedTenantIds?: string[];
  complianceContext: SentinelComplianceContext[];

  title: string;
  message: string;
  details: Record<string, unknown>;
  source: 'cloudwatch_alarm' | 'synthetic_canary' | 'semantic_probe' | 'manual' | 'api';

  deduplicationKey: string;
  occurrenceCount: number;
  firstOccurrenceAt: string;               // ISO 8601
  lastOccurrenceAt: string;

  autoRemediationStatus: 'not_applicable' | 'shadow_logged' | 'attempted' | 'succeeded' | 'failed';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;

  incidentId?: string;
  createdAt: string;
  ttl?: number;                             // DynamoDB TTL epoch
}

// ---------------------------------------------------------------------------
// Incident
// ---------------------------------------------------------------------------

export interface SentinelIncident {
  id: string;
  severity: SentinelSeverity;
  status: SentinelIncidentStatus;
  title: string;
  description?: string;
  category: SentinelAlertCategory;
  service: SentinelServiceName;
  region?: string;
  tenantScope: string;
  affectedTenantIds?: string[];
  complianceContext: SentinelComplianceContext[];

  commanderId?: string;                     // Incident Commander (from PagerDuty)
  alertIds: string[];

  acknowledgedAt?: string;
  resolvedAt?: string;
  durationSeconds?: number;
  rootCause?: string;
  resolution?: string;
  postmortemId?: string;

  autoRemediationAttempted: boolean;
  autoRemediationSucceeded: boolean;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Incident Timeline
// ---------------------------------------------------------------------------

export interface SentinelTimelineEvent {
  id: string;
  incidentId: string;
  eventType: SentinelTimelineEventType;
  actor: string;                            // userId or 'system'
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealthCheck {
  serviceId: SentinelServiceName;
  checkType: 'http' | 'synthetic' | 'semantic' | 'cloudwatch' | 'metric';
  status: ServiceHealthStatus;
  lastCheck: string;
  latencyMs?: number;
  consecutiveFailures: number;
  circuitBreakerState: SentinelCircuitBreakerState;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: ServiceHealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: 'ok' | 'slow' | 'down';
    cache: 'ok' | 'slow' | 'down';
    externalDeps: Record<string, 'ok' | 'slow' | 'down'>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}

// ---------------------------------------------------------------------------
// Semantic AI Validators
// ---------------------------------------------------------------------------

export interface SemanticProbeConfig {
  provider: string;
  prompt: string;
  expectedContains?: string;
  expectedNotContains?: string;
  maxLatencyMs: number;
  timeoutMs: number;
}

export interface SemanticProbeResult {
  provider: string;
  passed: boolean;
  responseSnippet?: string;
  latencyMs: number;
  error?: string;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Remediation (with Shadow Mode)
// ---------------------------------------------------------------------------

export interface SentinelRemediationRule {
  id: string;
  action: SentinelRemediationAction;
  targetService: SentinelServiceName;
  state: SentinelRemediationState;
  triggerCondition: string;
  cooldownMinutes: number;
  maxRetries: number;
  shadowModeStartedAt?: string;
  shadowModePromotedAt?: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SentinelRemediationEvent {
  id: string;
  alertId: string;
  incidentId?: string;
  ruleId: string;
  action: SentinelRemediationAction;
  targetService: SentinelServiceName;
  triggerReason: string;
  result: SentinelRemediationResult;
  details?: Record<string, unknown>;
  approvedBy?: string;
  startedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Evidence Locker (WORM compliance)
// ---------------------------------------------------------------------------

export interface SentinelEvidenceSnapshot {
  id: string;
  incidentId: string;
  s3Bucket: string;
  s3KeyPrefix: string;
  lockExpiry: string;                       // ISO 8601
  checksumSha256: string;
  sources: string[];                        // e.g. ['cloudwatch', 'cloudtrail', 'db_activity']
  windowStart: string;
  windowEnd: string;
  sizeBytes: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Postmortem
// ---------------------------------------------------------------------------

export interface SentinelPostmortemActionItem {
  title: string;
  owner: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed';
}

export interface SentinelPostmortem {
  id: string;
  incidentId: string;
  title: string;
  summary: string;
  rootCause: string;
  impactSummary: string;
  timelineSummary: string;
  whatWentWell: string[];
  whatWentWrong: string[];
  actionItems: SentinelPostmortemActionItem[];
  participants: string[];
  aiDraftedSummary?: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Playbooks
// ---------------------------------------------------------------------------

export interface SentinelPlaybookStep {
  order: number;
  instruction: string;
  automatable: boolean;
  automationCommand?: string;
}

export interface SentinelPlaybook {
  id: string;
  name: string;
  description: string;
  triggerConditions: Record<string, unknown>;
  steps: SentinelPlaybookStep[];
  severityRange: [SentinelSeverity, SentinelSeverity];
  categories: SentinelAlertCategory[];
  lastExecutedAt?: string;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Admin Alert Preferences
// ---------------------------------------------------------------------------

export interface SentinelAlertPreferences {
  userId: string;
  subscribedCategories: SentinelAlertCategory[];
  subscribedServices: SentinelServiceName[];
  minimumSeverity: SentinelSeverity;

  channels: {
    phone?: string;
    sms?: string;
    email: string;
    slackId?: string;
    pushEnabled: boolean;
  };

  quietHours?: {
    start: string;   // HH:MM
    end: string;     // HH:MM
  };
  timezone: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export interface SentinelNotification {
  id: string;
  alertId: string;
  incidentId?: string;
  channel: SentinelNotificationChannel;
  recipientId: string;
  severity: SentinelSeverity;
  title: string;
  body: string;
  delivered: boolean;
  deliveredAt?: string;
  error?: string;
  pagerdutyIncidentKey?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Heartbeat (Dead Man's Switch)
// ---------------------------------------------------------------------------

export interface SentinelHeartbeat {
  service: string;
  region: string;
  timestamp: string;
  checksCompleted: number;
  alertsActive: number;
  lastNotificationSent?: string;
  notificationPipelineHealthy: boolean;
}

// ---------------------------------------------------------------------------
// Dashboard Aggregates
// ---------------------------------------------------------------------------

export interface SentinelDashboard {
  alertsByCategory: Record<SentinelAlertCategory, number>;
  alertsBySeverity: Record<SentinelSeverity, number>;
  activeIncidents: SentinelIncident[];
  serviceHealthMap: ServiceHealthCheck[];
  recentAlerts: SentinelAlert[];
  metrics: {
    mttdMinutes: number;
    mttaMinutes: number;
    mttrMinutes: number;
    uptimePercent: number;
    totalAlertsLast24h: number;
    totalIncidentsLast24h: number;
    falsePositiveRate: number;
  };
  shadowModeActions: number;
  evidenceSnapshots: number;
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export interface CircuitBreakerConfig {
  service: SentinelServiceName;
  failureThreshold: number;
  failureWindowSeconds: number;
  openDurationSeconds: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerStatus {
  service: SentinelServiceName;
  state: SentinelCircuitBreakerState;
  failureCount: number;
  lastFailureAt?: string;
  openedAt?: string;
  halfOpenAttempts: number;
  nextRetryAt?: string;
}

// ---------------------------------------------------------------------------
// Escalation Matrix Config
// ---------------------------------------------------------------------------

export interface EscalationRule {
  severity: SentinelSeverity;
  primaryChannels: SentinelNotificationChannel[];
  backupChannels: SentinelNotificationChannel[];
  responseTargetMinutes: number;
  escalateAfterMinutes: number;
  escalationChannels: SentinelNotificationChannel[];
  complianceOverrides?: {
    context: SentinelComplianceContext;
    additionalChannels: SentinelNotificationChannel[];
    additionalRecipientRoles: string[];
    deadlineMinutes: number;
  }[];
}

export const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    severity: 1,
    primaryChannels: ['pagerduty', 'twilio_voice', 'twilio_sms'],
    backupChannels: ['twilio_voice'],
    responseTargetMinutes: 5,
    escalateAfterMinutes: 5,
    escalationChannels: ['pagerduty', 'twilio_voice', 'slack'],
    complianceOverrides: [
      {
        context: 'hipaa',
        additionalChannels: ['email', 'twilio_voice'],
        additionalRecipientRoles: ['privacy_officer', 'legal'],
        deadlineMinutes: 15,
      },
      {
        context: 'gdpr',
        additionalChannels: ['email', 'twilio_voice'],
        additionalRecipientRoles: ['dpo', 'legal'],
        deadlineMinutes: 30,
      },
    ],
  },
  {
    severity: 2,
    primaryChannels: ['pagerduty', 'slack'],
    backupChannels: ['slack'],
    responseTargetMinutes: 15,
    escalateAfterMinutes: 15,
    escalationChannels: ['pagerduty', 'twilio_sms'],
  },
  {
    severity: 3,
    primaryChannels: ['slack'],
    backupChannels: ['email'],
    responseTargetMinutes: 60,
    escalateAfterMinutes: 60,
    escalationChannels: ['slack'],
  },
  {
    severity: 4,
    primaryChannels: ['slack'],
    backupChannels: ['email'],
    responseTargetMinutes: 240,
    escalateAfterMinutes: 1440,
    escalationChannels: ['email'],
  },
  {
    severity: 5,
    primaryChannels: ['slack', 'email'],
    backupChannels: [],
    responseTargetMinutes: 480,
    escalateAfterMinutes: 0,
    escalationChannels: [],
  },
];
