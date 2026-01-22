/**
 * RADIANT v5.43.0 - Decision Intelligence Artifact Types
 * 
 * Type definitions for the DIA Engine - Glass Box Decision Records
 */

// ============================================================================
// Core Artifact Types
// ============================================================================

export interface DecisionArtifact {
  id: string;
  conversationId: string;
  userId: string;
  tenantId: string;
  title: string;
  summary?: string;
  status: ArtifactStatus;
  version: number;
  parentArtifactId?: string;
  artifactContent: DecisionArtifactContent;
  minerModel?: string;
  extractionConfidence?: number;
  extractionTimestamp: string;
  lastValidatedAt?: string;
  validationStatus: ValidationStatus;
  stalenessThresholdDays: number;
  heatmapData: HeatmapSegment[];
  complianceFrameworks: string[];
  phiDetected: boolean;
  piiDetected: boolean;
  dataClassification: DataClassification;
  primaryDomain?: string;
  secondaryDomains: string[];
  createdAt: string;
  updatedAt: string;
  frozenAt?: string;
  frozenBy?: string;
  contentHash?: string;
  signatureTimestamp?: string;
}

export type ArtifactStatus = 'active' | 'frozen' | 'archived' | 'invalidated';
export type ValidationStatus = 'fresh' | 'stale' | 'verified' | 'invalidated';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

// ============================================================================
// Artifact Content (JSONB Schema)
// ============================================================================

export interface DecisionArtifactContent {
  schema_version: '2.0';
  claims: Claim[];
  dissent_events: DissentEvent[];
  rejected_alternatives: RejectedAlternative[];
  volatile_queries: VolatileQuery[];
  executable_actions: ExecutableAction[];
  compliance: ComplianceMetadata;
  metrics: ArtifactMetrics;
  heatmap_segments: HeatmapSegment[];
}

// ============================================================================
// Claims
// ============================================================================

export interface Claim {
  claim_id: string;
  text: string;
  claim_type: ClaimType;
  supporting_evidence: EvidenceLink[];
  verification_status: DIAVerificationStatus;
  confidence_score: number;
  volatility_score: number;
  risk_score: number;
  primary_model: string;
  contributing_models: string[];
  document_position: DocumentPosition;
  source_message_ids: string[];
  text_spans: TextSpan[];
  is_stale: boolean;
  staleness_age_hours?: number;
  contains_phi: boolean;
  contains_pii: boolean;
  sensitivity_level: SensitivityLevel;
}

export type ClaimType = 
  | 'conclusion' 
  | 'finding' 
  | 'recommendation' 
  | 'warning' 
  | 'fact'
  | 'clinical_finding'
  | 'treatment_recommendation'
  | 'risk_assessment'
  | 'investment_recommendation'
  | 'legal_opinion'
  | 'compliance_finding'
  | 'hypothesis'
  | 'evidence_summary';

export type DIAVerificationStatus = 'verified' | 'unverified' | 'contested';
export type SensitivityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DocumentPosition {
  start_fraction: number;
  end_fraction: number;
}

export interface TextSpan {
  start: number;
  end: number;
  message_id: string;
}

// ============================================================================
// Evidence
// ============================================================================

export interface EvidenceLink {
  evidence_id: string;
  evidence_type: EvidenceType;
  tool_call_id?: string;
  message_id?: string;
  evidence_snapshot: EvidenceSnapshot;
  is_volatile: boolean;
  volatility_category?: VolatilityCategory;
}

export type EvidenceType = 
  | 'tool_call' 
  | 'web_search' 
  | 'document' 
  | 'calculation' 
  | 'model_consensus';

export type VolatilityCategory = 'real-time' | 'daily' | 'weekly' | 'stable';

export interface EvidenceSnapshot {
  tool_name?: string;
  input_summary?: string;
  output_summary?: string;
  raw_output?: unknown;
  timestamp: string;
}

// ============================================================================
// Dissent & Alternatives
// ============================================================================

export interface DissentEvent {
  dissent_id: string;
  contested_claim_id?: string;
  contested_position: string;
  dissenting_model: string;
  dissent_reason: string;
  dissent_severity: DissentSeverity;
  resolution: DissentResolution;
  resolution_reason?: string;
  overruled_by?: string;
  source_message_id: string;
  reasoning_trace_excerpt?: string;
  is_primary_dissent: boolean;
  ghost_path_data?: GhostPathData;
}

