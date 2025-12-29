// RADIANT v4.18.0 - Security Protection Types
// ============================================================================

export interface SecurityProtectionConfig {
  tenantId: string;
  protectionEnabled: boolean;
  
  instructionHierarchy: {
    enabled: boolean;
    delimiterStyle: 'bracketed' | 'xml' | 'markdown';
    systemBoundaryMarker: string;
    userBoundaryMarker: string;
    orchestrationBoundaryMarker: string;
  };
  
  selfReminder: {
    enabled: boolean;
    position: 'end' | 'both' | 'start';
    content: string;
  };
  
  canaryDetection: {
    enabled: boolean;
    tokenFormat: 'uuid_prefix' | 'random_hex' | 'custom';
    actionOnDetection: 'log_only' | 'log_and_alert' | 'block_response';
    alertWebhookUrl?: string;
  };
  
  inputSanitization: {
    enabled: boolean;
    detectBase64Encoding: boolean;
    detectUnicodeTricks: boolean;
    action: 'log_only' | 'decode_inspect' | 'block';
  };
  
  thompsonSampling: {
    enabled: boolean;
    priorAlpha: number;
    priorBeta: number;
    explorationBonusExploring: number;
    explorationBonusLearning: number;
    explorationBonusConfident: number;
  };
  
  shrinkageEstimators: {
    enabled: boolean;
    priorMean: number;
    priorStrength: number;
  };
  
  temporalDecay: {
    enabled: boolean;
    halfLifeDays: number;
  };
  
  minSampleThreshold: {
    enabled: boolean;
    minObservationsExploring: number;
    minObservationsLearning: number;
    minObservationsConfident: number;
    confidenceThreshold: number;
  };
  
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeoutSeconds: number;
    halfOpenMaxCalls: number;
  };
  
  ensembleConsensus: {
    enabled: boolean;
    minAgreementThreshold: number;
    minModels: number;
    actionOnLow: 'flag_uncertainty' | 'request_more' | 'use_highest_confidence';
  };
  
  outputSanitization: {
    enabled: boolean;
    sanitizePii: boolean;
    sanitizeSystemPrompts: boolean;
    sanitizeCanaryTokens: boolean;
    piiRedactionMode: 'mask' | 'remove' | 'placeholder';
  };
  
  costSoftLimits: {
    enabled: boolean;
    thresholdElevatedCents: number;
    thresholdHighCents: number;
    thresholdCriticalCents: number;
    degradationActionElevated: string;
    degradationActionHigh: string;
    degradationActionCritical: string;
  };
  
  trustScoring: {
    enabled: boolean;
    weightAccountAge: number;
    weightPaymentHistory: number;
    weightUsagePatterns: number;
    weightViolationHistory: number;
    decayRateDays: number;
    newAccountGracePeriodDays: number;
    lowThreshold: number;
    highThreshold: number;
  };
  
  auditLogging: {
    enabled: boolean;
    logRequests: boolean;
    logRoutingDecisions: boolean;
    logModelResponses: boolean;
    logSecurityEvents: boolean;
    retentionDays: number;
  };
}

export interface ModelSecurityPolicy {
  tenantId: string;
  modelId: string;
  policyEnabled: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  contentFilterLevel: 'none' | 'light' | 'standard' | 'strict';
  maxTokensPerRequest: number;
  maxRequestsPerMinute: number;
  piiHandling: 'allow' | 'redact' | 'block';
  canAccessInternet: boolean;
  canExecuteCode: boolean;
  canAccessFiles: boolean;
  auditLevel: 'minimal' | 'standard' | 'full' | 'debug';
}

export interface ThompsonSamplingState {
  tenantId: string;
  domainId: string;
  modelId: string;
  alpha: number;
  beta: number;
  totalObservations: number;
  successfulObservations: number;
  lastObservationAt?: Date;
  meanPerformance: number;
  uncertainty: number;
}

export interface CircuitBreakerState {
  tenantId: string;
  modelId: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  openedAt?: Date;
}

export interface AccountTrustScore {
  tenantId: string;
  userId: string;
  overallScore: number;
  accountAgeScore: number;
  paymentHistoryScore: number;
  usagePatternScore: number;
  violationHistoryScore: number;
  totalRequests: number;
  flaggedRequests: number;
  violationsCount: number;
  lastViolationAt?: Date;
}

export type ConfidenceLevel = 'exploring' | 'learning' | 'confident' | 'established';

export interface SecurityEvent {
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  eventSource: string;
  modelId?: string;
  requestId?: string;
  details: Record<string, unknown>;
  actionTaken?: string;
  actionDetails?: Record<string, unknown>;
}

// Industry provider labels for UI
export const PROTECTION_METHOD_LABELS: Record<string, { provider: string; description: string; uxImpact: 'invisible' | 'minimal' | 'negative' }> = {
  instructionHierarchy: { provider: 'OWASP LLM01', description: 'Instruction hierarchy with delimiters', uxImpact: 'invisible' },
  selfReminder: { provider: 'Anthropic HHH', description: 'Self-reminder technique for jailbreak prevention', uxImpact: 'invisible' },
  canaryDetection: { provider: 'Google TAG', description: 'Canary token detection for prompt extraction', uxImpact: 'invisible' },
  inputSanitization: { provider: 'OWASP', description: 'Input sanitization and encoding detection', uxImpact: 'minimal' },
  thompsonSampling: { provider: 'Netflix MAB', description: 'Thompson sampling for model selection', uxImpact: 'invisible' },
  shrinkageEstimators: { provider: 'James-Stein', description: 'Shrinkage estimators for cold start', uxImpact: 'invisible' },
  temporalDecay: { provider: 'LinkedIn EWMA', description: 'Temporal decay for stale data', uxImpact: 'invisible' },
  minSampleThreshold: { provider: 'A/B Testing Standard', description: 'Minimum sample thresholds', uxImpact: 'invisible' },
  circuitBreaker: { provider: 'Netflix Hystrix', description: 'Circuit breaker for model failures', uxImpact: 'invisible' },
  ensembleConsensus: { provider: 'OpenAI Evals', description: 'Ensemble consensus checking', uxImpact: 'minimal' },
  outputSanitization: { provider: 'HIPAA Safe Harbor', description: 'Output sanitization for PII', uxImpact: 'invisible' },
  costSoftLimits: { provider: 'Thermal Throttling', description: 'Cost-based soft limits', uxImpact: 'minimal' },
  trustScoring: { provider: 'Stripe Radar', description: 'Account trust scoring', uxImpact: 'invisible' },
  auditLogging: { provider: 'SOC 2', description: 'Comprehensive audit logging', uxImpact: 'invisible' },
};
