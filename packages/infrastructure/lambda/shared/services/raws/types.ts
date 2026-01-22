/**
 * RAWS v1.1 - RADIANT AI Weighted Selection System
 * TypeScript Types and Constants
 */

// =====================================================
// Enums and Literal Types
// =====================================================

export type ProfileCategory = 'optimization' | 'domain' | 'sofai';

export type OptimizationProfile = 
  | 'BALANCED' 
  | 'QUALITY_FIRST' 
  | 'COST_OPTIMIZED' 
  | 'LATENCY_CRITICAL';

export type DomainProfile = 
  | 'HEALTHCARE' 
  | 'FINANCIAL' 
  | 'LEGAL'
  | 'SCIENTIFIC'
  | 'CREATIVE'
  | 'ENGINEERING';

export type SOFAIProfile = 
  | 'SYSTEM_1' 
  | 'SYSTEM_2'
  | 'SYSTEM_2_5';

export type WeightProfileId = 
  | OptimizationProfile 
  | DomainProfile 
  | SOFAIProfile;

export type Domain = 
  | 'healthcare'
  | 'financial'
  | 'legal'
  | 'scientific'
  | 'creative'
  | 'engineering'
  | 'general';

export type SystemType = 'SYSTEM_1' | 'SYSTEM_2';

export type ThermalState = 'HOT' | 'WARM' | 'COLD' | 'OFF';

export type ModelStatus = 'active' | 'deprecated' | 'disabled';

// =====================================================
// 8-Dimension Scoring
// =====================================================

export interface ScoringWeights {
  Q: number;  // Quality (0-1)
  C: number;  // Cost (0-1)
  L: number;  // Latency (0-1)
  K: number;  // Capability (0-1)
  R: number;  // Reliability (0-1)
  P: number;  // Compliance (0-1)
  A: number;  // Availability (0-1)
  E: number;  // Experience/Learning (0-1)
}

export interface DimensionScores {
  quality: number;      // Q: 0-100
  cost: number;         // C: 0-100
  latency: number;      // L: 0-100
  capability: number;   // K: 0-100
  reliability: number;  // R: 0-100
  compliance: number;   // P: 0-100 (binary: 0 or 100)
  availability: number; // A: 0-100
  learning: number;     // E: 0-100
}

// =====================================================
// Weight Profile
// =====================================================

export interface WeightProfile {
  id: WeightProfileId;
  displayName: string;
  description: string;
  category: ProfileCategory;
  
  weights: ScoringWeights;
  
  // Constraints
  minQualityScore?: number;
  maxPriceMultiplier?: number;
  maxLatencyMs?: number;
  requiredCapabilities?: string[];
  preferredCapabilities?: string[];
  requiredCompliance?: string[];
  forcedSystemType?: SystemType;
  
  // Domain
  domain?: Domain;
  
  // Truth Engine
  requireTruthEngine?: boolean;
  requireSourceCitation?: boolean;
  maxEcdThreshold?: number;
  
  // Flags
  isSystemProfile: boolean;
  isDefault: boolean;
}

// =====================================================
// Domain Configuration
// =====================================================

export interface DomainConfig {
  id: Domain;
  displayName: string;
  description: string;
  weightProfileId: WeightProfileId;
  
  // Constraints
  minQualityScore?: number;
  maxEcdThreshold?: number;
  requiredCompliance?: string[];
  forcedSystemType?: SystemType;
  
  // Verification
  requireTruthEngine: boolean;
  requireSourceCitation: boolean;
  
  // Detection
  detectionKeywords: string[];
  detectionConfidenceThreshold: number;
}

export interface DomainDetectionResult {
  domain: Domain;
  confidence: number;
  matchedKeywords: string[];
  keywordCount: number;
}

// =====================================================
// Model Types
// =====================================================

export interface ExternalModel {
  id: string;
  providerId: string;
  displayName: string;
  modelFamily?: string;
  
  capabilities: string[];
  contextWindow: number;
  maxOutputTokens: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  
  // Pricing
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  markupPercent: number;
  
