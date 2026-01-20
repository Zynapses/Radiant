/**
 * Think Tank Admin Simulator - Types
 * v1.0 - All TypeScript interfaces and types for admin simulation
 */

// View navigation
export type AdminViewType = 
  | 'overview'
  | 'polymorphic'
  | 'governor'
  | 'ego'
  | 'delight'
  | 'rules'
  | 'domains'
  | 'costs'
  | 'users'
  | 'analytics';

// Polymorphic UI Configuration
export type ExecutionMode = 'sniper' | 'war_room';
export type ViewType = 'chat' | 'terminal' | 'canvas' | 'dashboard' | 'diff_editor' | 'decision_cards';

export interface PolymorphicConfig {
  enableAutoMorphing: boolean;
  enableGearbox: boolean;
  enableCostDisplay: boolean;
  enableEscalation: boolean;
  defaultMode: ExecutionMode;
  sniperThreshold: number;
  warRoomThreshold: number;
  domainRouting: Record<string, ExecutionMode>;
}

// Economic Governor Configuration
export type GovernorMode = 'performance' | 'balanced' | 'cost_saver' | 'off';

export interface GovernorConfig {
  mode: GovernorMode;
  cheapThreshold: number;
  premiumThreshold: number;
  classifierModel: string;
  cheapModel: string;
  premiumModel: string;
  sniperThreshold: number;
  warRoomThreshold: number;
  retrievalConfidenceThreshold: number;
}

export interface GovernorStats {
  totalRequests: number;
  sniperRouted: number;
  warRoomRouted: number;
  hitlEscalations: number;
  costSavings: number;
  avgComplexity: number;
  avgLatencyMs: number;
}

// Ego System Configuration
export interface EgoIdentity {
  name: string;
  narrative: string;
  values: string[];
  traits: Record<string, number>; // -1 to 1 scale
}

export interface EgoAffect {
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  curiosity: number;
  engagement: number;
  confidence: number;
}

export interface EgoConfig {
  enabled: boolean;
  identity: EgoIdentity;
  affect: EgoAffect;
  injectIdentity: boolean;
  injectAffect: boolean;
  injectMemory: boolean;
  maxMemoryItems: number;
}

// Delight System
export interface DelightTrigger {
  id: string;
  name: string;
  condition: string;
  action: string;
  frequency: 'always' | 'sometimes' | 'rarely';
  enabled: boolean;
}

export interface DelightStats {
  triggersActivated: number;
  userSatisfaction: number;
  engagementLift: number;
}

// User Rules
export interface UserRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

// Domain Configuration
export interface DomainConfig {
  id: string;
  name: string;
  description: string;
  executionMode: ExecutionMode;
  requiredConfidence: number;
  specialInstructions: string;
  enabled: boolean;
}

// Cost Management
export interface ModelPricing {
  modelId: string;
  modelName: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgLatencyMs: number;
  isEnabled: boolean;
}

export interface CostBudget {
  dailyLimit: number;
  monthlyLimit: number;
  currentDaily: number;
  currentMonthly: number;
  alertThreshold: number;
}

// User Analytics
export interface UserStats {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  avgSessionMinutes: number;
  topModels: { model: string; count: number }[];
  topFeatures: { feature: string; count: number }[];
}

// Tenant Configuration (combined)
export interface TenantConfig {
  tenantId: string;
  tenantName: string;
  polymorphic: PolymorphicConfig;
  governor: GovernorConfig;
  ego: EgoConfig;
  delightTriggers: DelightTrigger[];
  userRules: UserRule[];
  domains: DomainConfig[];
  modelPricing: ModelPricing[];
  costBudget: CostBudget;
}
