// RADIANT v4.18.0 - Security Types
// Type definitions for security monitoring and anomaly detection

export type AnomalyType = 
  | 'geographic'
  | 'session_hijack'
  | 'brute_force'
  | 'rate_limit'
  | 'credential_stuffing';

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityAnomaly {
  id: string;
  tenantId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  userId: string | null;
  ipAddress: string;
  details: Record<string, unknown>;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  detectedAt: Date;
}

export interface SecurityMetrics {
  totalAnomalies24h: number;
  criticalCount: number;
  highCount: number;
  blockedIps: number;
  suspiciousLogins: number;
  activeThreats: number;
}

export interface IpBlocklistEntry {
  id: string;
  tenantId: string | null;
  ipAddress: string;
  reason: string | null;
  blockedBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface AuthEvent {
  id: string;
  tenantId: string;
  userId: string | null;
  email: string | null;
  eventType: AuthEventType;
  ipAddress: string | null;
  userAgent: string | null;
  geoLocation: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type AuthEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset'
  | 'mfa_enabled'
  | 'mfa_disabled';

export interface SecurityComplianceFinding {
  id: string;
  severity: AnomalySeverity;
  category: string;
  description: string;
  recommendation: string;
  status: 'open' | 'in_progress' | 'resolved';
}

export interface SecurityComplianceStats {
  overallScore: number;
  soc2Score: number;
  hipaaScore: number;
  gdprScore: number;
  iso27001Score: number;
  openFindings: number;
  lastAuditDate: Date | null;
}

// ============================================================================
// Security Phase 2-3 Types
// ============================================================================

// Constitutional Classifier Types
export interface HarmCategory {
  categoryCode: string;
  categoryName: string;
  description: string;
  severityLevel: number;
  examples: string[];
}

export interface ClassificationResult {
  isHarmful: boolean;
  confidenceScore: number;
  harmCategories: Array<{ category: string; score: number }>;
  attackType?: string;
  actionTaken: 'allowed' | 'blocked' | 'flagged' | 'modified';
  latencyMs: number;
}

export interface JailbreakPattern {
  id: string;
  patternName: string;
  patternType: string;
  patternRegex?: string;
  examplePrompts: string[];
  severity: number;
  source?: string;
  isActive: boolean;
}

// Behavioral Anomaly Types
export interface UserBaseline {
  tenantId: string;
  userId: string;
  avgRequestsPerHour: number;
  stddevRequestsPerHour: number;
  avgTokensPerRequest: number;
  stddevTokensPerRequest: number;
  typicalHours: Array<{ hour: number; count: number }>;
  typicalDays: Array<{ day: number; count: number }>;
  sessionDurationAvgMinutes: number;
  typicalDomains: string[];
  typicalModels: string[];
  avgPromptLength: number;
  flowDurationAvgMs: number;
  idleTimeBetweenRequestsAvgMs: number;
  sampleCount: number;
  baselineConfidence: number;
}

export interface BehavioralAnomalyEvent {
  id?: string;
  tenantId: string;
  userId?: string;
  anomalyType: string;
  anomalySubtype?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  anomalyScore: number;
  zScore?: number;
  featureName: string;
  observedValue: number;
  expectedValue: number;
  baselineStddev?: number;
  status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
}

// Drift Detection Types
export interface DriftTestResult {
  testType: 'ks_test' | 'psi' | 'chi_squared' | 'embedding_distance';
  metricName: string;
  driftDetected: boolean;
  testStatistic: number;
  pValue?: number;
  thresholdUsed: number;
  referenceSampleCount: number;
  comparisonSampleCount: number;
}

export interface DriftReport {
  modelId: string;
  reportDate: Date;
  overallDriftDetected: boolean;
  tests: DriftTestResult[];
  recommendations: string[];
}

// Prompt Injection Types
export interface InjectionPattern {
  id: string;
  patternName: string;
  patternType: 'direct' | 'indirect' | 'context_ignoring' | 'role_escape' | 'encoding';
  regexPattern?: string;
  keywordPatterns?: string[];
  severity: number;
  description?: string;
  source: string;
}

export interface InjectionDetectionResult {
  injectionDetected: boolean;
  confidenceScore: number;
  injectionType?: string;
  matchedPatterns: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  latencyMs: number;
}

// Hallucination Detection Types
export interface HallucinationCheckResult {
  isHallucinated: boolean;
  confidenceScore: number;
  checkType: string;
  details: {
    selfConsistencyScore?: number;
    groundingScore?: number;
    truthfulQAScore?: number;
  };
  latencyMs: number;
}

// Attack Generation Types
export interface GeneratedAttack {
  id: string;
  prompt: string;
  attackType: string;
  technique: string;
  severity: number;
  source: 'garak' | 'pyrit' | 'tap' | 'pair' | 'autodan' | 'manual';
  metadata?: Record<string, unknown>;
}

export interface AttackCampaignResult {
  campaignId: string;
  technique: string;
  totalGenerated: number;
  successfulAttacks: number;
  averageBypassRate: number;
}

// AutoDAN Types
export interface AutoDANIndividual {
  id: string;
  prompt: string;
  fitness: number;
  generation: number;
  parentIds: string[];
  mutations: string[];
}

export interface AutoDANEvolutionResult {
  bestIndividual: AutoDANIndividual;
  generationsRun: number;
  fitnessHistory: number[];
  successfulAttacks: AutoDANIndividual[];
}

// Alert Types
export interface SecurityAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AlertConfig {
  enabled: boolean;
  channels: {
    slack?: { enabled: boolean; webhookUrl: string; channel?: string };
    email?: { enabled: boolean; recipients: string[] };
    pagerduty?: { enabled: boolean; routingKey: string };
    webhook?: { enabled: boolean; url: string };
  };
  severityFilters: { info: boolean; warning: boolean; critical: boolean };
  cooldownMinutes: number;
}

// Feedback Types
export interface ClassificationFeedback {
  id?: string;
  tenantId: string;
  classificationId: string;
  feedbackType: 'false_positive' | 'false_negative' | 'correct' | 'uncertain';
  correctLabel?: boolean;
  correctCategories?: string[];
  notes?: string;
  submittedBy: string;
  submittedAt?: Date;
}

export interface FeedbackStats {
  totalFeedback: number;
  falsePositives: number;
  falseNegatives: number;
  correct: number;
  uncertain: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  accuracy: number;
}

// Embedding Types
export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
  tokensUsed: number;
  cached: boolean;
  latencyMs: number;
}

// Security Middleware Types
export interface SecurityCheckRequest {
  tenantId: string;
  userId: string;
  prompt: string;
  modelId?: string;
  conversationId?: string;
  requestId?: string;
  context?: string;
}

export interface SecurityCheckResult {
  allowed: boolean;
  blocked: boolean;
  flagged: boolean;
  modified: boolean;
  modifiedPrompt?: string;
  blockReason?: string;
  flagReasons: string[];
  checks: {
    constitutional?: { isHarmful: boolean; confidenceScore: number; attackType?: string; categories: string[] };
    semantic?: { isHarmful: boolean; semanticScore: number; topMatches: Array<{ patternName: string; similarity: number }> };
    anomaly?: { hasAnomaly: boolean; riskScore: number; anomalyTypes: string[] };
    injection?: InjectionDetectionResult;
    inputSanitization?: { containsInjection: boolean; patterns: string[] };
  };
  trustScore?: number;
  latencyMs: number;
}

// Benchmark Types
export interface BenchmarkResult {
  benchmarkName: string;
  modelId: string;
  score: number;
  details: Record<string, unknown>;
  duration: number;
}
