/**
 * RADIANT v4.18.0 - User Rules Service
 * Manages user memory rules and applies them to AI interactions
 */

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLogger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

import type {
  UserMemoryRule,
  PresetUserRule,
  PresetRuleCategory,
  UserRuleType,
  UserRuleSource,
  AppliedUserRules,
  CreateUserRuleRequest,
  UpdateUserRuleRequest,
  UserRulesPageData,
  MemoryCategory,
  MemoryCategoryTree,
  MemoryByCategory,
} from '@radiant/shared';

const logger = enhancedLogger;

// ============================================================================
// User Rules Service
// ============================================================================

class UserRulesService {
  private presetCache: PresetUserRule[] | null = null;
  private presetCacheExpiry = 0;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // ============================================================================
  // User Rules CRUD
  // ============================================================================

  async getUserRules(
    tenantId: string,
    userId: string,
    activeOnly = true
  ): Promise<UserMemoryRule[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM user_memory_rules
      WHERE tenant_id = :tenant_id AND user_id = :user_id
      ${activeOnly ? 'AND is_active = true' : ''}
      ORDER BY priority DESC, created_at ASC
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
    ]);

    return result.rows.map(this.mapRuleRow);
  }

  async createRule(
    tenantId: string,
    userId: string,
    request: CreateUserRuleRequest
  ): Promise<UserMemoryRule> {
    // Check rule limit
    const existingCount = await this.getRuleCount(tenantId, userId);
    if (existingCount >= 50) {
      throw new Error('Maximum rules limit reached (50). Please delete some rules first.');
    }

    const id = uuidv4();
    const now = new Date();

    await executeStatement(`
      INSERT INTO user_memory_rules (
        id, tenant_id, user_id, rule_text, rule_summary, rule_type, priority,
        source, preset_id, is_active,
        apply_to_preprompts, apply_to_synthesis, apply_to_responses,
        applicable_domains, applicable_modes, created_at, updated_at
      ) VALUES (
        :id, :tenant_id, :user_id, :rule_text, :rule_summary, :rule_type, :priority,
        :source, :preset_id, true,
        :apply_preprompts, :apply_synthesis, :apply_responses,
        :domains::text[], :modes::text[], :created_at, :updated_at
      )
    `, [
      stringParam('id', id),
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
      stringParam('rule_text', request.ruleText),
      stringParam('rule_summary', request.ruleSummary || this.generateSummary(request.ruleText)),
      stringParam('rule_type', request.ruleType || 'preference'),
      longParam('priority', request.priority || 50),
      stringParam('source', request.source || 'user_created'),
      stringParam('preset_id', request.presetId || ''),
      stringParam('apply_preprompts', String(request.applyToPreprompts ?? true)),
      stringParam('apply_synthesis', String(request.applyToSynthesis ?? true)),
      stringParam('apply_responses', String(request.applyToResponses ?? true)),
      stringParam('domains', `{${(request.applicableDomains || []).join(',')}}`),
      stringParam('modes', `{${(request.applicableModes || []).join(',')}}`),
      stringParam('created_at', now.toISOString()),
      stringParam('updated_at', now.toISOString()),
    ]);

    logger.info('User rule created', { userId, ruleId: id, ruleType: request.ruleType });

    return {
      id,
      tenantId,
      userId,
      ruleText: request.ruleText,
      ruleSummary: request.ruleSummary || this.generateSummary(request.ruleText),
      ruleType: (request.ruleType || 'preference') as UserRuleType,
      priority: request.priority || 50,
      source: (request.source || 'user_created') as UserRuleSource,
      presetId: request.presetId,
      isActive: true,
      applyToPreprompts: request.applyToPreprompts ?? true,
      applyToSynthesis: request.applyToSynthesis ?? true,
      applyToResponses: request.applyToResponses ?? true,
      applicableDomains: request.applicableDomains || [],
      applicableModes: request.applicableModes || [],
      timesApplied: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateRule(
    tenantId: string,
    userId: string,
    request: UpdateUserRuleRequest
  ): Promise<UserMemoryRule | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const params = [
      stringParam('id', request.ruleId),
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
    ];

    if (request.ruleText !== undefined) {
      updates.push('rule_text = :rule_text');
      params.push(stringParam('rule_text', request.ruleText));
    }
    if (request.ruleSummary !== undefined) {
      updates.push('rule_summary = :rule_summary');
      params.push(stringParam('rule_summary', request.ruleSummary));
    }
    if (request.ruleType !== undefined) {
      updates.push('rule_type = :rule_type');
      params.push(stringParam('rule_type', request.ruleType));
    }
    if (request.priority !== undefined) {
      updates.push('priority = :priority');
      params.push(longParam('priority', request.priority));
    }
    if (request.isActive !== undefined) {
      updates.push('is_active = :is_active');
      params.push(stringParam('is_active', String(request.isActive)));
    }
    if (request.applyToPreprompts !== undefined) {
      updates.push('apply_to_preprompts = :apply_preprompts');
      params.push(stringParam('apply_preprompts', String(request.applyToPreprompts)));
    }
    if (request.applyToSynthesis !== undefined) {
      updates.push('apply_to_synthesis = :apply_synthesis');
      params.push(stringParam('apply_synthesis', String(request.applyToSynthesis)));
    }
    if (request.applyToResponses !== undefined) {
      updates.push('apply_to_responses = :apply_responses');
      params.push(stringParam('apply_responses', String(request.applyToResponses)));
    }

    await executeStatement(`
      UPDATE user_memory_rules
      SET ${updates.join(', ')}
      WHERE id = :id AND tenant_id = :tenant_id AND user_id = :user_id
    `, params);

    // Fetch updated rule
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM user_memory_rules WHERE id = :id
    `, [stringParam('id', request.ruleId)]);

    if (result.rows.length === 0) return null;
    return this.mapRuleRow(result.rows[0]);
  }

  async deleteRule(
    tenantId: string,
    userId: string,
    ruleId: string
  ): Promise<boolean> {
    const result = await executeStatement(`
      DELETE FROM user_memory_rules
      WHERE id = :id AND tenant_id = :tenant_id AND user_id = :user_id
    `, [
      stringParam('id', ruleId),
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
    ]);

    logger.info('User rule deleted', { userId, ruleId });
    return true;
  }

  async toggleRule(
    tenantId: string,
    userId: string,
    ruleId: string,
    isActive: boolean
  ): Promise<void> {
    await executeStatement(`
      UPDATE user_memory_rules
      SET is_active = :is_active, updated_at = NOW()
      WHERE id = :id AND tenant_id = :tenant_id AND user_id = :user_id
    `, [
      stringParam('is_active', String(isActive)),
      stringParam('id', ruleId),
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
    ]);
  }

  // ============================================================================
  // Preset Rules
  // ============================================================================

  async getPresetRules(userTier = 1): Promise<PresetUserRule[]> {
    // Check cache
    if (this.presetCache && Date.now() < this.presetCacheExpiry) {
      return this.presetCache.filter(p => p.minTier <= userTier);
    }

    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM preset_user_rules
      WHERE is_active = true
      ORDER BY category, display_order
    `, []);

    this.presetCache = result.rows.map(this.mapPresetRow);
    this.presetCacheExpiry = Date.now() + this.CACHE_TTL;

    return this.presetCache.filter(p => p.minTier <= userTier);
  }

  async getPresetCategories(userTier = 1): Promise<PresetRuleCategory[]> {
    const presets = await this.getPresetRules(userTier);
    
    const categoryMap = new Map<string, PresetRuleCategory>();
    
    for (const preset of presets) {
      if (!categoryMap.has(preset.category)) {
        categoryMap.set(preset.category, {
          name: preset.category,
          icon: this.getCategoryIcon(preset.category),
          description: this.getCategoryDescription(preset.category),
          rules: [],
        });
      }
      categoryMap.get(preset.category)!.rules.push(preset);
    }

    return Array.from(categoryMap.values());
  }

  async addPresetRule(
    tenantId: string,
    userId: string,
    presetId: string,
    customRuleText?: string
  ): Promise<UserMemoryRule> {
    // Get the preset
    const presets = await this.getPresetRules();
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Check if already added
    const existing = await this.getUserRules(tenantId, userId, false);
    if (existing.some(r => r.presetId === presetId)) {
      throw new Error('This preset rule has already been added');
    }

    return this.createRule(tenantId, userId, {
      ruleText: customRuleText || preset.ruleText,
      ruleSummary: preset.ruleSummary,
      ruleType: preset.ruleType,
      source: 'preset_added',
      presetId,
      priority: 50,
    });
  }

  // ============================================================================
  // Rules Application
  // ============================================================================

  async getRulesForPrompt(
    tenantId: string,
    userId: string,
    domainId?: string,
    mode?: string
  ): Promise<AppliedUserRules> {
    const result = await executeStatement<{
      rule_id: string;
      rule_text: string;
      rule_type: string;
      priority: number;
    }>(`
      SELECT rule_id, rule_text, rule_type, priority
      FROM get_user_rules_for_preprompt(:user_id, :domain_id, :mode)
    `, [
      stringParam('user_id', userId),
      stringParam('domain_id', domainId || ''),
      stringParam('mode', mode || ''),
    ]);

    const rules: UserMemoryRule[] = result.rows.map(r => ({
      id: r.rule_id,
      tenantId,
      userId,
      ruleText: r.rule_text,
      ruleType: r.rule_type as UserRuleType,
      priority: r.priority,
      isActive: true,
      applyToPreprompts: true,
      applyToSynthesis: true,
      applyToResponses: true,
      applicableDomains: [],
      applicableModes: [],
      timesApplied: 0,
      source: 'user_created',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Format rules for prompt injection
    const formattedForPrompt = this.formatRulesForPrompt(rules);

    return {
      rules,
      formattedForPrompt,
      ruleCount: rules.length,
      hasRestrictions: rules.some(r => r.ruleType === 'restriction'),
      hasSourceRequirements: rules.some(r => r.ruleType === 'source'),
    };
  }

  formatRulesForPrompt(rules: UserMemoryRule[]): string {
    if (rules.length === 0) return '';

    const sections: Record<string, string[]> = {
      restriction: [],
      source: [],
      format: [],
      tone: [],
      other: [],
    };

    for (const rule of rules) {
      const category = ['restriction', 'source', 'format', 'tone'].includes(rule.ruleType) 
        ? rule.ruleType 
        : 'other';
      sections[category].push(rule.ruleText);
    }

    let formatted = '\n## User Preferences\nThe user has set the following rules for how you should respond:\n';

    if (sections.restriction.length > 0) {
      formatted += '\n**Restrictions (Must Follow):**\n';
      sections.restriction.forEach(r => formatted += `- ${r}\n`);
    }

    if (sections.source.length > 0) {
      formatted += '\n**Source Requirements:**\n';
      sections.source.forEach(r => formatted += `- ${r}\n`);
    }

    if (sections.format.length > 0) {
      formatted += '\n**Format Preferences:**\n';
      sections.format.forEach(r => formatted += `- ${r}\n`);
    }

    if (sections.tone.length > 0) {
      formatted += '\n**Tone & Style:**\n';
      sections.tone.forEach(r => formatted += `- ${r}\n`);
    }

    if (sections.other.length > 0) {
      formatted += '\n**Other Preferences:**\n';
      sections.other.forEach(r => formatted += `- ${r}\n`);
    }

    return formatted;
  }

  async logRuleApplication(
    ruleId: string,
    planId?: string,
    prepromptInstanceId?: string,
    context: 'preprompt' | 'synthesis' | 'response' = 'preprompt'
  ): Promise<void> {
    await executeStatement(`
      INSERT INTO user_rule_application_log (id, rule_id, plan_id, preprompt_instance_id, application_context)
      VALUES (:id, :rule_id, :plan_id, :instance_id, :context)
    `, [
      stringParam('id', uuidv4()),
      stringParam('rule_id', ruleId),
      stringParam('plan_id', planId || ''),
      stringParam('instance_id', prepromptInstanceId || ''),
      stringParam('context', context),
    ]);
  }

  // ============================================================================
  // Memory Categories
  // ============================================================================

  async getMemoryCategories(): Promise<MemoryCategoryTree> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM get_memory_category_tree()
    `, []);

    const categories: MemoryCategory[] = result.rows.map(row => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      parentCode: row.parent_code ? String(row.parent_code) : undefined,
      level: Number(row.level),
      path: String(row.path),
      icon: row.icon ? String(row.icon) : undefined,
      color: row.color ? String(row.color) : undefined,
      displayOrder: 0,
      isSystem: Boolean(row.is_system),
      isExpandable: true,
      appliesTo: ['preprompt', 'synthesis', 'response'],
      childCount: Number(row.child_count || 0),
    }));

    const topLevel = categories.filter(c => c.level === 1);
    const byCode: Record<string, MemoryCategory> = {};
    
    for (const cat of categories) {
      byCode[cat.code] = cat;
    }

    // Build tree structure
    for (const cat of categories) {
      if (cat.parentCode && byCode[cat.parentCode]) {
        if (!byCode[cat.parentCode].children) {
          byCode[cat.parentCode].children = [];
        }
        byCode[cat.parentCode].children!.push(cat);
      }
    }

    return { categories, topLevel, byCode };
  }

  async getMemoriesByCategory(
    tenantId: string,
    userId: string,
    categoryCode?: string
  ): Promise<MemoryByCategory[]> {
    const result = await executeStatement<Record<string, unknown>>(`
      SELECT * FROM get_user_memories_by_category(:user_id, :category_code)
    `, [
      stringParam('user_id', userId),
      stringParam('category_code', categoryCode || ''),
    ]);

    // Group by category
    const categoryMap = new Map<string, MemoryByCategory>();
    
    for (const row of result.rows) {
      const catCode = String(row.category_code || 'uncategorized');
      
      if (!categoryMap.has(catCode)) {
        categoryMap.set(catCode, {
          category: {
            id: '',
            code: catCode,
            name: String(row.category_name || 'Uncategorized'),
            level: 1,
            path: catCode,
            displayOrder: 0,
            isSystem: false,
            isExpandable: false,
            appliesTo: ['preprompt', 'synthesis', 'response'],
            icon: row.category_icon ? String(row.category_icon) : undefined,
            color: row.category_color ? String(row.category_color) : undefined,
          },
          memories: [],
          count: 0,
        });
      }

      const memoryRule: UserMemoryRule = {
        id: String(row.memory_id),
        tenantId,
        userId,
        ruleText: String(row.rule_text),
        ruleSummary: row.rule_summary ? String(row.rule_summary) : undefined,
        ruleType: 'preference',
        priority: 50,
        source: 'user_created',
        isActive: Boolean(row.is_active),
        applyToPreprompts: true,
        applyToSynthesis: true,
        applyToResponses: true,
        applicableDomains: [],
        applicableModes: [],
        timesApplied: Number(row.times_applied || 0),
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.created_at as string),
        memoryCategoryCode: catCode,
        memoryCategoryName: String(row.category_name || 'Uncategorized'),
        memoryCategoryIcon: row.category_icon ? String(row.category_icon) : undefined,
        memoryCategoryColor: row.category_color ? String(row.category_color) : undefined,
      };

      categoryMap.get(catCode)!.memories.push(memoryRule);
      categoryMap.get(catCode)!.count++;
    }

    return Array.from(categoryMap.values());
  }

  // ============================================================================
  // Think Tank Page Data
  // ============================================================================

  async getPageData(
    tenantId: string,
    userId: string,
    userTier = 1
  ): Promise<UserRulesPageData> {
    const [rules, presetCategories, presets] = await Promise.all([
      this.getUserRules(tenantId, userId, false),
      this.getPresetCategories(userTier),
      this.getPresetRules(userTier),
    ]);

    const activeRulesCount = rules.filter(r => r.isActive).length;
    const totalTimesApplied = rules.reduce((sum, r) => sum + r.timesApplied, 0);
    
    const mostUsedRules = [...rules]
      .sort((a, b) => b.timesApplied - a.timesApplied)
      .slice(0, 5)
      .map(rule => ({ rule, timesApplied: rule.timesApplied }));

    const popularPresets = presets.filter(p => p.isPopular);

    return {
      rules,
      activeRulesCount,
      presetCategories,
      popularPresets,
      totalTimesApplied,
      mostUsedRules,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getRuleCount(tenantId: string, userId: string): Promise<number> {
    const result = await executeStatement<{ count: number }>(`
      SELECT COUNT(*) as count FROM user_memory_rules
      WHERE tenant_id = :tenant_id AND user_id = :user_id
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
    ]);
    return Number(result.rows[0]?.count || 0);
  }

  private generateSummary(ruleText: string): string {
    // Generate a short summary from the rule text
    const words = ruleText.split(' ').slice(0, 6);
    let summary = words.join(' ');
    if (ruleText.split(' ').length > 6) {
      summary += '...';
    }
    return summary;
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Privacy & Safety': 'Shield',
      'Sources & Citations': 'BookOpen',
      'Response Format': 'AlignLeft',
      'Tone & Style': 'MessageSquare',
      'Accessibility': 'Eye',
      'Topic Preferences': 'Tag',
      'Advanced': 'Settings',
    };
    return icons[category] || 'FileText';
  }

  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      'Privacy & Safety': 'Control what personal or sensitive topics the AI discusses',
      'Sources & Citations': 'Set requirements for sources and references',
      'Response Format': 'Control how responses are structured and formatted',
      'Tone & Style': 'Set preferences for communication style',
      'Accessibility': 'Optimize responses for readability and clarity',
      'Topic Preferences': 'Set topic-specific rules and disclaimers',
      'Advanced': 'Fine-tune AI behavior for specific needs',
    };
    return descriptions[category] || '';
  }

  private mapRuleRow(row: Record<string, unknown>): UserMemoryRule {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      ruleText: String(row.rule_text),
      ruleSummary: row.rule_summary ? String(row.rule_summary) : undefined,
      ruleType: String(row.rule_type) as UserRuleType,
      priority: Number(row.priority),
      source: String(row.source) as UserRuleSource,
      presetId: row.preset_id ? String(row.preset_id) : undefined,
      isActive: Boolean(row.is_active),
      applyToPreprompts: Boolean(row.apply_to_preprompts),
      applyToSynthesis: Boolean(row.apply_to_synthesis),
      applyToResponses: Boolean(row.apply_to_responses),
      applicableDomains: (row.applicable_domains as string[]) || [],
      applicableModes: (row.applicable_modes as string[]) || [],
      timesApplied: Number(row.times_applied),
      lastAppliedAt: row.last_applied_at ? new Date(row.last_applied_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapPresetRow(row: Record<string, unknown>): PresetUserRule {
    return {
      id: String(row.id),
      ruleText: String(row.rule_text),
      ruleSummary: String(row.rule_summary),
      description: row.description ? String(row.description) : undefined,
      ruleType: String(row.rule_type) as UserRuleType,
      category: String(row.category),
      displayOrder: Number(row.display_order),
      icon: row.icon ? String(row.icon) : undefined,
      isPopular: Boolean(row.is_popular),
      isActive: Boolean(row.is_active),
      minTier: Number(row.min_tier || 1),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const userRulesService = new UserRulesService();