  // Quality
  qualityScore: number;
  benchmarks: Record<string, number>;
  
  // Latency
  avgTtftMs?: number;
  avgTps?: number;
  
  // Reliability
  uptimePercent30d: number;
  errorRate7d: number;
  
  // Compliance (for binary matching)
  complianceCertifications: string[];
  
  status: ModelStatus;
}

export interface SelfHostedModel {
  id: string;
  displayName: string;
  modelFamily?: string;
  
  sagemakerEndpoint?: string;
  instanceType?: string;
  
  capabilities: string[];
  contextWindow: number;
  maxOutputTokens: number;
  
  costPerHour?: number;
  markupPercent: number;
  
  qualityScore: number;
  
  thermalState: ThermalState;
  minInstances: number;
  maxInstances: number;
  coldStartMs: number;
  
  status: ModelStatus;
}

export type Model = ExternalModel | SelfHostedModel;

// =====================================================
// Selection Request/Response
// =====================================================

export interface SelectionRequest {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  
  // Content for domain detection
  prompt?: string;
  taskType?: string;
  
  // Explicit preferences
  domain?: Domain;
  weightProfileId?: WeightProfileId;
  systemType?: SystemType;
  optimizeFor?: 'quality' | 'cost' | 'latency';
  
  // Requirements
  requiredCapabilities?: string[];
  requiredCompliance?: string[];
  maxLatencyMs?: number;
  maxCostPer1kTokens?: number;
  minQualityScore?: number;
  
  // Token estimates
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  
  // Preferences
  preferredProviders?: string[];
  excludedProviders?: string[];
  preferredModels?: string[];
  excludedModels?: string[];
  
  // Feature flags
  enableLearningScore?: boolean;
  enableThermalAware?: boolean;
}

export interface SelectionResult {
  selectedModel: Model;
  fallbackModels: Model[];
  
  // Scoring details
  compositeScore: number;
  dimensionScores: DimensionScores;
  appliedWeights: ScoringWeights;
  
  // Context
  resolvedDomain: Domain;
  domainConfidence: number;
  resolvedProfile: WeightProfileId;
  resolvedSystemType: SystemType;
  
  // Pricing
  estimatedCost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };
  
  // Audit
  selectionLatencyMs: number;
  requestId: string;
  
  // Warnings
  warnings?: string[];
}

export interface ScoredModel {
  model: Model;
  compositeScore: number;
  dimensionScores: DimensionScores;
  passesConstraints: boolean;
  constraintViolations?: string[];
}

// =====================================================
// Provider Health
// =====================================================

export interface ProviderHealth {
  providerId: string;
  isHealthy: boolean;
  errorCount1h: number;
  successCount1h: number;
  avgLatency1hMs?: number;
  rateLimitHits1h: number;
  checkedAt: Date;
}

// =====================================================
// Audit
// =====================================================

export interface SelectionAuditEntry {
  id: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  requestId: string;
  
  domain: Domain;
  domainConfidence: number;
  weightProfileId: WeightProfileId;
  systemType: SystemType;
  
  selectedModelId: string;
  fallbackModels: string[];
  compositeScore: number;
  
  scores: DimensionScores;
  
  selectionLatencyMs: number;
  requiresComplianceRetention: boolean;
  
  createdAt: Date;
}

// =====================================================
// Constants: 9 Weight Profiles
// =====================================================

