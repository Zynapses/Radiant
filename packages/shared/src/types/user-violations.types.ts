/**
 * RADIANT v5.19.0 - User Violation Enforcement Types
 * 
 * Comprehensive system for tracking, escalating, and enforcing
 * regulatory and policy violations by users.
 */

// ============================================================================
// VIOLATION CATEGORIES
// ============================================================================

export type ViolationCategory =
  | 'hipaa'           // HIPAA violations (PHI exposure, unauthorized access)
  | 'gdpr'            // GDPR violations (data handling, consent)
  | 'soc2'            // SOC2 violations (security controls)
  | 'terms_of_service' // ToS violations
  | 'acceptable_use'   // AUP violations
  | 'content_policy'   // Content policy violations
  | 'security'         // Security policy violations
  | 'billing'          // Billing/payment violations
  | 'abuse'            // Platform abuse
  | 'other';

export type UserViolationType =
  // HIPAA-specific
  | 'phi_exposure'
  | 'unauthorized_phi_access'
  | 'phi_sharing'
  | 'audit_log_tampering'
  // GDPR-specific
  | 'consent_violation'
  | 'data_retention_violation'
  | 'cross_border_transfer'
  | 'right_to_erasure_ignored'
  // Security
  | 'credential_sharing'
  | 'api_key_exposure'
  | 'unauthorized_access_attempt'
  | 'rate_limit_abuse'
  | 'injection_attempt'
  // Content
  | 'harmful_content'
  | 'illegal_content'
  | 'harassment'
  | 'spam'
  | 'impersonation'
  // Billing
  | 'payment_fraud'
  | 'chargeback_abuse'
  | 'quota_circumvention'
  // General
  | 'terms_violation'
  | 'policy_violation'
  | 'other';

export type ViolationSeverity = 'warning' | 'minor' | 'major' | 'critical';

export type ViolationStatus = 
  | 'reported'      // Initial report
  | 'investigating' // Under review
  | 'confirmed'     // Violation confirmed
  | 'dismissed'     // False positive
  | 'appealed'      // User appealed
  | 'resolved'      // Action taken, resolved
  | 'escalated';    // Escalated to higher authority

export type EnforcementAction =
  | 'warning_issued'
  | 'feature_restricted'
  | 'rate_limited'
  | 'temporarily_suspended'
  | 'permanently_suspended'
  | 'account_terminated'
  | 'reported_to_authorities'
  | 'no_action';

