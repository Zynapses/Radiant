// Think Tank API Types
// Comprehensive types for all API endpoints

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  modelId?: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokensUsed?: number;
  latencyMs?: number;
  orchestrationMode?: string;
  domainDetected?: DomainDetection;
  costEstimate?: number;
  modelUsed?: string;
  brainPlanId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  isFavorite?: boolean;
  tags?: string[];
  domainMode?: string;
}

export interface DomainDetection {
  field: string;
  domain: string;
  subspecialty?: string;
  confidence: number;
}

export interface Model {
  id: string;
  displayName: string;
  name?: string;
  description?: string;
  provider: string;
  category: string;
  capabilities: string[];
  costPer1kTokens: number;
  maxTokens: number;
  contextLength?: number;
  avgLatencyMs?: number;
  isEnabled: boolean;
  isNew?: boolean;
  tier?: 'free' | 'pro' | 'enterprise';
  proficiencies?: Record<string, number>;
}

export interface ModelCategory {
  id: string;
  name: string;
  description: string;
  models: Model[];
}

export interface UserRule {
  id: string;
  ruleText: string;
  ruleSummary?: string;
  ruleType: RuleType;
  priority: number;
  source: 'user_created' | 'preset_added';
  presetId?: string;
  isActive: boolean;
  timesApplied: number;
  createdAt: string;
}

export type RuleType = 'restriction' | 'preference' | 'format' | 'source' | 'tone' | 'topic' | 'privacy' | 'other';

export interface PresetRule {
  id: string;
  ruleText: string;
  ruleSummary: string;
  description?: string;
  ruleType: RuleType;
  category: string;
  isPopular: boolean;
}

export interface PresetCategory {
  name: string;
  icon: string;
  description: string;
  rules: PresetRule[];
}

export interface UserSettings {
  personalityMode: 'auto' | 'professional' | 'subtle' | 'expressive' | 'playful';
  features: {
    voiceInput: boolean;
    collaboration: boolean;
    codeExecution: boolean;
    fileUploads: boolean;
    imageGeneration: boolean;
  };
  notifications: {
    achievements: boolean;
    updates: boolean;
    tips: boolean;
  };
  privacy: {
    shareAnalytics: boolean;
    storeConversations: boolean;
  };
}

export interface BrainPlan {
  id: string;
  prompt: string;
  mode: OrchestrationMode;
  domain: DomainDetection;
  steps: BrainPlanStep[];
  selectedModel: string;
  modelReason: string;
  estimatedTimeMs: number;
  estimatedCost: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: string;
}

export type OrchestrationMode = 
  | 'thinking'
  | 'extended_thinking'
  | 'coding'
  | 'creative'
  | 'research'
  | 'analysis'
  | 'multi_model'
  | 'chain_of_thought'
  | 'self_consistency';

export interface BrainPlanStep {
  id: string;
  type: StepType;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  result?: string;
}

export type StepType = 
  | 'analyze'
  | 'detect_domain'
  | 'select_model'
  | 'prepare_context'
  | 'ethics_check'
  | 'generate'
  | 'synthesize'
  | 'verify'
  | 'refine'
  | 'calibrate'
  | 'reflect';

export interface GovernorStatus {
  mode: 'performance' | 'balanced' | 'cost_saver' | 'off';
  totalSavings: number;
  decisionsToday: number;
  lastDecision?: GovernorDecision;
}

export interface GovernorDecision {
  originalModel: string;
  selectedModel: string;
  complexityScore: number;
  savingsAmount: number;
  reason: string;
  timestamp: string;
}

export interface UserAnalytics {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  favoriteModels: Array<{ model: string; count: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  activityByDay: Array<{ date: string; messages: number }>;
  achievementsUnlocked: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlockedAt?: string;
  progress?: number;
  threshold?: number;
}

export interface Artifact {
  id: string;
  conversationId: string;
  type: 'code' | 'document' | 'image' | 'chart';
  title: string;
  content: string;
  language?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface DomainMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isEnabled: boolean;
  defaultModel?: string;
  temperature?: number;
}

export interface StreamChunk {
  type: 'content' | 'metadata' | 'plan_update' | 'done' | 'error';
  content?: string;
  metadata?: MessageMetadata;
  planUpdate?: Partial<BrainPlan>;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
