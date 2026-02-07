/**
 * LIVS-M Workflow Template Service
 * 
 * Manages workflow templates with system defaults and user overrides.
 * Provides effective settings resolution from template hierarchy.
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  LIVSWorkflowTemplate,
  LIVSWorkflowOwnerType,
  LIVSEnvironmentMode,
  LIVSEnforcementAction,
  LIVSBehavioralRule,
  LIVSUserWorkflowPreferences,
  LIVSEffectiveSettings,
  CreateWorkflowTemplateRequest,
  InterrogationDepth,
  DEFAULT_STUB_PATTERNS,
  DEFAULT_BEHAVIORAL_RULES,
  SYSTEM_WORKFLOW_TEMPLATES,
} from '@radiant/shared';

export interface LIVSWorkflowTemplateServiceDeps {
  pool: Pool;
}

interface SystemTemplateConfig {
  name: string;
  slug: string;
  description: string;
  environmentMode: LIVSEnvironmentMode;
  treatWarningsAsBlockers: boolean;
  defaultInterrogationDepth: InterrogationDepth;
  stubEnforcementAction: LIVSEnforcementAction;
  enableThesisAntithesis: boolean;
}

const SYSTEM_TEMPLATE_CONFIGS: SystemTemplateConfig[] = [
  {
    name: 'Strict Engineering',
    slug: SYSTEM_WORKFLOW_TEMPLATES.STRICT,
    description: 'Maximum rigor - all warnings are blockers, full dialectical verification',
    environmentMode: 'strict_engineering',
    treatWarningsAsBlockers: true,
    defaultInterrogationDepth: 3,
    stubEnforcementAction: 'BLOCK',
    enableThesisAntithesis: true,
  },
  {
    name: 'Balanced',
    slug: SYSTEM_WORKFLOW_TEMPLATES.BALANCED,
    description: 'Default mode - reasonable verification without excessive overhead',
    environmentMode: 'balanced',
    treatWarningsAsBlockers: false,
    defaultInterrogationDepth: 2,
    stubEnforcementAction: 'REJECT_AND_RETRY',
    enableThesisAntithesis: false,
  },
  {
    name: 'Brainstorming',
    slug: SYSTEM_WORKFLOW_TEMPLATES.BRAINSTORM,
    description: 'Creative mode - relaxed rules for ideation and exploration',
    environmentMode: 'brainstorming',
    treatWarningsAsBlockers: false,
    defaultInterrogationDepth: 1,
    stubEnforcementAction: 'FLAG_FOR_REVIEW',
    enableThesisAntithesis: false,
  },
  {
    name: 'Full Audit',
    slug: SYSTEM_WORKFLOW_TEMPLATES.AUDIT,
    description: 'Maximum scrutiny - everything logged and verified for compliance',
    environmentMode: 'audit',
    treatWarningsAsBlockers: true,
    defaultInterrogationDepth: 4,
    stubEnforcementAction: 'BLOCK',
    enableThesisAntithesis: true,
  },
];

export class LIVSWorkflowTemplateService {
  private pool: Pool;

  constructor(deps: LIVSWorkflowTemplateServiceDeps) {
    this.pool = deps.pool;
  }

  /**
   * Ensure system default templates exist for a tenant
   */
  async ensureSystemTemplates(tenantId: string): Promise<void> {
    for (const config of SYSTEM_TEMPLATE_CONFIGS) {
      const existing = await this.getTemplateBySlug(tenantId, config.slug, 'system');
      if (!existing) {
        await this.createSystemTemplate(tenantId, config);
      }
    }

    // Set balanced as default if no default exists
    const defaultTemplate = await this.getDefaultTemplate(tenantId);
    if (!defaultTemplate) {
      const balanced = await this.getTemplateBySlug(tenantId, SYSTEM_WORKFLOW_TEMPLATES.BALANCED, 'system');
      if (balanced) {
        await this.setDefaultTemplate(tenantId, balanced.id);
      }
    }
  }

  /**
   * Create a system template with default behavioral rules
   */
  private async createSystemTemplate(
    tenantId: string,
    config: SystemTemplateConfig
  ): Promise<LIVSWorkflowTemplate> {
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO livs_workflow_templates (
        id, tenant_id, name, description, slug, owner_type,
        environment_mode, treat_warnings_as_blockers,
        default_interrogation_depth, auto_escalate, escalation_threshold,
        stub_detection_enabled, stub_patterns, stub_enforcement_action,
        sycophancy_detection_enabled, min_turns_before_agreement, max_consensus_threshold,
        chaos_injection_prompt,
        enable_thesis_antithesis, synthesis_required,
        max_cost_multiplier, max_tokens_per_interrogation,
        is_active, is_default, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'system',
        $6, $7,
        $8, true, 0.6,
        true, $9, $10,
        true, 3, 0.95,
        'STOP. Assume the previous assertion is WRONG. Find flaws in this approach.',
        $11, true,
        2.0, 4000,
        true, false, $12, $12
      )`,
      [
        id,
        tenantId,
        config.name,
        config.description,
        config.slug,
        config.environmentMode,
        config.treatWarningsAsBlockers,
        config.defaultInterrogationDepth,
        JSON.stringify(DEFAULT_STUB_PATTERNS),
        config.stubEnforcementAction,
        config.enableThesisAntithesis,
        now,
      ]
    );

    // Create behavioral rules for this template
    await this.createDefaultBehavioralRules(tenantId, id, config.environmentMode);

    return this.getTemplate(tenantId, id) as Promise<LIVSWorkflowTemplate>;
  }

  /**
   * Create default behavioral rules for a template
   */
  private async createDefaultBehavioralRules(
    tenantId: string,
    templateId: string,
    environmentMode: LIVSEnvironmentMode
  ): Promise<void> {
    const now = new Date();

    for (const rule of DEFAULT_BEHAVIORAL_RULES) {
      // Only create rules that apply to this mode
      if (!rule.appliesToModes.includes(environmentMode)) continue;

      await this.pool.query(
        `INSERT INTO livs_behavioral_rules (
          id, tenant_id, workflow_template_id, rule_id, name, description,
          severity, enforcement_action, trigger_condition, action_prompt,
          applies_to_modes, is_active, priority, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
        [
          uuidv4(),
          tenantId,
          templateId,
          rule.ruleId,
          rule.name,
          rule.description,
          rule.severity,
          rule.enforcementAction,
          JSON.stringify(rule.triggerCondition),
          rule.actionPrompt,
          rule.appliesToModes,
          rule.isActive,
          rule.priority,
          now,
        ]
      );
    }
  }

  /**
   * Get all templates for a tenant
   */
  async getTemplates(
    tenantId: string,
    options?: {
      ownerType?: LIVSWorkflowOwnerType;
      ownerId?: string;
      activeOnly?: boolean;
    }
  ): Promise<LIVSWorkflowTemplate[]> {
    let query = `SELECT * FROM livs_workflow_templates WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.ownerType) {
      query += ` AND owner_type = $${paramIndex++}`;
      params.push(options.ownerType);
    }

    if (options?.ownerId) {
      query += ` AND owner_id = $${paramIndex++}`;
      params.push(options.ownerId);
    }

    if (options?.activeOnly) {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY owner_type, name`;

    const result = await this.pool.query(query, params);
    return Promise.all(result.rows.map(row => this.mapRowToTemplate(row, tenantId)));
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(tenantId: string, templateId: string): Promise<LIVSWorkflowTemplate | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_workflow_templates WHERE tenant_id = $1 AND id = $2`,
      [tenantId, templateId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToTemplate(result.rows[0], tenantId);
  }

  /**
   * Get template by slug and owner type
   */
  async getTemplateBySlug(
    tenantId: string,
    slug: string,
    ownerType: LIVSWorkflowOwnerType,
    ownerId?: string
  ): Promise<LIVSWorkflowTemplate | null> {
    let query = `SELECT * FROM livs_workflow_templates 
                 WHERE tenant_id = $1 AND slug = $2 AND owner_type = $3`;
    const params: unknown[] = [tenantId, slug, ownerType];

    if (ownerId) {
      query += ` AND owner_id = $4`;
      params.push(ownerId);
    } else {
      query += ` AND owner_id IS NULL`;
    }

    const result = await this.pool.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToTemplate(result.rows[0], tenantId);
  }

  /**
   * Get the default template for a tenant
   */
  async getDefaultTemplate(tenantId: string): Promise<LIVSWorkflowTemplate | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_workflow_templates 
       WHERE tenant_id = $1 AND is_default = true`,
      [tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToTemplate(result.rows[0], tenantId);
  }

  /**
   * Set a template as the default
   */
  async setDefaultTemplate(tenantId: string, templateId: string): Promise<void> {
    await this.pool.query('BEGIN');
    try {
      // Unset current default
      await this.pool.query(
        `UPDATE livs_workflow_templates SET is_default = false WHERE tenant_id = $1`,
        [tenantId]
      );

      // Set new default
      await this.pool.query(
        `UPDATE livs_workflow_templates SET is_default = true WHERE tenant_id = $1 AND id = $2`,
        [tenantId, templateId]
      );

      await this.pool.query('COMMIT');
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Create a new workflow template (user or tenant)
   */
  async createTemplate(
    tenantId: string,
    request: CreateWorkflowTemplateRequest,
    ownerType: LIVSWorkflowOwnerType,
    ownerId?: string
  ): Promise<LIVSWorkflowTemplate> {
    if (ownerType === 'system') {
      throw new Error('Cannot create system templates via this method');
    }

    const id = uuidv4();
    const now = new Date();
    const slug = request.slug || this.generateSlug(request.name);

    // Get parent template for defaults
    let parent: LIVSWorkflowTemplate | null = null;
    if (request.parentTemplateId) {
      parent = await this.getTemplate(tenantId, request.parentTemplateId);
    } else {
      parent = await this.getDefaultTemplate(tenantId);
    }

    await this.pool.query(
      `INSERT INTO livs_workflow_templates (
        id, tenant_id, name, description, slug, owner_type, owner_id,
        parent_template_id, environment_mode, treat_warnings_as_blockers,
        default_interrogation_depth, auto_escalate, escalation_threshold,
        interrogator_model, stub_detection_enabled, stub_patterns,
        stub_enforcement_action, sycophancy_detection_enabled,
        min_turns_before_agreement, max_consensus_threshold, chaos_injection_prompt,
        enable_thesis_antithesis, antithesis_model, synthesis_required,
        max_cost_multiplier, max_tokens_per_interrogation,
        is_active, is_default, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25, $26,
        $27, false, $28, $28
      )`,
      [
        id,
        tenantId,
        request.name,
        request.description,
        slug,
        ownerType,
        ownerId,
        request.parentTemplateId || parent?.id,
        request.environmentMode ?? parent?.environmentMode ?? 'balanced',
        request.treatWarningsAsBlockers ?? parent?.treatWarningsAsBlockers ?? false,
        request.defaultInterrogationDepth ?? parent?.defaultInterrogationDepth ?? 2,
        request.autoEscalate ?? parent?.autoEscalate ?? true,
        request.escalationThreshold ?? parent?.escalationThreshold ?? 0.6,
        request.interrogatorModel ?? parent?.interrogatorModel,
        request.stubDetectionEnabled ?? parent?.stubDetectionEnabled ?? true,
        JSON.stringify(request.stubPatterns ?? parent?.stubPatterns ?? DEFAULT_STUB_PATTERNS),
        request.stubEnforcementAction ?? parent?.stubEnforcementAction ?? 'REJECT_AND_RETRY',
        request.sycophancyDetectionEnabled ?? parent?.sycophancyDetectionEnabled ?? true,
        request.minTurnsBeforeAgreement ?? parent?.minTurnsBeforeAgreement ?? 3,
        request.maxConsensusThreshold ?? parent?.maxConsensusThreshold ?? 0.95,
        request.chaosInjectionPrompt ?? parent?.chaosInjectionPrompt,
        request.enableThesisAntithesis ?? parent?.enableThesisAntithesis ?? false,
        request.antithesisModel ?? parent?.antithesisModel,
        request.synthesisRequired ?? parent?.synthesisRequired ?? true,
        request.maxCostMultiplier ?? parent?.maxCostMultiplier ?? 2.0,
        request.maxTokensPerInterrogation ?? parent?.maxTokensPerInterrogation ?? 4000,
        request.isActive ?? true,
        now,
      ]
    );

    // Copy behavioral rules from parent if exists
    if (parent?.behavioralRules) {
      await this.copyBehavioralRules(tenantId, parent.id, id);
    }

    return this.getTemplate(tenantId, id) as Promise<LIVSWorkflowTemplate>;
  }

  /**
   * Copy behavioral rules from one template to another
   */
  private async copyBehavioralRules(
    tenantId: string,
    sourceTemplateId: string,
    targetTemplateId: string
  ): Promise<void> {
    const now = new Date();
    const rules = await this.getBehavioralRules(tenantId, sourceTemplateId);

    for (const rule of rules) {
      await this.pool.query(
        `INSERT INTO livs_behavioral_rules (
          id, tenant_id, workflow_template_id, rule_id, name, description,
          severity, enforcement_action, trigger_condition, action_prompt,
          applies_to_modes, is_active, priority, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
        [
          uuidv4(),
          tenantId,
          targetTemplateId,
          rule.ruleId,
          rule.name,
          rule.description,
          rule.severity,
          rule.enforcementAction,
          JSON.stringify(rule.triggerCondition),
          rule.actionPrompt,
          rule.appliesToModes,
          rule.isActive,
          rule.priority,
          now,
        ]
      );
    }
  }

  /**
   * Update a workflow template
   */
  async updateTemplate(
    tenantId: string,
    templateId: string,
    updates: Partial<CreateWorkflowTemplateRequest>
  ): Promise<LIVSWorkflowTemplate | null> {
    const existing = await this.getTemplate(tenantId, templateId);
    if (!existing) return null;

    // Don't allow modifying system templates
    if (existing.ownerType === 'system') {
      throw new Error('Cannot modify system templates');
    }

    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      environmentMode: 'environment_mode',
      treatWarningsAsBlockers: 'treat_warnings_as_blockers',
      defaultInterrogationDepth: 'default_interrogation_depth',
      autoEscalate: 'auto_escalate',
      escalationThreshold: 'escalation_threshold',
      interrogatorModel: 'interrogator_model',
      stubDetectionEnabled: 'stub_detection_enabled',
      stubEnforcementAction: 'stub_enforcement_action',
      sycophancyDetectionEnabled: 'sycophancy_detection_enabled',
      minTurnsBeforeAgreement: 'min_turns_before_agreement',
      maxConsensusThreshold: 'max_consensus_threshold',
      chaosInjectionPrompt: 'chaos_injection_prompt',
      enableThesisAntithesis: 'enable_thesis_antithesis',
      antithesisModel: 'antithesis_model',
      synthesisRequired: 'synthesis_required',
      maxCostMultiplier: 'max_cost_multiplier',
      maxTokensPerInterrogation: 'max_tokens_per_interrogation',
      isActive: 'is_active',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((updates as Record<string, unknown>)[key] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex++}`);
        params.push((updates as Record<string, unknown>)[key]);
      }
    }

    if (updates.stubPatterns !== undefined) {
      updateFields.push(`stub_patterns = $${paramIndex++}`);
      params.push(JSON.stringify(updates.stubPatterns));
    }

    if (updateFields.length === 0) return existing;

    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    params.push(tenantId, templateId);

    await this.pool.query(
      `UPDATE livs_workflow_templates 
       SET ${updateFields.join(', ')}
       WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex}`,
      params
    );

    return this.getTemplate(tenantId, templateId);
  }

  /**
   * Delete a workflow template
   */
  async deleteTemplate(tenantId: string, templateId: string): Promise<boolean> {
    const existing = await this.getTemplate(tenantId, templateId);
    if (!existing) return false;

    if (existing.ownerType === 'system') {
      throw new Error('Cannot delete system templates');
    }

    const result = await this.pool.query(
      `DELETE FROM livs_workflow_templates WHERE tenant_id = $1 AND id = $2`,
      [tenantId, templateId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get behavioral rules for a template
   */
  async getBehavioralRules(tenantId: string, templateId: string): Promise<LIVSBehavioralRule[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_behavioral_rules 
       WHERE tenant_id = $1 AND workflow_template_id = $2
       ORDER BY priority DESC, rule_id`,
      [tenantId, templateId]
    );

    return result.rows.map(this.mapRowToRule);
  }

  /**
   * Get user workflow preferences
   */
  async getUserPreferences(
    tenantId: string,
    userId: string
  ): Promise<LIVSUserWorkflowPreferences | null> {
    const result = await this.pool.query(
      `SELECT * FROM livs_user_workflow_preferences WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToPreferences(result.rows[0]);
  }

  /**
   * Set user workflow preferences
   */
  async setUserPreferences(
    tenantId: string,
    userId: string,
    preferences: Partial<Omit<LIVSUserWorkflowPreferences, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LIVSUserWorkflowPreferences> {
    const existing = await this.getUserPreferences(tenantId, userId);
    const now = new Date();

    if (existing) {
      const updateFields: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (preferences.activeWorkflowId !== undefined) {
        updateFields.push(`active_workflow_id = $${paramIndex++}`);
        params.push(preferences.activeWorkflowId);
      }

      if (preferences.livsEnabled !== undefined) {
        updateFields.push(`livs_enabled = $${paramIndex++}`);
        params.push(preferences.livsEnabled);
      }

      if (preferences.environmentModeOverride !== undefined) {
        updateFields.push(`environment_mode_override = $${paramIndex++}`);
        params.push(preferences.environmentModeOverride);
      }

      if (preferences.interrogationDepthOverride !== undefined) {
        updateFields.push(`interrogation_depth_override = $${paramIndex++}`);
        params.push(preferences.interrogationDepthOverride);
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      params.push(now);

      params.push(tenantId, userId);

      await this.pool.query(
        `UPDATE livs_user_workflow_preferences 
         SET ${updateFields.join(', ')}
         WHERE tenant_id = $${paramIndex++} AND user_id = $${paramIndex}`,
        params
      );
    } else {
      await this.pool.query(
        `INSERT INTO livs_user_workflow_preferences (
          id, tenant_id, user_id, active_workflow_id, livs_enabled,
          environment_mode_override, interrogation_depth_override,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          uuidv4(),
          tenantId,
          userId,
          preferences.activeWorkflowId,
          preferences.livsEnabled ?? true,
          preferences.environmentModeOverride,
          preferences.interrogationDepthOverride,
          now,
        ]
      );
    }

    return this.getUserPreferences(tenantId, userId) as Promise<LIVSUserWorkflowPreferences>;
  }

  /**
   * Toggle LIVS on/off for a user (quick toggle)
   */
  async toggleLIVS(tenantId: string, userId: string, enabled: boolean): Promise<void> {
    await this.setUserPreferences(tenantId, userId, { livsEnabled: enabled });
  }

  /**
   * Get effective settings for a user (resolved from template + overrides)
   */
  async getEffectiveSettings(tenantId: string, userId?: string): Promise<LIVSEffectiveSettings> {
    // Ensure system templates exist
    await this.ensureSystemTemplates(tenantId);

    // Get user preferences if userId provided
    let preferences: LIVSUserWorkflowPreferences | null = null;
    if (userId) {
      preferences = await this.getUserPreferences(tenantId, userId);
    }

    // If LIVS is disabled via toggle, return minimal settings
    if (preferences && !preferences.livsEnabled) {
      return {
        workflowName: 'Disabled',
        enabled: false,
        environmentMode: 'balanced',
        treatWarningsAsBlockers: false,
        interrogationDepth: 0,
        autoEscalate: false,
        escalationThreshold: 1.0,
        stubDetectionEnabled: false,
        stubPatterns: [],
        stubEnforcementAction: 'PASS',
        sycophancyDetectionEnabled: false,
        minTurnsBeforeAgreement: 999,
        maxConsensusThreshold: 1.0,
        enableThesisAntithesis: false,
        synthesisRequired: false,
        behavioralRules: [],
        maxCostMultiplier: 1.0,
        maxTokensPerInterrogation: 0,
      };
    }

    // Get active template
    let template: LIVSWorkflowTemplate | null = null;
    if (preferences?.activeWorkflowId) {
      template = await this.getTemplate(tenantId, preferences.activeWorkflowId);
    }
    if (!template) {
      template = await this.getDefaultTemplate(tenantId);
    }
    if (!template) {
      // Fallback to balanced system template
      template = await this.getTemplateBySlug(tenantId, SYSTEM_WORKFLOW_TEMPLATES.BALANCED, 'system');
    }

    if (!template) {
      throw new Error('No workflow template available');
    }

    // Get behavioral rules
    const behavioralRules = await this.getBehavioralRules(tenantId, template.id);

    // Apply user overrides
    const effectiveMode = preferences?.environmentModeOverride ?? template.environmentMode;
    const effectiveDepth = preferences?.interrogationDepthOverride ?? template.defaultInterrogationDepth;

    // Filter rules by effective mode
    const activeRules = behavioralRules.filter(
      rule => rule.isActive && rule.appliesToModes.includes(effectiveMode)
    );

    return {
      workflowTemplateId: template.id,
      workflowName: template.name,
      enabled: true,
      environmentMode: effectiveMode,
      treatWarningsAsBlockers: template.treatWarningsAsBlockers,
      interrogationDepth: effectiveDepth,
      autoEscalate: template.autoEscalate,
      escalationThreshold: template.escalationThreshold,
      interrogatorModel: template.interrogatorModel,
      stubDetectionEnabled: template.stubDetectionEnabled,
      stubPatterns: template.stubPatterns,
      stubEnforcementAction: template.stubEnforcementAction,
      sycophancyDetectionEnabled: template.sycophancyDetectionEnabled,
      minTurnsBeforeAgreement: template.minTurnsBeforeAgreement,
      maxConsensusThreshold: template.maxConsensusThreshold,
      chaosInjectionPrompt: template.chaosInjectionPrompt,
      enableThesisAntithesis: template.enableThesisAntithesis,
      antithesisModel: template.antithesisModel,
      synthesisRequired: template.synthesisRequired,
      behavioralRules: activeRules,
      maxCostMultiplier: template.maxCostMultiplier,
      maxTokensPerInterrogation: template.maxTokensPerInterrogation,
    };
  }

  /**
   * Generate URL-safe slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Map database row to LIVSWorkflowTemplate
   */
  private async mapRowToTemplate(
    row: Record<string, unknown>,
    tenantId: string
  ): Promise<LIVSWorkflowTemplate> {
    const rules = await this.getBehavioralRules(tenantId, row.id as string);

    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      slug: row.slug as string,
      ownerType: row.owner_type as LIVSWorkflowOwnerType,
      ownerId: row.owner_id as string | undefined,
      parentTemplateId: row.parent_template_id as string | undefined,
      environmentMode: row.environment_mode as LIVSEnvironmentMode,
      treatWarningsAsBlockers: row.treat_warnings_as_blockers as boolean,
      defaultInterrogationDepth: row.default_interrogation_depth as InterrogationDepth,
      autoEscalate: row.auto_escalate as boolean,
      escalationThreshold: parseFloat(row.escalation_threshold as string),
      interrogatorModel: row.interrogator_model as string | undefined,
      stubDetectionEnabled: row.stub_detection_enabled as boolean,
      stubPatterns: row.stub_patterns as string[],
      stubEnforcementAction: row.stub_enforcement_action as LIVSEnforcementAction,
      sycophancyDetectionEnabled: row.sycophancy_detection_enabled as boolean,
      minTurnsBeforeAgreement: row.min_turns_before_agreement as number,
      maxConsensusThreshold: parseFloat(row.max_consensus_threshold as string),
      chaosInjectionPrompt: row.chaos_injection_prompt as string | undefined,
      enableThesisAntithesis: row.enable_thesis_antithesis as boolean,
      antithesisModel: row.antithesis_model as string | undefined,
      synthesisRequired: row.synthesis_required as boolean,
      behavioralRules: rules,
      maxCostMultiplier: parseFloat(row.max_cost_multiplier as string),
      maxTokensPerInterrogation: row.max_tokens_per_interrogation as number,
      isActive: row.is_active as boolean,
      isDefault: row.is_default as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Map database row to LIVSBehavioralRule
   */
  private mapRowToRule(row: Record<string, unknown>): LIVSBehavioralRule {
    return {
      id: row.id as string,
      ruleId: row.rule_id as string,
      workflowTemplateId: row.workflow_template_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      severity: row.severity as LIVSBehavioralRule['severity'],
      enforcementAction: row.enforcement_action as LIVSEnforcementAction,
      triggerCondition: row.trigger_condition as LIVSBehavioralRule['triggerCondition'],
      actionPrompt: row.action_prompt as string | undefined,
      appliesToModes: row.applies_to_modes as LIVSEnvironmentMode[],
      isActive: row.is_active as boolean,
      priority: row.priority as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Map database row to LIVSUserWorkflowPreferences
   */
  private mapRowToPreferences(row: Record<string, unknown>): LIVSUserWorkflowPreferences {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      activeWorkflowId: row.active_workflow_id as string | undefined,
      livsEnabled: row.livs_enabled as boolean,
      environmentModeOverride: row.environment_mode_override as LIVSEnvironmentMode | undefined,
      interrogationDepthOverride: row.interrogation_depth_override as InterrogationDepth | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
