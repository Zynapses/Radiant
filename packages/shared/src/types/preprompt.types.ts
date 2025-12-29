/**
 * RADIANT v4.18.0 - Pre-Prompt Learning Types
 * Tracks pre-prompts, feedback, and attribution for AGI learning
 */

import type { OrchestrationMode } from './agi-brain-plan.types';

// ============================================================================
// Pre-Prompt Template Types
// ============================================================================

export interface PrepromptTemplate {
  id: string;
  templateCode: string;
  name: string;
  description?: string;
  
  // Template content
  systemPrompt: string;
  contextTemplate?: string;
  instructionTemplate?: string;
  
  // Applicability
  applicableModes: OrchestrationMode[];
  applicableDomains: string[];
  applicableTaskTypes: string[];
  complexityRange: Array<'simple' | 'moderate' | 'complex' | 'expert'>;
  
  // Model compatibility
  compatibleModels: string[];
  preferredModels: string[];
  incompatibleModels: string[];
  
  // Weighting factors (0.0 to 1.0)
  baseEffectivenessScore: number;
  domainWeight: number;
  modeWeight: number;
  modelWeight: number;
  complexityWeight: number;
  taskTypeWeight: number;
  feedbackWeight: number;
  
  // Learning state
  totalUses: number;
  successfulUses: number;
  avgFeedbackScore?: number;
  learnedAdjustments: Record<string, number>;
  
  // Status
  isActive: boolean;
  isDefault: boolean;
  
  // Metadata
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Pre-Prompt Instance Types
// ============================================================================

export interface PrepromptInstance {
  id: string;
  planId: string;
  templateId?: string;
  
  // Rendered content
  systemPromptRendered: string;
  contextRendered?: string;
  instructionRendered?: string;
  fullPreprompt: string;
  
  // Execution context
  tenantId: string;
  userId: string;
  
  // Model context
  modelId: string;
  modelName?: string;
  provider?: string;
  
  // Mode context
  orchestrationMode: OrchestrationMode;
  
  // Domain context
  detectedFieldId?: string;
  detectedDomainId?: string;
  detectedSubspecialtyId?: string;
  domainConfidence?: number;
  
  // Task context
  taskType?: string;
  complexity?: 'simple' | 'moderate' | 'complex' | 'expert';
  promptTokenCount?: number;
  
  // Workflow context
  workflowId?: string;
  workflowCode?: string;
  workflowStepId?: string;
  
  // Performance metrics
  responseQualityScore?: number;
  latencyMs?: number;
  tokensUsed?: number;
  costCents?: number;
  
  // Status
  status: 'pending' | 'executing' | 'completed' | 'failed';
  errorMessage?: string;
  
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Feedback Types
// ============================================================================

export type IssueAttribution = 
  | 'preprompt'        // Pre-prompt was the issue
  | 'model'            // Model selection was wrong
  | 'mode'             // Orchestration mode was wrong
  | 'workflow'         // Workflow pattern was wrong
  | 'domain_detection' // Domain detection was wrong
  | 'other';           // Something else

export interface PrepromptFeedback {
  id: string;
  instanceId: string;
  
  // Feedback source
  feedbackSource: 'user' | 'auto' | 'admin';
  userId?: string;
  
  // Overall rating
  rating?: number;  // 1-5
  thumbsUp?: boolean;
  
  // Detailed feedback
  responseHelpful?: boolean;
  responseAccurate?: boolean;
  responseComplete?: boolean;
  responseAppropriateTone?: boolean;
  
  // Attribution analysis
  issueAttribution?: IssueAttribution;
  issueAttributionConfidence?: number;
  
  // Specific feedback
  feedbackText?: string;
  improvementSuggestions?: string;
  
  // Context
  conversationContext: Record<string, unknown>;
  
  // Learning signals
  wouldReuse?: boolean;
  recommendedChanges?: string;
  
  createdAt: Date;
}

// ============================================================================
// Attribution Analysis Types
// ============================================================================

export type AttributionFactorType = 
  | 'model'
  | 'mode'
  | 'domain'
  | 'workflow'
  | 'complexity'
  | 'task_type';

export interface PrepromptAttributionScore {
  id: string;
  templateId: string;
  
  // Factor being scored
  factorType: AttributionFactorType;
  factorValue: string;
  
  // Scores
  successCorrelation: number;  // -1 to 1
  sampleSize: number;
  avgFeedbackScore?: number;
  
  // Confidence
  confidence: number;  // 0 to 1
  
  // Recommendations
  recommendedWeightAdjustment: number;
  notes?: string;
  
  lastCalculated: Date;
}

// ============================================================================
// Learning Configuration Types
// ============================================================================

export interface PrepromptLearningConfig {
  id: string;
  configKey: string;
  configValue: Record<string, unknown>;
  description?: string;
  isEnabled: boolean;
  minSamplesForLearning: number;
  learningRate: number;
  updatedBy?: string;
  updatedAt: Date;
}

export interface AttributionWeights {
  preprompt: number;
  model: number;
  mode: number;
  domain: number;
  workflow: number;
}

export interface ExplorationConfig {
  rate: number;
  decay: number;
  minRate: number;
}

export interface FeedbackThresholds {
  minSamples: number;
  confidenceThreshold: number;
  adjustmentCap: number;
}

// ============================================================================
// Selection Types
// ============================================================================

export interface PrepromptSelectionLog {
  id: string;
  instanceId: string;
  
