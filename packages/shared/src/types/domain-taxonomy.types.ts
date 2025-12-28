/**
 * RADIANT v4.18.0 - Domain Taxonomy Types
 * Hierarchical taxonomy for AI model matching based on prompt domain detection
 * 
 * Structure: Field → Domain → Subspecialty
 * Each level has proficiency scores across 8 dimensions
 */

// ============================================================================
// Proficiency Dimensions (1-10 scale)
// ============================================================================

export interface ProficiencyScores {
  reasoning_depth: number;              // Depth of logical reasoning required
  mathematical_quantitative: number;    // Mathematical/quantitative analysis
  code_generation: number;              // Code writing/debugging capability
  creative_generative: number;          // Creative/generative content
  research_synthesis: number;           // Research and synthesis ability
  factual_recall_precision: number;     // Factual accuracy requirements
  multi_step_problem_solving: number;   // Complex problem decomposition
  domain_terminology_handling: number;  // Domain-specific jargon handling
}

export type ProficiencyDimension = keyof ProficiencyScores;

export const PROFICIENCY_DIMENSIONS: ProficiencyDimension[] = [
  'reasoning_depth',
  'mathematical_quantitative',
  'code_generation',
  'creative_generative',
  'research_synthesis',
  'factual_recall_precision',
  'multi_step_problem_solving',
  'domain_terminology_handling',
];

// ============================================================================
// Terminology Signals for Detection
// ============================================================================

export interface TerminologySignals {
  high_confidence: string[];    // Strong indicators of this subspecialty
  medium_confidence: string[];  // Moderate indicators
  exclusionary: string[];       // Terms that suggest NOT this subspecialty
}

// ============================================================================
// Competency Mappings
// ============================================================================

export interface CompetencyMappings {
  cip_codes: string[];  // Classification of Instructional Programs
  soc_codes: string[];  // Standard Occupational Classification
}

// ============================================================================
// Subspecialty (Leaf Level)
// ============================================================================

export interface Subspecialty {
  subspecialty_id: string;
  subspecialty_name: string;
  description: string;
  parent_domain: string;
  detection_keywords: string[];
  terminology_signals: TerminologySignals;
  certifications: string[];
  competency_mappings: CompetencyMappings;
  subspecialty_proficiencies: ProficiencyScores;
}

// ============================================================================
// Domain (Middle Level)
// ============================================================================

export interface Domain {
  domain_id: string;
  domain_name: string;
  domain_icon: string;
  domain_description: string;
  parent_field: string;
  detection_keywords: string[];
  professional_associations: string[];
  key_journals: string[];
  reference_databases: string[];
  domain_proficiencies: ProficiencyScores;
  subspecialties: Subspecialty[];
}

// ============================================================================
// Field (Top Level)
// ============================================================================

export interface Field {
  field_id: string;
  field_name: string;
  field_icon: string;
  field_color: string;
  field_description: string;
  field_proficiencies: ProficiencyScores;
  domains: Domain[];
}

// ============================================================================
// Taxonomy Metadata
// ============================================================================

export interface TaxonomyMetadata {
  version: string;
  generated_at: string;
  total_fields: number;
  total_domains: number;
  total_subspecialties: number;
  proficiency_scale: {
    min: number;
    max: number;
    description: string;
  };
  proficiency_dimensions: ProficiencyDimension[];
}

// ============================================================================
// Complete Taxonomy Structure
// ============================================================================

export interface DomainTaxonomy {
  metadata: TaxonomyMetadata;
  fields: Field[];
}

// ============================================================================
// Domain Detection Results
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DetectedSubspecialty {
  subspecialty: Subspecialty;
  confidence: number;
  confidence_level: ConfidenceLevel;
  matched_keywords: string[];
  matched_signals: string[];
}

export interface DetectedDomain {
  domain: Domain;
  confidence: number;
  confidence_level: ConfidenceLevel;
  matched_keywords: string[];
  detected_subspecialties: DetectedSubspecialty[];
}

export interface DetectedField {
  field: Field;
  confidence: number;
  confidence_level: ConfidenceLevel;
  detected_domains: DetectedDomain[];
}

