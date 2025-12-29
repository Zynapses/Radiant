/**
 * RADIANT v4.18.0 - User Memory Rules Types
 * Personal rules users set for their AI interactions (like Windsurf policies for end users)
 */

// ============================================================================
// Rule Types
// ============================================================================

export type UserRuleType = 
  | 'restriction'    // Don't do X
  | 'preference'     // Prefer to do X
  | 'format'         // Format responses as X
  | 'source'         // Source requirements
  | 'tone'           // Tone/style preferences
  | 'topic'          // Topic-specific rules
  | 'privacy'        // Privacy-related rules
  | 'accessibility'  // Accessibility preferences
  | 'other';         // Uncategorized

export type UserRuleSource = 
  | 'user_created'   // User typed it manually
  | 'preset_added'   // Added from preset list
  | 'ai_suggested'   // AI suggested based on feedback
  | 'imported';      // Imported from another source

// ============================================================================
// User Memory Rule
// ============================================================================

export interface UserMemoryRule {
  id: string;
  tenantId: string;
  userId: string;
  
  // Rule content
  ruleText: string;
  ruleSummary?: string;
  
  // Categorization
  ruleType: UserRuleType;
  priority: number;  // 0-100, higher = more important
  
  // Memory Category (what type of memory is this?)
  memoryCategoryId?: string;
  memoryCategoryCode?: string;
  memoryCategoryName?: string;
  memoryCategoryIcon?: string;
  memoryCategoryColor?: string;
  
  // Source
  source: UserRuleSource;
  presetId?: string;
  
  // Status
  isActive: boolean;
  
  // Application scope
  applyToPreprompts: boolean;
  applyToSynthesis: boolean;
  applyToResponses: boolean;
  
  // Optional targeting
  applicableDomains: string[];  // Empty = all
  applicableModes: string[];    // Empty = all
  
  // Stats
  timesApplied: number;
  lastAppliedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Preset Rule
// ============================================================================

export interface PresetUserRule {
  id: string;
  
  // Content
  ruleText: string;
  ruleSummary: string;
  description?: string;
  
  // Categorization
  ruleType: UserRuleType;
  category: string;  // For UI grouping
  
  // Display
  displayOrder: number;
  icon?: string;  // Lucide icon name
  isPopular: boolean;
  
  // Status
  isActive: boolean;
  minTier: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface PresetRuleCategory {
  name: string;
  icon: string;
  description: string;
  rules: PresetUserRule[];
}

// ============================================================================
// Rule Application
// ============================================================================

export interface UserRuleApplicationLog {
  id: string;
  ruleId: string;
  planId?: string;
  prepromptInstanceId?: string;
  applicationContext: 'preprompt' | 'synthesis' | 'response';
  wasEffective?: boolean;
  createdAt: Date;
}

export interface AppliedUserRules {
  rules: UserMemoryRule[];
  formattedForPrompt: string;
  ruleCount: number;
  hasRestrictions: boolean;
  hasSourceRequirements: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetUserRulesRequest {
  userId: string;
  activeOnly?: boolean;
  ruleType?: UserRuleType;
}

export interface GetUserRulesResponse {
  rules: UserMemoryRule[];
  total: number;
  activeCount: number;
}

export interface CreateUserRuleRequest {
  ruleText: string;
  ruleSummary?: string;
  ruleType?: UserRuleType;
  priority?: number;
  source?: UserRuleSource;
  presetId?: string;
  applyToPreprompts?: boolean;
  applyToSynthesis?: boolean;
  applyToResponses?: boolean;
  applicableDomains?: string[];
  applicableModes?: string[];
}

export interface UpdateUserRuleRequest {
  ruleId: string;
  ruleText?: string;
  ruleSummary?: string;
  ruleType?: UserRuleType;
  priority?: number;
  isActive?: boolean;
  applyToPreprompts?: boolean;
  applyToSynthesis?: boolean;
  applyToResponses?: boolean;
  applicableDomains?: string[];
  applicableModes?: string[];
}

export interface AddPresetRuleRequest {
  presetId: string;
  customizations?: {
    ruleText?: string;  // Override the preset text
    priority?: number;
  };
}

export interface GetPresetRulesResponse {
  categories: PresetRuleCategory[];
  popularRules: PresetUserRule[];
}

export interface GetRulesForPromptRequest {
  userId: string;
  domainId?: string;
  mode?: string;
}

export interface GetRulesForPromptResponse {
  rules: AppliedUserRules;
}

// ============================================================================
// Think Tank UI Types
// ============================================================================

export interface UserRulesPageData {
  // User's rules
  rules: UserMemoryRule[];
  activeRulesCount: number;
  
  // Presets
  presetCategories: PresetRuleCategory[];
  popularPresets: PresetUserRule[];
  
  // Stats
  totalTimesApplied: number;
  mostUsedRules: Array<{
    rule: UserMemoryRule;
    timesApplied: number;
  }>;
}

export interface RuleSuggestion {
  ruleText: string;
  ruleSummary: string;
  ruleType: UserRuleType;
  reason: string;  // Why this is suggested
  confidence: number;
}

// ============================================================================
// Rule Validation
// ============================================================================

export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export function validateUserRule(rule: CreateUserRuleRequest): RuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Required fields
  if (!rule.ruleText || rule.ruleText.trim().length === 0) {
    errors.push('Rule text is required');
  }

  // Length checks
  if (rule.ruleText && rule.ruleText.length > 1000) {
    errors.push('Rule text must be under 1000 characters');
  }