  candidatesConsidered: number;
  selectionMethod: 'best_match' | 'random_explore' | 'admin_forced' | 'default';
  
  scoringBreakdown: {
    templateScores: Array<{
      templateId: string;
      templateCode: string;
      baseScore: number;
      domainBonus: number;
      modeBonus: number;
      modelBonus: number;
      feedbackAdjustment: number;
      finalScore: number;
    }>;
    selectionReason: string;
  };
  
  explorationFactor: number;
  wasExploration: boolean;
  
  createdAt: Date;
}

export interface PrepromptSelectionRequest {
  planId: string;
  tenantId: string;
  userId: string;
  
  // Context for selection
  orchestrationMode: OrchestrationMode;
  modelId: string;
  detectedDomainId?: string;
  taskType?: string;
  complexity?: 'simple' | 'moderate' | 'complex' | 'expert';
  
  // Preferences
  preferredTemplateCode?: string;
  excludeTemplates?: string[];
  
  // Variables for template rendering
  variables: Record<string, string>;
}

export interface PrepromptSelectionResult {
  selectedTemplate: PrepromptTemplate;
  renderedPreprompt: {
    systemPrompt: string;
    context?: string;
    instruction?: string;
    full: string;
  };
  selectionLog: PrepromptSelectionLog;
  alternatives: Array<{
    template: PrepromptTemplate;
    score: number;
    reason: string;
  }>;
}

// ============================================================================
// Effectiveness Summary Types
// ============================================================================

export interface PrepromptEffectivenessSummary {
  templateId: string;
  templateCode: string;
  templateName: string;
  
  // Usage stats
  totalInstances: number;
  totalFeedback: number;
  
  // Feedback aggregates
  avgRating?: number;
  thumbsUpRate?: number;
  
  // Attribution breakdown
  blamedOnPreprompt: number;
  blamedOnModel: number;
  blamedOnMode: number;
  blamedOnWorkflow: number;
  blamedOnDomain: number;
  blamedOnOther: number;
  
  // Performance
  avgQualityScore?: number;
  avgLatencyMs?: number;
  avgCostCents?: number;
  
  // By mode stats
  byModeStats: Record<string, {
    count: number;
    avgRating?: number;
  }>;
  
  lastUsed?: Date;
  calculatedAt: Date;
}

// ============================================================================
// Admin Dashboard Types
// ============================================================================

export interface PrepromptAdminDashboard {
  // Summary stats
  totalTemplates: number;
  activeTemplates: number;
  totalInstances: number;
  totalFeedback: number;
  
  // Overall effectiveness
  overallAvgRating: number;
  overallThumbsUpRate: number;
  
  // Attribution distribution
  attributionDistribution: {
    preprompt: number;
    model: number;
    mode: number;
    workflow: number;
    domain: number;
    other: number;
  };
  
  // Learning status
  learningEnabled: boolean;
  explorationRate: number;
  lastLearningUpdate?: Date;
  
  // Top performing templates
  topTemplates: Array<{
    templateCode: string;
    name: string;
    avgRating: number;
    uses: number;
  }>;
  
  // Templates needing attention
  lowPerformingTemplates: Array<{
    templateCode: string;
    name: string;
    avgRating: number;
    issues: string[];
  }>;
  
  // Recent feedback
  recentFeedback: Array<{
    instanceId: string;
    rating: number;
    attribution?: IssueAttribution;
    feedbackText?: string;
    createdAt: Date;
  }>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetPrepromptDashboardResponse {
  dashboard: PrepromptAdminDashboard;
}

export interface GetTemplatesRequest {
  activeOnly?: boolean;
  mode?: OrchestrationMode;
  domain?: string;
}

export interface GetTemplatesResponse {
  templates: PrepromptTemplate[];
  total: number;
}

export interface UpdateTemplateWeightsRequest {
  templateId: string;
  weights: {
    domainWeight?: number;
    modeWeight?: number;
    modelWeight?: number;
    complexityWeight?: number;
    taskTypeWeight?: number;
    feedbackWeight?: number;
  };
}

export interface UpdateLearningConfigRequest {
  configKey: string;
  configValue: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface SubmitPrepromptFeedbackRequest {
  instanceId: string;
  rating?: number;
  thumbsUp?: boolean;
  issueAttribution?: IssueAttribution;
  feedbackText?: string;
  improvementSuggestions?: string;
  wouldReuse?: boolean;
}

export interface GetEffectivenessRequest {
  templateId?: string;
  mode?: OrchestrationMode;
  domain?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface GetEffectivenessResponse {
  summaries: PrepromptEffectivenessSummary[];
  aggregated: {
    totalInstances: number;
    avgRating: number;
    attributionBreakdown: AttributionWeights;
  };
}