export type AppealStatus = 
  | 'pending'
  | 'under_review'
  | 'approved'      // Appeal granted, action reversed
  | 'denied'        // Appeal denied
  | 'escalated';    // Escalated for further review

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface UserViolation {
  id: string;
  tenantId: string;
  userId: string;
  
  // Violation details
  category: ViolationCategory;
  type: UserViolationType;
  severity: ViolationSeverity;
  status: ViolationStatus;
  
  // Description
  title: string;
  description: string;
  evidence?: ViolationEvidence[];
  
  // Source
  detectionMethod: 'automated' | 'manual_report' | 'audit' | 'external';
  sourceSystem?: string;
  sourceReferenceId?: string;
  
  // Context
  relatedResourceType?: string;
  relatedResourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  // Enforcement
  actionTaken?: EnforcementAction;
  actionTakenAt?: Date;
  actionTakenBy?: string;
  actionExpiresAt?: Date;
  actionNotes?: string;
  
  // Appeal
  appealId?: string;
  
  // Timestamps
  occurredAt: Date;
  reportedAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViolationEvidence {
  id: string;
  type: 'screenshot' | 'log' | 'document' | 'content_snippet' | 'api_request' | 'other';
  description: string;
  contentRedacted: string;  // Always redacted for storage
  contentHash?: string;     // Hash for integrity
  collectedAt: Date;
  collectedBy?: string;
}

export interface ViolationAppeal {
  id: string;
  violationId: string;
  tenantId: string;
  userId: string;
  
  // Appeal content
  reason: string;
  explanation: string;
  supportingEvidence?: string;
  
  // Status
  status: AppealStatus;
  
  // Review
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  decision?: 'upheld' | 'overturned' | 'reduced';
  
  // Timestamps
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ESCALATION POLICY
// ============================================================================

export interface EscalationPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Thresholds
  rules: EscalationRule[];
  
  // Notification settings
  notifyUserOnViolation: boolean;
  notifyUserOnAction: boolean;
  notifyAdminOnCritical: boolean;
  adminNotificationEmails: string[];
  
  // Time windows
  violationWindowDays: number;  // How far back to count violations
  cooldownPeriodDays: number;   // Time before violations "expire"
  
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationRule {
  id: string;
  order: number;
  
  // Trigger conditions
  triggerType: 'count' | 'severity' | 'category';
  
  // For count-based triggers
  violationCount?: number;
  withinDays?: number;
  
  // For severity-based triggers
  severityThreshold?: ViolationSeverity;
  
  // For category-based triggers
  categories?: ViolationCategory[];
  
  // Action to take
  action: EnforcementAction;
  actionDurationDays?: number;  // For temporary actions
  
  // Additional options
  requiresManualReview: boolean;
  allowAppeal: boolean;
}

// ============================================================================
// USER VIOLATION SUMMARY
// ============================================================================

export interface UserViolationSummary {
  userId: string;
  tenantId: string;
  
  // Counts
  totalViolations: number;
  activeViolations: number;
  resolvedViolations: number;
  
  // By severity
  warningCount: number;
  minorCount: number;
  majorCount: number;
  criticalCount: number;
  
  // By category
  violationsByCategory: Record<ViolationCategory, number>;
  
  // Current status
  currentEnforcementAction?: EnforcementAction;
  enforcementExpiresAt?: Date;
  
  // Risk assessment
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  riskScore: number;
  
  // History
  firstViolationAt?: Date;
  lastViolationAt?: Date;
  lastActionTakenAt?: Date;
  
  // Appeals
  pendingAppeals: number;
  appealSuccessRate?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface UserViolationConfig {
  tenantId: string;
  
  // Feature flags
  enabled: boolean;
  autoDetectionEnabled: boolean;
  autoEnforcementEnabled: boolean;
  
  // Default escalation policy
  defaultEscalationPolicyId?: string;
  
  // Notification settings
  notifyUserOnViolation: boolean;
  notifyUserOnAction: boolean;
  notifyAdminOnCritical: boolean;
  adminNotificationEmails: string[];
  
  // Retention
  retentionDays: number;
  
  // Appeal settings
  allowAppeals: boolean;
  appealWindowDays: number;
  maxAppealsPerViolation: number;
  
  // HIPAA/GDPR specific
  requireEvidenceRedaction: boolean;
  auditAllActions: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ReportViolationRequest {
  userId: string;
  category: ViolationCategory;
  type: UserViolationType;
  severity: ViolationSeverity;
  title: string;
  description: string;
  evidence?: Omit<ViolationEvidence, 'id' | 'collectedAt'>[];
  relatedResourceType?: string;
  relatedResourceId?: string;
  occurredAt?: Date;
}

export interface UpdateViolationRequest {
  status?: ViolationStatus;
  severity?: ViolationSeverity;
  actionTaken?: EnforcementAction;
  actionExpiresAt?: Date;
  actionNotes?: string;
}

export interface SubmitAppealRequest {
  violationId: string;
  reason: string;
  explanation: string;
  supportingEvidence?: string;
}

export interface ReviewAppealRequest {
  decision: 'upheld' | 'overturned' | 'reduced';
  reviewNotes: string;
  newAction?: EnforcementAction;
}

export interface ViolationSearchFilters {
  userId?: string;
  category?: ViolationCategory;
  type?: UserViolationType;
  severity?: ViolationSeverity;
  status?: ViolationStatus;
  dateFrom?: Date;
  dateTo?: Date;
  hasActiveEnforcement?: boolean;
}

export interface ViolationMetrics {
  tenantId: string;
  period: { start: Date; end: Date };
  
  // Totals
  totalViolations: number;
  newViolations: number;
  resolvedViolations: number;
  
  // By category
  byCategory: Record<ViolationCategory, number>;
  
  // By severity
  bySeverity: Record<ViolationSeverity, number>;
  
  // By status
  byStatus: Record<ViolationStatus, number>;
  
  // Actions
  actionsTaken: Record<EnforcementAction, number>;
  
  // Appeals
  totalAppeals: number;
  appealsApproved: number;
  appealsDenied: number;
  
  // Trends
  violationTrend: 'increasing' | 'stable' | 'decreasing';
  averageResolutionTimeHours: number;
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

export interface ViolationNotification {
  type: 'violation_reported' | 'action_taken' | 'appeal_submitted' | 'appeal_decided' | 'action_expired';
  recipientType: 'user' | 'admin';
  recipientEmail: string;
  subject: string;
  body: string;
  violationId: string;
  metadata: Record<string, unknown>;
}

export const VIOLATION_EMAIL_TEMPLATES = {
  violation_reported_user: {
    subject: 'Policy Violation Notice - Action Required',
    template: `Dear {{userName}},

We have detected a potential violation of our {{category}} policy on your account.

**Violation Details:**
- Type: {{violationType}}
- Severity: {{severity}}
- Date: {{occurredAt}}

**Description:**
{{description}}

**Next Steps:**
{{nextSteps}}

If you believe this is an error, you may submit an appeal within {{appealWindowDays}} days.

Regards,
{{companyName}} Trust & Safety Team`,
  },
  
  action_taken_user: {
    subject: 'Account Action Notice - {{actionTaken}}',
    template: `Dear {{userName}},

Following our review of the policy violation reported on {{occurredAt}}, we have taken the following action on your account:

**Action:** {{actionTaken}}
{{#if actionExpiresAt}}
**Duration:** Until {{actionExpiresAt}}
{{/if}}

**Reason:**
{{actionNotes}}

{{#if allowAppeal}}
You may appeal this decision within {{appealWindowDays}} days.
{{/if}}

Regards,
{{companyName}} Trust & Safety Team`,
  },
  
  appeal_decided_user: {
    subject: 'Appeal Decision - {{decision}}',
    template: `Dear {{userName}},

We have reviewed your appeal regarding the policy violation from {{occurredAt}}.

**Decision:** {{decision}}

**Review Notes:**
{{reviewNotes}}

{{#if newAction}}
**Updated Action:** {{newAction}}
{{/if}}

Regards,
{{companyName}} Trust & Safety Team`,
  },
};
