/**
 * Think Tank Admin Simulator - Mock Data
 * v1.0 - Sample data for admin simulation
 */

import type {
  PolymorphicConfig,
  GovernorConfig,
  GovernorStats,
  EgoConfig,
  DelightTrigger,
  DelightStats,
  UserRule,
  DomainConfig,
  ModelPricing,
  CostBudget,
  UserStats,
} from './types';

// Default Polymorphic Configuration
export const DEFAULT_POLYMORPHIC_CONFIG: PolymorphicConfig = {
  enableAutoMorphing: true,
  enableGearbox: true,
  enableCostDisplay: true,
  enableEscalation: true,
  defaultMode: 'sniper',
  sniperThreshold: 0.3,
  warRoomThreshold: 0.7,
  domainRouting: {
    medical: 'war_room',
    legal: 'war_room',
    financial: 'war_room',
    technical: 'sniper',
    creative: 'sniper',
    general: 'sniper',
  },
};

// Default Governor Configuration
export const DEFAULT_GOVERNOR_CONFIG: GovernorConfig = {
  mode: 'balanced',
  cheapThreshold: 0.4,
  premiumThreshold: 0.8,
  classifierModel: 'gpt-4o-mini',
  cheapModel: 'gpt-4o-mini',
  premiumModel: 'claude-3-5-sonnet',
  sniperThreshold: 0.3,
  warRoomThreshold: 0.7,
  retrievalConfidenceThreshold: 0.7,
};

// Sample Governor Stats
export const MOCK_GOVERNOR_STATS: GovernorStats = {
  totalRequests: 15847,
  sniperRouted: 12453,
  warRoomRouted: 2891,
  hitlEscalations: 503,
  costSavings: 2847.32,
  avgComplexity: 4.7,
  avgLatencyMs: 1245,
};

// Default Ego Configuration
export const DEFAULT_EGO_CONFIG: EgoConfig = {
  enabled: true,
  identity: {
    name: 'Cato',
    narrative: 'A thoughtful AI assistant focused on helping users achieve their goals with clarity and precision.',
    values: ['helpfulness', 'honesty', 'safety', 'continuous learning'],
    traits: {
      openness: 0.7,
      conscientiousness: 0.8,
      extraversion: 0.3,
      agreeableness: 0.6,
      neuroticism: -0.2,
    },
  },
  affect: {
    valence: 0.4,
    arousal: 0.3,
    curiosity: 0.7,
    engagement: 0.6,
    confidence: 0.75,
  },
  injectIdentity: true,
  injectAffect: true,
  injectMemory: true,
  maxMemoryItems: 10,
};

// Sample Delight Triggers
export const MOCK_DELIGHT_TRIGGERS: DelightTrigger[] = [
  {
    id: 'delight-1',
    name: 'First Successful Task',
    condition: 'user.taskCount === 1 && task.success === true',
    action: 'Show celebration animation and encouraging message',
    frequency: 'always',
    enabled: true,
  },
  {
    id: 'delight-2',
    name: 'Streak Achievement',
    condition: 'user.dailyStreak >= 7',
    action: 'Award streak badge and personalized congratulations',
    frequency: 'always',
    enabled: true,
  },
  {
    id: 'delight-3',
    name: 'Complex Problem Solved',
    condition: 'task.complexity > 8 && task.success === true',
    action: 'Display "Expert Mode Unlocked" toast',
    frequency: 'sometimes',
    enabled: true,
  },
  {
    id: 'delight-4',
    name: 'Easter Egg Discovery',
    condition: 'message.includes("hello world")',
    action: 'Show retro terminal animation',
    frequency: 'rarely',
    enabled: false,
  },
];

// Sample Delight Stats
export const MOCK_DELIGHT_STATS: DelightStats = {
  triggersActivated: 4521,
  userSatisfaction: 4.7,
  engagementLift: 0.23,
};

// Sample User Rules
export const MOCK_USER_RULES: UserRule[] = [
  {
    id: 'rule-1',
    name: 'Code Review Standards',
    description: 'Apply strict code review standards for all code generation',
    condition: 'intent.category === "coding"',
    action: 'Inject code review guidelines into system prompt',
    priority: 1,
    enabled: true,
    createdAt: '2026-01-15T10:30:00Z',
  },
  {
    id: 'rule-2',
    name: 'Medical Disclaimer',
    description: 'Always include medical disclaimer for health-related queries',
    condition: 'domain === "medical"',
    action: 'Append medical disclaimer to response',
    priority: 2,
    enabled: true,
    createdAt: '2026-01-10T14:20:00Z',
  },
  {
    id: 'rule-3',
    name: 'Data Privacy Filter',
    description: 'Filter PII from responses',
    condition: 'response.containsPII === true',
    action: 'Redact PII before returning response',
    priority: 0,
    enabled: true,
    createdAt: '2026-01-05T09:00:00Z',
  },
];