export type DissentSeverity = 'minor' | 'moderate' | 'significant';
export type DissentResolution = 'overruled' | 'incorporated' | 'tabled' | 'unresolved';

export interface GhostPathData {
  branch_point_position: number;
  alternate_outcome: string;
  risk_prediction?: string;
}

export interface RejectedAlternative {
  alternative_id: string;
  description: string;
  proposed_by: string;
  rejection_reason: string;
  rejection_category: RejectionCategory;
  related_dissent_id?: string;
  is_primary_alternative: boolean;
}

export type RejectionCategory = 'risk' | 'cost' | 'feasibility' | 'compliance' | 'data';

// ============================================================================
// Volatile Queries
// ============================================================================

export interface VolatileQuery {
  query_id: string;
  tool_name: string;
  original_query: unknown;
  original_result_hash: string;
  last_verified_at: string;
  dependent_claim_ids: string[];
  staleness_threshold_hours: number;
  volatility_category: VolatilityCategory;
}

// ============================================================================
// Executable Actions
// ============================================================================

export interface ExecutableAction {
  action_id: string;
  label: string;
  description: string;
  action_type: ActionType;
  signed_token: string;
  token_expires_at: string;
  action_payload: unknown;
  requires_confirmation: boolean;
  confirmation_message?: string;
  dry_run_preview?: string;
}

export type ActionType = 
  | 'radiant_macro' 
  | 'tool_call' 
  | 'external_link' 
  | 'new_conversation';

// ============================================================================
// Compliance
// ============================================================================

export interface ComplianceMetadata {
  frameworks_applicable: string[];
  hipaa?: HIPAACompliance;
  soc2?: SOC2Compliance;
  gdpr?: GDPRCompliance;
  audit_entries: DIAAuditEntry[];
}

export interface HIPAACompliance {
  phi_present: boolean;
  phi_categories: string[];
  minimum_necessary_applied: boolean;
  access_logged: boolean;
}

export interface SOC2Compliance {
  controls_referenced: string[];
  evidence_chain_complete: boolean;
  change_management_documented: boolean;
}

export interface GDPRCompliance {
  pii_present: boolean;
  lawful_basis: string;
  data_subject_rights_applicable: boolean;
}

export interface DIAAuditEntry {
  timestamp: string;
  action: AuditAction;
  actor_id: string;
  actor_type: ActorType;
  details: string;
  ip_address?: string;
}

export type AuditAction = 
  | 'created' 
  | 'accessed' 
  | 'exported' 
  | 'validated' 
  | 'frozen' 
  | 'shared';

export type ActorType = 'user' | 'system' | 'api';

// ============================================================================
// Metrics
// ============================================================================

export interface ArtifactMetrics {
  total_claims: number;
  verified_claims: number;
  unverified_claims: number;
  contested_claims: number;
  total_evidence_links: number;
  dissent_events_count: number;
  rejected_alternatives_count: number;
  volatile_data_points: number;
  overall_confidence: number;
  overall_volatility: number;
  overall_risk: number;
  models_involved: string[];
  orchestration_methods_used: string[];
  primary_domains: string[];
  extraction_quality: ExtractionQuality;
}

export interface ExtractionQuality {
  fact_coverage: number;
  dissent_capture: number;
  volatility_detection: number;
}

// ============================================================================
// Heatmap
// ============================================================================

export interface HeatmapSegment {
  start_position: number;
  end_position: number;
  segment_type: HeatmapSegmentType;
  intensity: number;
  claim_ids: string[];
}

export type HeatmapSegmentType = 'verified' | 'unverified' | 'contested' | 'stale';

// ============================================================================
// UI State Types
// ============================================================================

export type DIALens = 'read' | 'xray' | 'risk' | 'compliance';

