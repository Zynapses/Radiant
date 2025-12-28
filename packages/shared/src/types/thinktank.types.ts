// RADIANT v4.18.0 - Think Tank Types
// Type definitions for Think Tank consumer platform

export interface ThinkTankConversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  primaryModel: string | null;
  domainMode: string | null;
  personaId: string | null;
  focusModeId: string | null;
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  // Domain taxonomy integration
  detectedFieldId: string | null;
  detectedDomainId: string | null;
  detectedSubspecialtyId: string | null;
  domainDetectionConfidence: number | null;
  domainProficiencyMatch: number | null;
}

export interface ThinkTankMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model: string | null;
  tokensUsed: number | null;
  cost: number | null;
  latencyMs: number | null;
  parentMessageId: string | null;
  createdAt: Date;
}

export interface FocusMode {
  id: string;
  tenantId: string | null;
  modeName: string;
  displayName: string;
  description: string | null;
  icon: string | null;
  systemPrompt: string;
  defaultModel: string | null;
  settings: Record<string, unknown>;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface UserPersona {
  id: string;
  tenantId: string;
  userId: string;
  personaName: string;
  displayName: string | null;
  avatarUrl: string | null;
  systemPrompt: string;
  voiceId: string | null;
  personalityTraits: string[];
  knowledgeDomains: string[];
  conversationStyle: Record<string, unknown>;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPrompt {
  id: string;
  tenantId: string;
  userId: string;
  promptName: string;
  promptText: string;
  model: string;
  scheduleType: 'once' | 'cron' | 'interval';
  cronExpression: string | null;
  runAt: Date | null;
  timezone: string;
  isActive: boolean;
  maxRuns: number | null;
  runCount: number;
  lastRun: Date | null;
  nextRun: Date | null;
  notificationEmail: string | null;
  outputDestination: 'email' | 'webhook' | 'storage';
  createdAt: Date;
}

export interface TeamPlan {
  id: string;
  tenantId: string;
  teamName: string;
  ownerUserId: string;
  planType: 'family' | 'team' | 'enterprise';
  maxMembers: number;
  totalTokenAllocation: number;
  usedTokens: number;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  tokenAllocation: number;
  usedTokens: number;
  joinedAt: Date;
}

export interface ThinkTankUserPreferences {
  id: string;
  userId: string;
  tenantId: string;
  selectionMode: 'auto' | 'manual' | 'favorites' | 'domain-aware';
  defaultModelId: string | null;
  favoriteModels: string[];
  showStandardModels: boolean;
  showNovelModels: boolean;
  showSelfHostedModels: boolean;
  showCostPerMessage: boolean;
  maxCostPerMessage: number | null;
  preferCostOptimization: boolean;
  domainModeModelOverrides: Record<string, string>;
  recentModels: string[];
  createdAt: Date;
  updatedAt: Date;
  // Domain taxonomy preferences
  enableDomainDetection: boolean;
  defaultFieldId: string | null;
  defaultDomainId: string | null;
  defaultSubspecialtyId: string | null;
  domainModelOverrides: Record<string, string>;  // domainId -> modelId
}

export interface DomainModeConfig {
  enabled: boolean;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
  // Domain taxonomy integration
  taxonomyDomainId?: string;  // Link to domain_taxonomy_domains
  proficiencyRequirements?: ProficiencyScores;
}

export type DomainMode = 
  | 'general'
  | 'medical'
  | 'legal'
  | 'code'
  | 'academic'
  | 'creative'
  | 'scientific'
  | 'financial'
  | 'technical';

// Re-export ProficiencyScores from domain-taxonomy.types for backward compatibility
import type { ProficiencyScores } from './domain-taxonomy.types';
export type { ProficiencyScores } from './domain-taxonomy.types';

// Domain taxonomy selection for Think Tank
export interface ThinkTankDomainSelection {
  fieldId: string | null;
  fieldName: string | null;
  fieldIcon: string | null;
  domainId: string | null;
  domainName: string | null;
  domainIcon: string | null;
  subspecialtyId: string | null;
  subspecialtyName: string | null;
  detectionConfidence: number;
  isAutoDetected: boolean;
  mergedProficiencies: ProficiencyScores | null;
}

// Model recommendation based on domain
export interface DomainModelRecommendation {
  modelId: string;
  modelName: string;
  provider: string;
  matchScore: number;
  strengths: string[];
  weaknesses: string[];
  isRecommended: boolean;
}

// Orchestration mode recommendation
export interface OrchestrationModeRecommendation {
  recommendedMode: 'thinking' | 'extended_thinking' | 'coding' | 'creative' | 'research' | 'analysis';
  reasoning: string;
  availableModes: string[];
}

export interface ThinkTankSession {
  id: string;
  tenantId: string;
  userId: string;
  problemSummary: string | null;
  domain: string | null;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  totalSteps: number;
  avgConfidence: number | null;
  solutionFound: boolean;
  totalTokens: number;
  totalCost: number;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ThinkTankStep {
  id: string;
  sessionId: string;
  stepNumber: number;
  stepType: 'decompose' | 'reason' | 'execute' | 'verify' | 'synthesize';
  description: string | null;
  reasoning: string | null;
  result: string | null;
  confidence: number | null;
  modelUsed: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  createdAt: Date;
}

// Shared conversation types
export interface SharedConversation {
  id: string;
  conversationId: string;
  tenantId: string;
  sharedBy: string;
  shareToken: string;
  title: string | null;
  description: string | null;
  isPublic: boolean;
  allowCopy: boolean;
  expiresAt: Date | null;
  viewCount: number;
  maxViews: number | null;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedConversationView {
  id: string;
  shareToken: string;
  title: string | null;
  description: string | null;
  sharedByName: string;
  sharedAt: Date;
  messageCount: number;
  allowCopy: boolean;
  messages: SharedMessage[];
}

export interface SharedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  createdAt: Date;
}

export interface CreateShareRequest {
  conversationId: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
  allowCopy?: boolean;
  expiresAt?: Date;
  maxViews?: number;
  password?: string;
}

export interface ShareAccessLog {
  id: string;
  shareId: string;
  accessorIp: string | null;
  accessorUserId: string | null;
  userAgent: string | null;
  accessedAt: Date;
}