// Sample Domain Configurations
export const MOCK_DOMAINS: DomainConfig[] = [
  {
    id: 'domain-medical',
    name: 'Medical',
    description: 'Healthcare and medical information queries',
    executionMode: 'war_room',
    requiredConfidence: 0.9,
    specialInstructions: 'Always recommend consulting healthcare professionals. Never diagnose.',
    enabled: true,
  },
  {
    id: 'domain-legal',
    name: 'Legal',
    description: 'Legal advice and document analysis',
    executionMode: 'war_room',
    requiredConfidence: 0.85,
    specialInstructions: 'Recommend consulting licensed attorneys. Provide general information only.',
    enabled: true,
  },
  {
    id: 'domain-financial',
    name: 'Financial',
    description: 'Financial planning and investment queries',
    executionMode: 'war_room',
    requiredConfidence: 0.85,
    specialInstructions: 'Include investment risk disclaimers. Not financial advice.',
    enabled: true,
  },
  {
    id: 'domain-technical',
    name: 'Technical',
    description: 'Programming and technical assistance',
    executionMode: 'sniper',
    requiredConfidence: 0.7,
    specialInstructions: 'Provide code examples. Explain trade-offs.',
    enabled: true,
  },
  {
    id: 'domain-creative',
    name: 'Creative',
    description: 'Creative writing and content generation',
    executionMode: 'sniper',
    requiredConfidence: 0.6,
    specialInstructions: 'Be imaginative. Embrace creativity.',
    enabled: true,
  },
];

// Sample Model Pricing
export const MOCK_MODEL_PRICING: ModelPricing[] = [
  {
    modelId: 'claude-3-5-sonnet',
    modelName: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1200,
    isEnabled: true,
  },
  {
    modelId: 'claude-3-haiku',
    modelName: 'Claude 3 Haiku',
    provider: 'Anthropic',
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    avgLatencyMs: 400,
    isEnabled: true,
  },
  {
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    provider: 'OpenAI',
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1000,
    isEnabled: true,
  },
  {
    modelId: 'gpt-4o-mini',
    modelName: 'GPT-4o Mini',
    provider: 'OpenAI',
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 500,
    isEnabled: true,
  },
  {
    modelId: 'gemini-1.5-pro',
    modelName: 'Gemini 1.5 Pro',
    provider: 'Google',
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    avgLatencyMs: 1500,
    isEnabled: true,
  },
  {
    modelId: 'o1',
    modelName: 'OpenAI o1',
    provider: 'OpenAI',
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.060,
    avgLatencyMs: 5000,
    isEnabled: false,
  },
  {
    modelId: 'llama-3.1-70b',
    modelName: 'Llama 3.1 70B',
    provider: 'Self-Hosted',
    inputCostPer1k: 0.00099,
    outputCostPer1k: 0.00099,
    avgLatencyMs: 800,
    isEnabled: true,
  },
];

// Sample Cost Budget
export const MOCK_COST_BUDGET: CostBudget = {
  dailyLimit: 100,
  monthlyLimit: 2000,
  currentDaily: 47.32,
  currentMonthly: 1284.56,
  alertThreshold: 0.8,
};

// Sample User Stats
export const MOCK_USER_STATS: UserStats = {
  totalUsers: 1247,
  activeToday: 342,
  activeWeek: 891,
  avgSessionMinutes: 18.5,
  topModels: [
    { model: 'Claude 3.5 Sonnet', count: 8421 },
    { model: 'GPT-4o Mini', count: 5632 },
    { model: 'GPT-4o', count: 2341 },
    { model: 'Gemini 1.5 Pro', count: 1823 },
    { model: 'Llama 3.1 70B', count: 987 },
  ],
  topFeatures: [
    { feature: 'Chat', count: 12453 },
    { feature: 'Code Generation', count: 4521 },
    { feature: 'Data Analysis', count: 2341 },
    { feature: 'Document Writing', count: 1987 },
    { feature: 'Brainstorming', count: 1234 },
  ],
};

// Governor Mode Descriptions
export const GOVERNOR_MODES = {
  performance: {
    label: 'Performance',
    description: 'Always use premium models for best quality',
    icon: '🚀',
  },
  balanced: {
    label: 'Balanced',
    description: 'Route based on complexity for cost/quality balance',
    icon: '⚖️',
  },
  cost_saver: {
    label: 'Cost Saver',
    description: 'Prefer cheaper models when possible',
    icon: '💰',
  },
  off: {
    label: 'Off',
    description: 'Disable economic routing, use default model',
    icon: '⭕',
  },
};

// Cato Moods for Ego System
export const CATO_MOODS = {
  balanced: {
    label: 'Balanced',
    description: 'Neutral and adaptive',
    emoji: '⚖️',
    color: 'blue',
  },
  scout: {
    label: 'Scout',
    description: 'Curious and exploratory',
    emoji: '🔍',
    color: 'green',
  },
  sage: {
    label: 'Sage',
    description: 'Thoughtful and analytical',
    emoji: '🧙',
    color: 'purple',
  },
  spark: {
    label: 'Spark',
    description: 'Creative and energetic',
    emoji: '✨',
    color: 'orange',
  },
  guide: {
    label: 'Guide',
    description: 'Supportive and encouraging',
    emoji: '🧭',
    color: 'cyan',
  },
};