export interface DomainDetectionResult {
  detected_fields: DetectedField[];
  primary_field?: Field;
  primary_domain?: Domain;
  primary_subspecialty?: Subspecialty;
  merged_proficiencies: ProficiencyScores;
  detection_method: 'auto' | 'manual' | 'hybrid';
  detection_confidence: number;
  processing_time_ms: number;
}

// ============================================================================
// Domain Selection (User Override)
// ============================================================================

export interface ManualDomainSelection {
  field_id?: string;
  domain_id?: string;
  subspecialty_id?: string;
  user_id: string;
  tenant_id: string;
  created_at: string;
  expires_at?: string;
}

// ============================================================================
// Model-Domain Proficiency Matching
// ============================================================================

export interface ModelProficiencyMatch {
  model_id: string;
  provider: string;
  model_name: string;
  match_score: number;           // 0-100 overall match
  dimension_scores: Record<ProficiencyDimension, number>;
  strengths: ProficiencyDimension[];
  weaknesses: ProficiencyDimension[];
  recommended: boolean;
  ranking: number;
}

export interface DomainModelMatchResult {
  domain_id: string;
  domain_name: string;
  subspecialty_id?: string;
  required_proficiencies: ProficiencyScores;
  matched_models: ModelProficiencyMatch[];
  recommended_model: string;
  fallback_models: string[];
}

// ============================================================================
// Feedback for AGI Learning
// ============================================================================

export interface DomainFeedback {
  feedback_id: string;
  tenant_id: string;
  user_id: string;
  prompt_hash: string;
  detected_domain_id?: string;
  detected_subspecialty_id?: string;
  actual_domain_id?: string;
  actual_subspecialty_id?: string;
  model_used: string;
  quality_score: number;          // 1-5 user rating
  domain_accuracy: boolean;       // Was detection correct?
  proficiency_match_quality: number; // 1-5 how well did model match needs
  feedback_text?: string;
  created_at: string;
}

export interface DomainFeedbackSummary {
  domain_id: string;
  total_feedback_count: number;
  avg_quality_score: number;
  detection_accuracy_rate: number;
  avg_proficiency_match: number;
  top_misclassifications: Array<{
    detected_as: string;
    count: number;
  }>;
  top_model_performers: Array<{
    model_id: string;
    avg_score: number;
    usage_count: number;
  }>;
}

// ============================================================================
// Admin Taxonomy Management
// ============================================================================

export interface TaxonomyUpdateRequest {
  update_type: 'add_field' | 'add_domain' | 'add_subspecialty' | 'update' | 'delete';
  target_path: string;  // e.g., "sciences.physics.quantum_mechanics"
  data: Partial<Field | Domain | Subspecialty>;
  admin_user_id: string;
  reason: string;
}

export interface TaxonomyUpdateLog {
  log_id: string;
  update_type: string;
  target_path: string;
  previous_data?: Record<string, unknown>;
  new_data: Record<string, unknown>;
  admin_user_id: string;
  reason: string;
  created_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface DetectDomainRequest {
  prompt: string;
  include_subspecialties?: boolean;
  min_confidence?: number;
  max_results?: number;
  manual_override?: {
    field_id?: string;
    domain_id?: string;
    subspecialty_id?: string;
  };
}

export interface DetectDomainResponse {
  result: DomainDetectionResult;
  taxonomy_version: string;
}

export interface GetMatchingModelsRequest {
  domain_id?: string;
  subspecialty_id?: string;
  proficiency_weights?: Partial<ProficiencyScores>;
  min_match_score?: number;
  max_models?: number;
  include_self_hosted?: boolean;
}

export interface GetMatchingModelsResponse {
  matches: DomainModelMatchResult;
  orchestration_recommendation: {
    primary_model: string;
    mode: string;
    reasoning: string;
  };
}

export interface SubmitFeedbackRequest {
  prompt_hash: string;
  detected_domain_id?: string;
  actual_domain_id?: string;
  model_used: string;
  quality_score: number;
  domain_accuracy: boolean;
  feedback_text?: string;
}