export interface DIAViewState {
  activeLens: DIALens;
  scrollPosition: number;
  expandedClaimIds: string[];
  hoveredClaimId?: string;
  hoveredDissentId?: string;
  isValidating: boolean;
  validationProgress: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface GenerateArtifactRequest {
  conversationId: string;
  title?: string;
  templateId?: string;
}

export interface GenerateArtifactResponse {
  artifact: DecisionArtifact;
}

export interface ListArtifactsRequest {
  limit?: number;
  offset?: number;
  status?: ArtifactStatus;
  conversationId?: string;
}

export interface ListArtifactsResponse {
  artifacts: DecisionArtifactSummary[];
  total: number;
  hasMore: boolean;
}

export interface DecisionArtifactSummary {
  id: string;
  conversationId: string;
  title: string;
  status: ArtifactStatus;
  validationStatus: ValidationStatus;
  version: number;
  claimCount: number;
  dissentCount: number;
  overallConfidence: number;
  phiDetected: boolean;
  piiDetected: boolean;
  primaryDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidateArtifactRequest {
  queryIds?: string[];
}

export interface ValidateArtifactResponse {
  artifactId: string;
  queriesValidated: number;
  unchanged: number;
  changed: number;
  errors: number;
  totalCostCents: number;
  details: QueryValidationResult[];
  newValidationStatus: ValidationStatus;
}

export interface QueryValidationResult {
  queryId: string;
  status: 'unchanged' | 'changed' | 'error' | 'unavailable';
  newResultHash?: string;
  significance?: 'none' | 'minor' | 'moderate' | 'significant' | 'critical';
  costCents: number;
  error?: string;
}

export interface ExportArtifactRequest {
  format: DIAExportFormat;
  redactPhi?: boolean;
  recipientDescription?: string;
  purpose?: string;
}

export type DIAExportFormat = 
  | 'pdf' 
  | 'json' 
  | 'hipaa_audit' 
  | 'soc2_evidence' 
  | 'gdpr_dsar';

export interface ExportArtifactResponse {
  downloadUrl: string;
  format: DIAExportFormat;
  expiresAt: string;
  fileSize: number;
  exportId: string;
}

export interface StalenessReport {
  isStale: boolean;
  staleQueries: VolatileQuery[];
  freshQueries: VolatileQuery[];
  totalVolatile: number;
  oldestStaleAgeHours?: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DIAConfig {
  id: string;
  tenantId: string;
  diaEnabled: boolean;
  autoGenerateEnabled: boolean;
  phiDetectionEnabled: boolean;
  piiDetectionEnabled: boolean;
  defaultStalenessThresholdDays: number;
  maxArtifactsPerUser: number;
  maxClaimsPerArtifact: number;
  requiredComplianceFrameworks: string[];
  autoRedactPhiOnExport: boolean;
  auditAllAccess: boolean;
  extractionModel: string;
  maxExtractionTokens: number;
  exportRetentionDays: number;
  allowedExportFormats: DIAExportFormat[];
}

export interface DIATemplate {
  id: string;
  tenantId?: string;
  name: string;
  description?: string;
  category: string;
  extractionPrompt?: string;
  claimTypes: ClaimType[];
  requiredEvidenceTypes: EvidenceType[];
  defaultLens: DIALens;
  showGhostPaths: boolean;
  showHeatmap: boolean;
  complianceFrameworks: string[];
  sensitivityLevel: SensitivityLevel;
  isSystem: boolean;
  isActive: boolean;
  usageCount: number;
}

// ============================================================================
// Admin Dashboard Types
// ============================================================================

export interface DIADashboardMetrics {
  totalArtifacts: number;
  activeArtifacts: number;
  frozenArtifacts: number;
  averageConfidence: number;
  artifactsWithPhi: number;
  artifactsWithPii: number;
  validationCostMtd: number;
  staleArtifacts: number;
  topDomains: Array<{ domain: string; count: number }>;
  complianceFrameworkUsage: Array<{ framework: string; count: number }>;
  artifactsByDay: Array<{ date: string; count: number }>;
  validationActivity: Array<{ date: string; validations: number; cost: number }>;
}

export interface DIAComplianceReport {
  reportType: 'phi_inventory' | 'soc2_evidence' | 'export_audit' | 'access_audit';
  generatedAt: string;
  tenantId: string;
  dateRange: { start: string; end: string };
  data: unknown;
}