export const WEIGHT_PROFILES: Record<WeightProfileId, WeightProfile> = {
  // Optimization Profiles (4)
  BALANCED: {
    id: 'BALANCED',
    displayName: 'Balanced',
    description: 'Default balanced profile for general use',
    category: 'optimization',
    weights: { Q: 0.250, C: 0.200, L: 0.150, K: 0.150, R: 0.100, P: 0.050, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: true,
  },
  QUALITY_FIRST: {
    id: 'QUALITY_FIRST',
    displayName: 'Quality First',
    description: 'Maximum quality, cost secondary',
    category: 'optimization',
    weights: { Q: 0.400, C: 0.100, L: 0.100, K: 0.150, R: 0.100, P: 0.050, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: false,
  },
  COST_OPTIMIZED: {
    id: 'COST_OPTIMIZED',
    displayName: 'Cost Optimized',
    description: 'Minimize cost while meeting quality threshold',
    category: 'optimization',
    weights: { Q: 0.200, C: 0.350, L: 0.150, K: 0.100, R: 0.050, P: 0.050, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: false,
  },
  LATENCY_CRITICAL: {
    id: 'LATENCY_CRITICAL',
    displayName: 'Latency Critical',
    description: 'Fastest response time priority',
    category: 'optimization',
    weights: { Q: 0.150, C: 0.100, L: 0.350, K: 0.150, R: 0.100, P: 0.050, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: false,
  },

  // Domain Profiles (3)
  HEALTHCARE: {
    id: 'HEALTHCARE',
    displayName: 'Healthcare',
    description: 'Medical accuracy and HIPAA compliance mandatory',
    category: 'domain',
    weights: { Q: 0.300, C: 0.050, L: 0.100, K: 0.150, R: 0.100, P: 0.200, A: 0.050, E: 0.050 },
    domain: 'healthcare',
    minQualityScore: 80,
    requiredCompliance: ['HIPAA'],
    forcedSystemType: 'SYSTEM_2',
    requireTruthEngine: true,
    maxEcdThreshold: 0.05,
    isSystemProfile: true,
    isDefault: false,
  },
  FINANCIAL: {
    id: 'FINANCIAL',
    displayName: 'Financial',
    description: 'Financial accuracy and SOC2 audit trails',
    category: 'domain',
    weights: { Q: 0.300, C: 0.100, L: 0.100, K: 0.150, R: 0.100, P: 0.150, A: 0.050, E: 0.050 },
    domain: 'financial',
    minQualityScore: 75,
    requiredCompliance: ['SOC2'],
    forcedSystemType: 'SYSTEM_2',
    requireTruthEngine: true,
    maxEcdThreshold: 0.05,
    isSystemProfile: true,
    isDefault: false,
  },
  LEGAL: {
    id: 'LEGAL',
    displayName: 'Legal',
    description: 'Citation accuracy and source verification required',
    category: 'domain',
    weights: { Q: 0.350, C: 0.050, L: 0.050, K: 0.200, R: 0.100, P: 0.150, A: 0.050, E: 0.050 },
    domain: 'legal',
    minQualityScore: 80,
    requiredCompliance: ['SOC2'],
    forcedSystemType: 'SYSTEM_2',
    requireTruthEngine: true,
    requireSourceCitation: true,
    maxEcdThreshold: 0.05,
    isSystemProfile: true,
    isDefault: false,
  },

  // Domain Profiles (6) - additional
  SCIENTIFIC: {
    id: 'SCIENTIFIC',
    displayName: 'Scientific',
    description: 'Research accuracy paramount, source citation required',
    category: 'domain',
    weights: { Q: 0.350, C: 0.100, L: 0.100, K: 0.200, R: 0.080, P: 0.050, A: 0.050, E: 0.070 },
    domain: 'scientific',
    minQualityScore: 70,
    requireSourceCitation: true,
    maxEcdThreshold: 0.08,
    isSystemProfile: true,
    isDefault: false,
  },
  CREATIVE: {
    id: 'CREATIVE',
    displayName: 'Creative',
    description: 'Subjective quality, fast iteration, cost matters',
    category: 'domain',
    weights: { Q: 0.200, C: 0.250, L: 0.200, K: 0.150, R: 0.050, P: 0.000, A: 0.050, E: 0.100 },
    domain: 'creative',
    maxEcdThreshold: 0.20,
    isSystemProfile: true,
    isDefault: false,
  },
  ENGINEERING: {
    id: 'ENGINEERING',
    displayName: 'Engineering',
    description: 'Code correctness critical, tool use capability important',
    category: 'domain',
    weights: { Q: 0.300, C: 0.150, L: 0.150, K: 0.200, R: 0.100, P: 0.000, A: 0.050, E: 0.050 },
    domain: 'engineering',
    minQualityScore: 70,
    preferredCapabilities: ['function_calling', 'tool_use'],
    maxEcdThreshold: 0.10,
    isSystemProfile: true,
    isDefault: false,
  },

  // SOFAI Profiles (3)
  SYSTEM_1: {
    id: 'SYSTEM_1',
    displayName: 'System 1 (Fast)',
    description: 'Fast, intuitive responses for simple tasks',
    category: 'sofai',
    weights: { Q: 0.150, C: 0.300, L: 0.300, K: 0.100, R: 0.050, P: 0.000, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: false,
  },
  SYSTEM_2: {
    id: 'SYSTEM_2',
    displayName: 'System 2 (Deep)',
    description: 'Deliberate, accurate responses for complex tasks',
    category: 'sofai',
    weights: { Q: 0.350, C: 0.100, L: 0.100, K: 0.150, R: 0.100, P: 0.100, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: false,
  },
  SYSTEM_2_5: {
    id: 'SYSTEM_2_5',
    displayName: 'System 2.5 (Maximum)',
    description: 'Maximum reasoning for critical decisions',
    category: 'sofai',
    weights: { Q: 0.400, C: 0.050, L: 0.050, K: 0.200, R: 0.100, P: 0.100, A: 0.050, E: 0.050 },
    isSystemProfile: true,
    isDefault: false,
  },
};

// Domain to Profile mapping
export const DOMAIN_PROFILE_MAP: Record<Domain, WeightProfileId> = {
  healthcare: 'HEALTHCARE',
  financial: 'FINANCIAL',
  legal: 'LEGAL',
  scientific: 'SCIENTIFIC',
  creative: 'CREATIVE',
  engineering: 'ENGINEERING',
  general: 'BALANCED',
};

// Domain detection keywords
export const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  healthcare: [
    'medical', 'diagnosis', 'treatment', 'patient', 'clinical', 'health',
    'disease', 'symptoms', 'medication', 'prescription', 'doctor', 'hospital',
    'nurse', 'pharmacy', 'surgical', 'therapy', 'vaccine', 'illness', 'prognosis',
    'oncology', 'cardiology', 'radiology', 'pathology', 'pediatric'
  ],
  financial: [
    'investment', 'stock', 'trading', 'portfolio', 'tax', 'accounting',
    'budget', 'financial', 'revenue', 'profit', 'banking', 'audit',
    'compliance', 'loan', 'mortgage', 'insurance', 'dividend', 'equity',
    'securities', 'fiduciary', 'asset', 'liability', 'quarterly', 'fiscal'
  ],
  legal: [
    'legal', 'contract', 'lawsuit', 'litigation', 'attorney', 'court',
    'law', 'compliance', 'regulation', 'statute', 'liability', 'tort',
    'plaintiff', 'defendant', 'jurisdiction', 'verdict', 'settlement',
    'counsel', 'deposition', 'arbitration', 'mediation', 'appeal'
  ],
  scientific: [
    'research', 'experiment', 'hypothesis', 'scientific', 'study',
    'methodology', 'peer review', 'data analysis', 'thesis', 'academic',
    'laboratory', 'journal', 'citation', 'theory', 'empirical'
  ],
  creative: [
    'write', 'story', 'creative', 'fiction', 'poem', 'script', 'novel',
    'brainstorm', 'content', 'marketing', 'blog', 'narrative', 'character',
    'plot', 'dialogue', 'imagery', 'artistic', 'design'
  ],
  engineering: [
    'code', 'programming', 'debug', 'software', 'api', 'architecture',
    'devops', 'deploy', 'git', 'database', 'backend', 'frontend',
    'algorithm', 'refactor', 'function', 'class', 'module', 'test'
  ],
  general: []
};

// Thermal state to availability score mapping
export const THERMAL_AVAILABILITY_SCORES: Record<ThermalState, number> = {
  HOT: 100,
  WARM: 90,
  COLD: 40,
  OFF: 0
};