  if (rule.ruleText && rule.ruleText.length < 10) {
    warnings.push('Very short rules may not be effective');
  }

  // Priority range
  if (rule.priority !== undefined && (rule.priority < 0 || rule.priority > 100)) {
    errors.push('Priority must be between 0 and 100');
  }

  // Suggestions
  if (rule.ruleText && !rule.ruleSummary) {
    suggestions.push('Consider adding a short summary for easier management');
  }

  if (rule.ruleType === 'restriction' && !rule.ruleText.toLowerCase().includes('do not') && 
      !rule.ruleText.toLowerCase().includes("don't") && !rule.ruleText.toLowerCase().includes('avoid')) {
    suggestions.push('Restriction rules typically start with "Do not" or "Avoid"');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

// ============================================================================
// Constants
// ============================================================================

export const RULE_TYPE_LABELS: Record<UserRuleType, string> = {
  restriction: 'Restriction',
  preference: 'Preference',
  format: 'Response Format',
  source: 'Sources & Citations',
  tone: 'Tone & Style',
  topic: 'Topic Rules',
  privacy: 'Privacy',
  accessibility: 'Accessibility',
  other: 'Other',
};

export const RULE_TYPE_ICONS: Record<UserRuleType, string> = {
  restriction: 'Ban',
  preference: 'Heart',
  format: 'AlignLeft',
  source: 'BookOpen',
  tone: 'MessageSquare',
  topic: 'Tag',
  privacy: 'Shield',
  accessibility: 'Eye',
  other: 'MoreHorizontal',
};

export const DEFAULT_RULE_PRIORITY = 50;
export const MAX_RULES_PER_USER = 50;
export const MAX_RULE_TEXT_LENGTH = 1000;

// ============================================================================
// Memory Categories - What type of memory/rule is this?
// ============================================================================

export interface MemoryCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  
  // Hierarchy
  parentId?: string;
  parentCode?: string;
  level: number;
  path: string;  // e.g., 'instruction.format'
  
  // Display
  icon?: string;
  color?: string;
  displayOrder: number;
  
  // Behavior
  isSystem: boolean;
  isExpandable: boolean;
  appliesTo: ('preprompt' | 'synthesis' | 'response')[];
  
  // Children (for tree structure)
  children?: MemoryCategory[];
  childCount?: number;
}

export type MemoryCategoryCode = 
  // Top-level
  | 'instruction'
  | 'preference'
  | 'context'
  | 'knowledge'
  | 'constraint'
  | 'goal'
  // Instruction sub-categories
  | 'instruction.format'
  | 'instruction.tone'
  | 'instruction.source'
  // Preference sub-categories
  | 'preference.style'
  | 'preference.detail'
  // Context sub-categories
  | 'context.personal'
  | 'context.work'
  | 'context.project'
  // Knowledge sub-categories
  | 'knowledge.fact'
  | 'knowledge.definition'
  | 'knowledge.procedure'
  // Constraint sub-categories
  | 'constraint.topic'
  | 'constraint.privacy'
  | 'constraint.safety'
  // Goal sub-categories
  | 'goal.learning'
  | 'goal.productivity';

export const MEMORY_CATEGORY_LABELS: Record<string, string> = {
  instruction: 'Instruction',
  preference: 'Preference',
  context: 'Context',
  knowledge: 'Knowledge',
  constraint: 'Constraint',
  goal: 'Goal',
  'instruction.format': 'Format Instructions',
  'instruction.tone': 'Tone Instructions',
  'instruction.source': 'Source Instructions',
  'preference.style': 'Style Preferences',
  'preference.detail': 'Detail Level',
  'context.personal': 'Personal Context',
  'context.work': 'Work Context',
  'context.project': 'Project Context',
  'knowledge.fact': 'Facts',
  'knowledge.definition': 'Definitions',
  'knowledge.procedure': 'Procedures',
  'constraint.topic': 'Topic Restrictions',
  'constraint.privacy': 'Privacy Constraints',
  'constraint.safety': 'Safety Constraints',
  'goal.learning': 'Learning Goals',
  'goal.productivity': 'Productivity Goals',
};

export const MEMORY_CATEGORY_ICONS: Record<string, string> = {
  instruction: 'Wand2',
  preference: 'Heart',
  context: 'User',
  knowledge: 'BookOpen',
  constraint: 'Ban',
  goal: 'Target',
  'instruction.format': 'AlignLeft',
  'instruction.tone': 'MessageSquare',
  'instruction.source': 'Quote',
  'preference.style': 'Palette',
  'preference.detail': 'Layers',
  'context.personal': 'User',
  'context.work': 'Briefcase',
  'context.project': 'Folder',
  'knowledge.fact': 'Database',
  'knowledge.definition': 'Book',
  'knowledge.procedure': 'ListOrdered',
  'constraint.topic': 'Ban',
  'constraint.privacy': 'Shield',
  'constraint.safety': 'AlertTriangle',
  'goal.learning': 'GraduationCap',
  'goal.productivity': 'Zap',
};

export const MEMORY_CATEGORY_COLORS: Record<string, string> = {
  instruction: 'purple',
  preference: 'pink',
  context: 'blue',
  knowledge: 'green',
  constraint: 'red',
  goal: 'amber',
};

export interface MemoryCategoryTree {
  categories: MemoryCategory[];
  topLevel: MemoryCategory[];
  byCode: Record<string, MemoryCategory>;
}

export interface GetMemoryCategoriesResponse {
  tree: MemoryCategoryTree;
}

export interface MemoryByCategory {
  category: MemoryCategory;
  memories: UserMemoryRule[];
  count: number;
}
